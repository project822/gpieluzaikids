const compression = require("compression");
const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
// FIX: di beberapa versi, require("connect-mongo") lewat CommonJS bisa
// mengembalikan { default: MongoStore, ... } alih-alih class-nya langsung
// (interop CJS/ESM) -> MongoStore.create jadi "is not a function". Unwrap
// .default kalau ada, supaya jalan di kedua kemungkinan bentuk export.
const connectMongoModule = require("connect-mongo");
const MongoStore = connectMongoModule.default || connectMongoModule;
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

const db = require("./dbMongo");
const { rateLimitLogin } = require("./rateLimit");
const { getSpeedInsightsData, getMetricRating } = require("./speedInsights");

const app = express();
const PORT = process.env.PORT || 10082;

// ============== HELPER: bungkus route async supaya error tidak bikin request menggantung ==============
// Tanpa ini, kalau sebuah async handler reject (mis. MongoDB gagal connect),
// Express 4 TIDAK akan menangkapnya otomatis -> response tidak pernah dikirim ->
// browser terlihat "loading terus" sampai timeout platform.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============== PATH RESOLUTION (local & Vercel) ==============
const projectRoot = process.cwd();

const PUBLIC_VIEWS_DIR = path.join(projectRoot, "frontend", "views");
const ADMIN_VIEWS_DIR = path.join(projectRoot, "backend", "views", "admin");
const PUBLIC_ASSETS_DIR = path.join(projectRoot, "frontend", "public");
const UPLOADS_DIR = path.join(PUBLIC_ASSETS_DIR, "uploads");

// Fallback jika path tidak ditemukan di process.cwd()
let viewsDir = PUBLIC_VIEWS_DIR;
if (!fs.existsSync(path.join(viewsDir, "index.ejs"))) {
  const altViews = path.join(__dirname, "..", "frontend", "views");
  if (fs.existsSync(path.join(altViews, "index.ejs"))) {
    viewsDir = altViews;
  }
}

// Fallback untuk admin views
let adminViewsDir = ADMIN_VIEWS_DIR;
if (!fs.existsSync(path.join(adminViewsDir, "login.ejs"))) {
  const altAdmin = path.join(__dirname, "views", "admin");
  if (fs.existsSync(path.join(altAdmin, "login.ejs"))) {
    adminViewsDir = altAdmin;
  }
}

// ============== SECURITY MIDDLEWARE ==============
app.use((req, res, next) => {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ============== EXPRESS SETUP ==============
app.set("view engine", "ejs");
app.set("views", [viewsDir, adminViewsDir]);

// Gzip compression for all responses
app.use(compression());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  express.static(PUBLIC_ASSETS_DIR, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res, filePath) => {
      // Aset yang jarang berubah (poster upload selalu dapat nama file baru,
      // logo/ikon statis) aman di-cache lama di browser -> kunjungan berikutnya
      // tidak perlu download ulang.
      if (/\.(css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// Session
// PENTING: default express-session pakai MemoryStore (di RAM proses Node).
// Di Vercel (serverless), tiap request bisa dilayani instance/container yang
// BERBEDA -> instance lain tidak tahu session yang dibuat di instance lain,
// jadi user bisa "ke-logout" secara acak / dapat "Network error" saat fetch
// API karena request-nya di-redirect ke halaman login (bukan JSON).
// Solusinya: simpan session di MongoDB (sudah dipakai project ini) supaya
// semua instance baca dari sumber yang sama.
if (!process.env.MONGO_URI) {
  console.error(
    "[Session] FATAL: MONGO_URI belum di-set, session store tidak bisa connect ke MongoDB. " +
      "Login/session akan tidak stabil sampai MONGO_URI diperbaiki.",
  );
}

if (typeof MongoStore.create !== "function") {
  console.error(
    "[Session] FATAL: MongoStore.create bukan function. Bentuk module connect-mongo " +
      "tidak sesuai dugaan. Keys yang tersedia:",
    Object.keys(connectMongoModule),
  );
  throw new Error(
    "connect-mongo module tidak sesuai dugaan (MongoStore.create bukan function). " +
      "Cek versi 'connect-mongo' yang ter-install (harus v4+) dan lihat log di atas untuk detail.",
  );
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this-admin",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      dbName: process.env.MONGO_DB_NAME || "gereja",
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 hari (detik)
    }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari (ms)
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }),
);

// Multer for file uploads
// Pakai memoryStorage: file masuk sebagai buffer di req.file.buffer,
// supaya bisa diproses (crop 9:16 + resize + convert WebP) via sharp
// SEBELUM ditulis ke disk. Ini menghindari nyimpen file mentah yang
// besar/berat, sekaligus jadi tempat kita validasi ukuran & tipe file.
const MAX_POSTER_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const POSTER_WIDTH = 720;
const POSTER_HEIGHT = 1280; // rasio 9:16, ukuran moderat (tidak perlu lebih besar untuk web)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POSTER_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("File harus berupa gambar (jpg, png, webp, dst)."));
    }
    cb(null, true);
  },
});

