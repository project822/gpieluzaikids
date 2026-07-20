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

// PENTING: Vercel (dan hampir semua platform serverless/hosting modern)
// jalan di belakang proxy/edge network -> koneksi asli dari browser ke
// Vercel memang HTTPS, tapi permintaan yang diterima Express DI DALAM
// function sebenarnya proxied secara internal. Tanpa "trust proxy":
// - req.protocol/req.secure bisa salah baca (pengaruh ke cookie `secure`)
// - req.ip bisa kebaca sebagai IP proxy, BUKAN IP asli pengunjung
//   (bikin rate-limiter login jadi keliru: request dari banyak orang
//   berbeda bisa dianggap satu IP yang sama -> bisa salah nge-block).
app.set("trust proxy", 1);

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
const ADMIN_VIEWS_DIR = path.join(projectRoot, "admin");
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
  const altAdmin = path.join(__dirname, "..", "admin");
  if (fs.existsSync(path.join(altAdmin, "login.ejs"))) {
    adminViewsDir = altAdmin;
  }
}

// Fallback untuk dashboard views & assets
const DASHBOARD_DIR = path.join(projectRoot, "dashboard");
const DASHBOARD_VIEWS_DIR = path.join(DASHBOARD_DIR, "views");

let dashboardDir = DASHBOARD_DIR;
if (!fs.existsSync(DASHBOARD_VIEWS_DIR)) {
  const altDashboard = path.join(__dirname, "..", "dashboard");
  if (fs.existsSync(altDashboard)) {
    dashboardDir = altDashboard;
  }
}
const dashboardViewsDir = path.join(dashboardDir, "views");

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
app.set("views", [viewsDir, adminViewsDir, dashboardViewsDir]);

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