// Bungkus upload.single("poster") supaya error (file kegedean / bukan gambar)
// tidak nge-crash request, tapi redirect balik ke form dengan pesan error yang jelas.
function uploadPoster(req, res, next) {
  upload.single("poster")(req, res, (err) => {
    if (!err) return next();

    const isEdit = req.params && req.params.id;
    const backTo = isEdit ? `/admin/events/${req.params.id}/edit` : "/admin/events/new";

    let message = "Gagal mengunggah poster. Silakan coba lagi.";
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      message = "Ukuran file poster maksimal 4MB.";
    } else if (err.message) {
      message = err.message;
    }
    return res.redirect(`${backTo}?error=${encodeURIComponent(message)}`);
  });
}

// Crop ke rasio 9:16 (cover, fokus otomatis ke area paling "menarik" biar tidak
// asal potong tengah), resize ke ukuran moderat, lalu convert ke WebP.
async function processPosterImage(buffer) {
  return sharp(buffer)
    .rotate() // auto-orient sesuai EXIF (foto dari HP kadang kesimpen miring)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer();
}

async function savePosterFile(buffer) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const filename = `${Date.now()}-${crypto.randomUUID()}.webp`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

// ============== FAVICON ==============
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// ============== METRICS ==============
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    // Fire-and-forget, tapi setiap promise WAJIB punya .catch sendiri.
    // try/catch sinkron di sini TIDAK menangkap error yang terjadi di dalam
    // fungsi async setelah await pertama (itu bug di versi sebelumnya).
    db.incRequestMetrics({ latencyMs: Date.now() - start }).catch((e) => {
      console.error("[Metrics] incRequestMetrics gagal:", e.message);
    });

    // Track pageviews for public GET requests (skip static assets, dev routes)
    const isGet = req.method === "GET";
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|webp)$/i.test(req.path);
    const isApi = req.path.startsWith("/api/") || req.path.startsWith("/dev/") || req.path.startsWith("/admin/");
    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

    if (isGet && !isAsset && !isApi && isSuccess) {
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      db.logPageView({ path: req.path, ip, userAgent: req.headers["user-agent"] || "" }).catch((e) => {
        console.error("[Metrics] logPageView gagal:", e.message);
      });
    }
  });
  next();
});

// ============== AUTH MIDDLEWARE ==============
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    // Heartbeat: tandai admin ini masih aktif SEKARANG. Fire-and-forget
    // supaya tidak nambah latency ke request utama; kalau gagal, cukup
    // di-log (jangan sampai bikin request admin gagal cuma gara-gara ini).
    db.touchAdminActivity(req.session.user.username).catch((e) => {
      console.error("[AdminHeartbeat] touchAdminActivity gagal:", e.message);
    });
    return next();
  }
  if (req.session) {
    req.session.redirectTo = req.originalUrl;
  }
  return res.redirect("/admin/login");
}

function ensureDevAuth(req, res, next) {
  if (req.session && req.session.devUser) return next();
  if (req.session) {
    req.session.redirectTo = req.originalUrl;
  }
  return res.redirect("/dev/login");
}

// ============== CONNECT TO MONGODB & INIT ==============
(async function initDb() {
  try {
    await db.connect();
    console.log("[DB] MongoDB connected successfully");

    // Init default admin jika belum ada
    const admins = await db.getAdmins();
    if (!admins || admins.length === 0) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.addAdmin({ username: "admin", passwordHash });
      console.log("Default admin created: username=admin password=admin123");
    }
  } catch (err) {
    console.error("[DB] Failed to connect to MongoDB:", err.message);
    console.error("[DB] Make sure MONGO_URI environment variable is set correctly.");
    console.error("[DB] Fallback: server will continue but database features will fail until MONGO_URI is fixed.");
  }
})();

// ============== EVENTS CACHE (kurangi TTFB di route publik) ==============
// Cache singkat (30 detik) di memory server. Homepage adalah route paling
// sering di-hit; tanpa cache ini, tiap request nunggu round-trip ke MongoDB
// (yang makin berat kalau region Vercel Function beda benua dengan region
// cluster Atlas). Data admin (dashboard/events management) TETAP query
// langsung ke DB (fresh), cache cuma dipakai buat halaman publik.
let eventsCache = { data: null, expiresAt: 0 };
const EVENTS_CACHE_TTL_MS = 30 * 1000;

async function getEventsCached() {
  const now = Date.now();
  if (eventsCache.data && eventsCache.expiresAt > now) {
    return eventsCache.data;
  }
  const events = await db.getEvents();
  eventsCache = { data: events, expiresAt: now + EVENTS_CACHE_TTL_MS };
  return events;
}

function invalidateEventsCache() {
  eventsCache.expiresAt = 0;
}

// ============== PUBLIC ROUTES ==============
app.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await getEventsCached();
    // events already sorted by day descending from MongoDB
    res.render("index", { events });
  }),
);

app.get("/events", (req, res) => res.redirect("/"));
app.get("/events/:id", (req, res) => res.redirect("/"));
app.get("/documentation", (req, res) => res.redirect("/"));
app.get("/contact", (req, res) => res.redirect("/"));

app.get(
  "/api/events/:id",
  asyncHandler(async (req, res) => {
    const event = await db.getEvent(req.params.id);
    if (!event) return res.status(404).json({ error: "Not found" });
    res.json(event);
  }),
);

// ============== ADMIN ROUTES (prefix /admin) ==============

// Login (canonical: /admin/login)
app.get("/admin/login", (req, res) => res.render("login", { error: null }));

const handleAdminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const admins = await db.getAdmins();
  const admin = (admins || []).find((a) => a.username === username);
  if (!admin) {
    return res.render("login", { error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.render("login", { error: "Invalid credentials" });
  }
  req.session.user = { username };
  await db.setAdminOnline(username);

  // Only redirect to admin-accessible paths, NOT dev paths (e.g. /admin/dashboard → /dev/dashboard)
  const savedRedirect = req.session.redirectTo || "";
  let redirectTo = "/admin/events";
  if (
    savedRedirect &&
    !savedRedirect.includes("/dashboard") &&
    !savedRedirect.includes("/dev/") &&
    (savedRedirect.startsWith("/admin/") ||
      savedRedirect.startsWith("/events") ||
      savedRedirect.startsWith("/documentation") ||
      savedRedirect === "/")
  ) {
    redirectTo = savedRedirect;
  }
  delete req.session.redirectTo;
  return res.redirect(redirectTo);
});

app.post(
  "/admin/login",
  rateLimitLogin({
    windowMs: 15 * 60 * 1000,
    max: 5,
    blockMs: 10 * 60 * 1000,
  }),
  handleAdminLogin,
);

// Alias routes for backward compatibility (legacy client posting to /login)
app.get("/login", (req, res) => res.redirect("/admin/login"));

app.post(
  "/login",
  rateLimitLogin({
    windowMs: 15 * 60 * 1000,
    max: 5,
    blockMs: 10 * 60 * 1000,
  }),
  handleAdminLogin,
);

app.get("/dev/logout", (req, res) => {
  const username = req.session && req.session.devUser ? req.session.devUser.username : null;
  req.session.destroy(() => {
    if (username) {
      db.setAdminOffline(username).catch((e) => {
        console.error("[Logout] setAdminOffline gagal:", e.message);
      });
    }
    res.redirect("/dev/login");
  });
});