// CSS dan aset halaman-halaman dev dashboard (disajikan dari folder dashboard)
app.use(
  "/dashboard-assets",
  express.static(dashboardDir)
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

const sessionStore = MongoStore.create({
  // Pakai ulang koneksi MongoDB yang sama dengan sisa aplikasi (bukan
  // bikin koneksi baru terpisah lewat mongoUrl) -> lebih hemat & lebih
  // stabil, terutama saat cold start di serverless (Vercel).
  clientPromise: db.getClient(),
  dbName: process.env.MONGO_DB_NAME || "gereja",
  collectionName: "sessions",
  ttl: 14 * 24 * 60 * 60, // 14 hari (detik)
});

// Supaya kalau session gagal disimpan/dibaca (mis. koneksi Mongo bermasalah),
// itu KELIHATAN di log -> bukan gagal diam-diam yang bikin user "ke-bounce"
// balik ke halaman login tanpa pesan error apapun.
sessionStore.on("error", (err) => {
  console.error("[SessionStore] Error:", err.message);
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this-admin",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari (ms)
      httpOnly: true,
      // 'auto': Secure flag otomatis nyala kalau request asli-nya HTTPS
      // (terdeteksi lewat req.secure, akurat sekarang berkat trust proxy
      // di atas), tanpa bergantung env var NODE_ENV yang bisa saja tidak
      // ke-set persis "production" di semua situasi deploy.
      secure: "auto",
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

// ============== MAINTENANCE MODE MIDDLEWARE ==============
// Intercept semua request ke halaman publik ketika maintenance aktif.
// /admin/*, /dev/*, /api/*, dan aset statis tetap melewati middleware ini.
app.use(asyncHandler(async (req, res, next) => {
  // Lewati untuk jalur non-publik
  const bypass = ["/admin", "/dev", "/api", "/dashboard-assets", "/_vercel"];
  if (bypass.some((p) => req.path.startsWith(p))) return next();

  // Lewati aset statis (favicon, css, js, images)
  if (/\.(css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(req.path)) return next();

  let maintenance;
  try {
    maintenance = await db.getMaintenanceMode();
  } catch (_) {
    // Kalau DB gagal, jangan blokir user — lanjut saja
    return next();
  }

  if (!maintenance || !maintenance.enabled) return next();

  // Render halaman maintenance
  return res.status(503).send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Website Sedang Dalam Perbaikan</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,sans-serif;background:#0F172A;color:#E2E8F0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
    .wrap{text-align:center;max-width:440px;}
    .icon{font-size:48px;margin-bottom:20px;}
    h1{font-size:22px;font-weight:800;color:#F1F5F9;margin-bottom:12px;}
    p{font-size:14px;color:#94A3B8;line-height:1.65;margin-bottom:20px;}
    small{font-size:12px;color:#475569;}
    .badge{display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(217,119,6,0.15);border:1px solid rgba(217,119,6,0.3);color:#D97706;font-size:11px;font-weight:700;letter-spacing:0.04em;margin-bottom:24px;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">🔧</div>
    <div class="badge">UNDER MAINTENANCE</div>
    <h1>Website Sedang Dalam Perbaikan</h1>
    <p>${maintenance.message || "Website sedang dalam perbaikan. Silakan kembali lagi nanti."}</p>
    <small>— Tim gpieluzaikids</small>
  </div>
</body>
</html>`);
}));

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
  return res.render(path.join(dashboardViewsDir, "login"), { error: null });
});

app.post("/dev/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "dev" && password === "dev123") {
    req.session.devUser = { username: "dev" };
    const redirectTo = req.session.redirectTo || "/dev/dashboard";
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  } else {
    return res.render(path.join(dashboardViewsDir, "login"), { error: "Username atau password developer salah." });
  }
});

// ============== DEV DASHBOARD PAGES ==============
// Halaman sidebar (Overview, Analytics, Monitoring, Admins) masing-masing punya view & route sendiri.

app.get(
  "/dev/dashboard",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const timeRange = req.query.range || "7d";
    const [metrics, admins, pvStats, maintenanceMode] = await Promise.all([
      db.getMetrics(),
      db.getAdmins(),
      db.getPageViewStats(timeRange),
      db.getMaintenanceMode(),
    ]);
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;

    return res.render("overview", {
      metrics,
      avgLatencyMs,
      admins: admins || [],
      pvStats,
      timeRange,
      maintenanceMode: maintenanceMode || { enabled: false },
    });
  }),
);

app.get(
  "/dev/dashboard/analytics",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const timeRange = req.query.range || "7d";
    const [metrics, pvStats] = await Promise.all([
      db.getMetrics(),
      db.getPageViewStats(timeRange),
    ]);
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;

    return res.render("analytics", {
      avgLatencyMs,
      pvStats,
      timeRange,
    });
  }),
);

app.get(
  "/dev/dashboard/monitoring",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const metrics = await db.getMetrics();
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;

    return res.render("monitoring", {
      metrics,
      avgLatencyMs,
    });
  }),
);

app.get(
  "/dev/dashboard/admins",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [adminStatuses, admins] = await Promise.all([
      db.getAdminStatuses(),
      db.getAdmins(),
    ]);

    return res.render("admins", {
      admins: admins || [],
      adminStatuses,
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

// ============== DEV API: Force Logout a specific admin ==============
app.post(
  "/dev/api/admins/force-logout",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Username wajib diisi" });
    }
    const deleted = await db.forceLogoutAdmin(username);
    return res.json({ ok: true, username, sessionsDeleted: deleted });
  }),
);

// ============== DEV API: Force Logout ALL admins ==============
app.post(
  "/dev/api/admins/force-logout-all",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const total = await db.forceLogoutAllAdmins();
    return res.json({ ok: true, sessionsDeleted: total });
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

app.get("/api/dev/speed-insights/status", ensureDevAuth, asyncHandler(async (req, res) => {
  // Check environment variables first, then fallback to DB config
  const envToken = process.env.VERCEL_TOKEN || "";
  const envProjectId = process.env.VERCEL_PROJECT_ID || "";
  
  // Try to get stored config from DB
  let dbConfig = { vercelToken: "", vercelProjectId: "" };
  try {
    dbConfig = await db.getSpeedInsightsConfig();
  } catch (_) {}
  
  const token = envToken || dbConfig.vercelToken;
  const projectId = envProjectId || dbConfig.vercelProjectId;
  
  return res.json({
    configured: !!(token && projectId),
    hasToken: !!token,
    hasProjectId: !!projectId,
    source: envToken ? "env" : (dbConfig.vercelToken ? "db" : "none"),
  });
}));

// ============== SPEED INSIGHTS CONFIG API (save tokens to DB) ==============
app.post(
  "/api/dev/speed-insights/config",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { vercelToken, vercelProjectId } = req.body || {};
    await db.saveSpeedInsightsConfig({
      vercelToken: vercelToken || "",
      vercelProjectId: vercelProjectId || "",
    });
    return res.json({ ok: true });
  }),
);

app.get(
  "/api/dev/speed-insights/config",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const config = await db.getSpeedInsightsConfig();
    // Never expose full token - show only masked version
    const maskedToken = config.vercelToken
      ? config.vercelToken.substring(0, 4) + "••••" + config.vercelToken.substring(config.vercelToken.length - 4)
      : "";
    return res.json({
      vercelToken: config.vercelToken ? maskedToken : "",
      hasToken: !!config.vercelToken,
      vercelProjectId: config.vercelProjectId,
      updatedAt: config.updatedAt,
    });
  }),
);

// ============== DEV DASHBOARD: NEW PAGES ==============

// ============== DASHBOARD LANDING PAGE ==============
// Halaman utama dashboard — ringkasan sistem dengan status banner,
// statistik real-time, online admins, dan quick actions.
app.get(
  "/dev/dashboard/landing",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    return res.render("dashboard", {});
  }),
);

// Health Check page
app.get(
  "/dev/dashboard/health",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    return res.render("health", {});
  }),
);

// Maintenance page
app.get(
  "/dev/dashboard/maintenance",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const maintenanceMode = await db.getMaintenanceMode();
    return res.render("maintenance", { maintenanceMode });
  }),
);

// Security page
app.get(
  "/dev/dashboard/security",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [secStats, secLogs, blockedIps] = await Promise.all([
      db.getSecurityStats(),
      db.getSecurityLogs({ limit: 50 }),
      db.getBlockedIps(),
    ]);
    return res.render("security", { secStats, secLogs, blockedIps });
  }),
);

// ============== DEV API: Health Check ==============
app.get(
  "/api/dev/health",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const mem = process.memoryUsage();
    const memHeapUsedMB  = Math.round(mem.heapUsed  / 1024 / 1024);
    const memHeapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

    // DB ping
    let dbStatus = "ok";
    let dbPingMs = 0;
    let dbError  = null;
    try {
      const t0 = Date.now();
      const client = await db.getClient();
      await client.db().command({ ping: 1 });
      dbPingMs = Date.now() - t0;
    } catch (err) {
      dbStatus = "error";
      dbError  = err.message;
    }

    // Metrics
    let metrics = { totalRequests: 0, totalLatencyMsSum: 0 };
    try { metrics = (await db.getMetrics()) || metrics; } catch (_) {}
    const avgLatencyMs = metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / metrics.totalRequests)
      : 0;

    // Maintenance
    let maintenanceMode = false;
    try {
      const mt = await db.getMaintenanceMode();
      maintenanceMode = mt ? mt.enabled : false;
    } catch (_) {}

    return res.json({
      website: "ok",
      db: dbStatus,
      dbPingMs,
      dbError,
      uptimeSeconds,
      platform: process.platform,
      nodeVersion: process.version,
      memHeapUsedMB,
      memHeapTotalMB,
      totalRequests: metrics.totalRequests || 0,
      avgLatencyMs,
      maintenanceMode,
    });
  }),
);

// ============== DEV API: Maintenance ==============
app.get(
  "/api/dev/maintenance/status",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const mt = await db.getMaintenanceMode();
    return res.json(mt || { enabled: false });
  }),
);

app.post(
  "/api/dev/maintenance",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { enabled, message } = req.body || {};
    await db.setMaintenanceMode({ enabled: Boolean(enabled), message });
    return res.json({ ok: true, enabled: Boolean(enabled) });
  }),
);

// ============== DEV API: Security ==============
app.get(
  "/api/dev/security/stats",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [stats, blockedIps] = await Promise.all([
      db.getSecurityStats(),
      db.getBlockedIps(),
    ]);
    return res.json({ ...stats, blockedIpCount: blockedIps.length });
  }),
);

app.post(
  "/api/dev/security/block-ip",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { ip } = req.body || {};
    if (!ip) return res.status(400).json({ error: "IP address wajib diisi" });
    // Basic IP validation
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const ipv6 = /^[0-9a-fA-F:]{3,39}$/.test(ip);
    if (!ipv4 && !ipv6) return res.status(400).json({ error: "Format IP tidak valid" });

    await db.blockIp(ip);
    await db.logSecurityEvent({ type: "blocked_ip", ip, path: "/", detail: "Manually blocked via dashboard" });
    return res.json({ ok: true, ip });
  }),
);

app.post(
  "/api/dev/security/unblock-ip",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { ip } = req.body || {};
    if (!ip) return res.status(400).json({ error: "IP address wajib diisi" });
    await db.unblockIp(ip);
    return res.json({ ok: true, ip });
  }),
);

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