app.get("/admin/logout", (req, res) => {
  const username = req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy(() => {
    if (username) {
      db.setAdminOffline(username).catch((e) => {
        console.error("[Logout] setAdminOffline gagal:", e.message);
      });
    }
    res.redirect("/admin/login");
  });
});

// ============== DEVELOPER AUTH ROUTES ==============
app.get("/dev/login", (req, res) => {
  return res.render("dev-login", { error: null });
});

app.post("/dev/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "dev" && password === "dev123") {
    req.session.devUser = { username: "dev" };
    const redirectTo = req.session.redirectTo || "/dev/dashboard";
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  } else {
    return res.render("dev-login", { error: "Username atau password developer salah." });
  }
});

// Dashboard monitoring (canonical URL)
app.get(
  "/dev/dashboard",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const timeRange = req.query.range || "7d";
    const [metrics, adminStatuses, admins, pvStats] = await Promise.all([
      db.getMetrics(),
      db.getAdminStatuses(),
      db.getAdmins(),
      db.getPageViewStats(timeRange),
    ]);
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;
    return res.render("dashboard", {
      metrics,
      avgLatencyMs,
      admins: admins || [],
      adminStatuses,
      pvStats,
      timeRange,
    });
  }),
);

// Redirect aliases for dashboard monitoring
app.get("/admin/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard");
});

app.get("/admin/dashboard", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard");
});

app.get("/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard");
});

app.get("/admin/events/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard");
});

// Real-time stats API for dashboard auto-refresh
app.get(
  "/api/dev/stats",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const timeRange = req.query.range || "7d";
    const [pvStats, metrics] = await Promise.all([
      db.getPageViewStats(timeRange),
      db.getMetrics(),
    ]);
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;
    return res.json({ pvStats, metrics: { ...metrics, avgLatencyMs } });
  }),
);

// ============== DEV API: Add Admin ==============
app.post(
  "/dev/api/admins/add",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }
    const admins = await db.getAdmins();
    const exists = (admins || []).some((a) => a.username === username);
    if (exists) {
      return res.status(400).json({ error: "Username sudah dipakai" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.addAdmin({ username, passwordHash });
    return res.json({ ok: true, username });
  }),
);

// ============== DEV API: Reset Password ==============
app.post(
  "/dev/api/admins/reset-password",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { username, newPassword } = req.body || {};
    if (!username || !newPassword) {
      return res.status(400).json({ error: "Username dan password baru wajib diisi" });
    }
    const admins = await db.getAdmins();
    const exists = (admins || []).some((a) => a.username === username);
    if (!exists) {
      return res.status(400).json({ error: "Username tidak ditemukan" });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.updateAdminPassword(username, passwordHash);
    return res.json({ ok: true, username });
  }),
);

// ============== DEV API: Delete Admin ==============
app.post(
  "/dev/api/admins/delete",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Username wajib diisi" });
    }
    await db.deleteAdmin(username);
    return res.json({ ok: true });
  }),
);

// ============== DEV API: Get Admin Statuses (for real-time refresh) ==============
app.get(
  "/dev/api/admins/statuses",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [adminStatuses, admins] = await Promise.all([
      db.getAdminStatuses(),
      db.getAdmins(),
    ]);
    return res.json({ admins: admins || [], adminStatuses });
  }),
);

// Events management
app.get(
  "/admin/events",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const events = await db.getEvents();
    return res.render("events", { events });
  }),
);

app.get("/admin/events/new", ensureAuth, (req, res) => {
  return res.render("form", { event: null, error: req.query.error || null });
});

app.post(
  "/admin/events/new",
  ensureAuth,
  uploadPoster,
  asyncHandler(async (req, res) => {
    const { title, day, time, location, googleForm } = req.body;

    let poster = "";
    if (req.file) {
      try {
        const processed = await processPosterImage(req.file.buffer);
        poster = await savePosterFile(processed);
      } catch (err) {
        console.error("[Poster] Gagal memproses gambar:", err.message);
        const message = "Gagal memproses gambar poster. Pastikan file adalah gambar yang valid.";
        return res.redirect(`/admin/events/new?error=${encodeURIComponent(message)}`);
      }
    }

    const event = {
      id: crypto.randomUUID(),
      title,
      day,
      time,
      location,
      poster,
      googleForm,
    };
    await db.addEvent(event);
    invalidateEventsCache();
    res.redirect("/admin/events");
  }),
);

app.get(
  "/admin/events/:id/edit",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const event = await db.getEvent(req.params.id);
    if (!event) return res.status(404).send("Not found");
    res.render("form", { event, error: req.query.error || null });
  }),
);

app.post(
  "/admin/events/:id/edit",
  ensureAuth,
  uploadPoster,
  asyncHandler(async (req, res) => {
    const { title, day, time, location, googleForm } = req.body;
    const patch = { title, day, time, location, googleForm };

    if (req.file) {
      try {
        const processed = await processPosterImage(req.file.buffer);
        patch.poster = await savePosterFile(processed);
      } catch (err) {
        console.error("[Poster] Gagal memproses gambar:", err.message);
        const message = "Gagal memproses gambar poster. Pastikan file adalah gambar yang valid.";
        return res.redirect(`/admin/events/${req.params.id}/edit?error=${encodeURIComponent(message)}`);
      }
    }

    await db.updateEvent(req.params.id, patch);
    invalidateEventsCache();
    res.redirect("/admin/events");
  }),
);

app.post(
  "/admin/api/events/delete",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing event id" });
    const ev = await db.getEvent(id);
    if (!ev) return res.status(404).json({ error: "Event not found" });
    await db.deleteEvent(id);
    invalidateEventsCache();
    return res.json({ ok: true });
  }),
);

// Documentation
app.get(
  "/admin/documentation",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const events = await db.getEvents();
    return res.render("documentation", { events });
  }),
);

app.post(
  "/admin/api/documentation/add",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const { eventId, driveLink } = req.body || {};
    if (!eventId || !driveLink) return res.status(400).json({ error: "Missing eventId or driveLink" });
    const ev = await db.getEvent(eventId);
    if (!ev) return res.status(404).json({ error: "Event not found" });
    await db.updateEvent(eventId, { driveLink });
    return res.json({ ok: true });
  }),
);

// Create admin (from dashboard)
app.get("/admin/admins/new", ensureAuth, (req, res) => {
  return res.render("create-admin", { error: null });
});

app.post(
  "/admin/admins/new",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).render("create-admin", { error: "Username dan password wajib diisi" });
    }
    const admins = await db.getAdmins();
    const exists = (admins || []).some((a) => a.username === username);
    if (exists) {
      return res.status(400).render("create-admin", { error: "Username sudah dipakai" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.addAdmin({ username, passwordHash });
    return res.redirect("/admin/events");
  }),
);

// Redirect root admin to login
app.get("/admin", (req, res) => res.redirect("/admin/login"));

// ============== SPEED INSIGHTS API ==============
app.get(
  "/api/dev/speed-insights",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const timeRange = req.query.range || "7d";
    const data = await getSpeedInsightsData(timeRange);
    return res.json(data);
  }),
);

app.get("/api/dev/speed-insights/status", ensureDevAuth, (req, res) => {
  const token = process.env.VERCEL_TOKEN || "";
  const projectId = process.env.VERCEL_PROJECT_ID || "";
  return res.json({
    configured: !!(token && projectId),
    hasToken: !!token,
    hasProjectId: !!projectId,
  });
});

// ============== 404 HANDLER (route tidak ditemukan) ==============
app.use((req, res) => {
  res.status(404).send("Halaman tidak ditemukan.");
});

// ============== GLOBAL ERROR HANDLER ==============
// Ini "jaring pengaman" terakhir: setiap error yang di-throw/reject di asyncHandler
// manapun akan berakhir di sini, sehingga response SELALU dikirim (tidak pernah
// menggantung tanpa jawaban ke browser).
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send("Terjadi kesalahan pada server. Silakan coba lagi nanti.");
});

// ============== EXPORT (for Vercel) ==============
module.exports = app;
// getMetricRating tetap bisa diakses tanpa menimpa export utama (app) di atas
module.exports.getMetricRating = getMetricRating;

// Only listen when run directly (not on Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
  });
}