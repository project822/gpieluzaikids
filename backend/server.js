// Load .env file first (jika ada) untuk development lokal
require("dotenv").config();

// Gunakan Google DNS untuk resolve hostname MongoDB Atlas (karena DNS internal
// sering memblokir query SRV ke mongodb.net). Hanya berlaku untuk proses Node ini.
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

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
const ADMIN_DIR = path.join(projectRoot, "admin");

// Fallback jika path tidak ditemukan di process.cwd() (sama seperti fallback
// untuk viewsDir di bawah -- process.cwd() kadang tidak menunjuk ke project
// root yang sebenarnya di lingkungan serverless Vercel, jadi kita cek juga
// relatif ke __dirname sebagai cadangan).
let PUBLIC_ASSETS_DIR = path.join(projectRoot, "frontend", "public");
if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
  const altAssets = path.join(__dirname, "..", "frontend", "public");
  if (fs.existsSync(altAssets)) {
    PUBLIC_ASSETS_DIR = altAssets;
  }
}
// CATATAN: Poster tidak lagi disimpan ke filesystem (tidak kompatibel dengan
// Vercel serverless yang read-only). Sebagai gantinya, poster disimpan sebagai
// Buffer di dalam dokumen event MongoDB (field posterData).
// Route /api/events/:id/poster melayani image langsung dari DB.

// Fallback jika path tidak ditemukan di process.cwd()
let viewsDir = PUBLIC_VIEWS_DIR;
if (!fs.existsSync(path.join(viewsDir, "index.ejs"))) {
  const altViews = path.join(__dirname, "..", "frontend", "views");
  if (fs.existsSync(path.join(altViews, "index.ejs"))) {
    viewsDir = altViews;
  }
}

// Fallback untuk admin views (per feature)
let adminViewsDir = ADMIN_DIR;
if (!fs.existsSync(path.join(adminViewsDir, "login", "admin-login.ejs"))) {
  const altAdmin = path.join(__dirname, "..", "admin");
  if (fs.existsSync(path.join(altAdmin, "login", "admin-login.ejs"))) {
    adminViewsDir = altAdmin;
  }
}

// Fallback untuk dashboard views & assets (per feature)
const DASHBOARD_DIR = path.join(projectRoot, "dashboard");

let dashboardDir = DASHBOARD_DIR;
if (!fs.existsSync(dashboardDir)) {
  const altDashboard = path.join(__dirname, "..", "dashboard");
  if (fs.existsSync(altDashboard)) {
    dashboardDir = altDashboard;
  }
}
const dashboardSharedDir = path.join(dashboardDir, "shared");

// ============== SECURITY MIDDLEWARE ==============
app.use((req, res, next) => {
  // Security headers — semua zero-overhead, hanya header HTTP
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS: paksa HTTPS selama 2 tahun (termasuk subdomain, preload-ready)
  // Nol overhead — hanya satu baris header.
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  // CSP: cegah XSS dengan membatasi sumber script/style/font/image
  // 'unsafe-inline' diperlukan untuk Vercel Analytics inline script + style
  // yang dipasang oleh header.ejs. Setelah semua script dipindah ke file
  // eksternal, ganti 'unsafe-inline' dengan nonce.
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://vitals.vercel-insights.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https://maps.googleapis.com https://www.google.com",
      "connect-src 'self' https://vitals.vercel-insights.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  next();
});

// ============== INPUT SANITIZATION ==============
// Cegah stored XSS: strip tag HTML dari semua input teks yang dikirim user.
// Ini lapisan pertahanan tambahan selain auto-escaping EJS (<%= %>).
// Overhead minimal — regex sederhana, hanya jalan untuk POST/PUT/PATCH.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        // Hapus tag HTML (tapi biarkan teks di dalamnya)
        req.body[key] = req.body[key].replace(/<[^>]*>/g, "");
      }
    }
  }
  next();
});

// ============== EXPRESS SETUP ==============
app.set("view engine", "ejs");
app.set("views", [viewsDir, dashboardDir, adminViewsDir, dashboardSharedDir]);

// Gzip compression for all responses
app.use(compression());

app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(
  express.static(PUBLIC_ASSETS_DIR, {
    maxAge: "7d",
    immutable: true,
    setHeaders: (res, filePath) => {
      // Aset statis (logo, ikon) aman di-cache lama di browser -> kunjungan berikutnya
    // tidak perlu download ulang. Poster event tidak lagi disajikan lewat sini
    // (sekarang via /api/events/:id/poster dari MongoDB).
      if (/\.(css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// CSS dan aset halaman admin (disajikan dari folder admin)
app.use(
  "/admin-assets",
  express.static(path.join(projectRoot, "admin"))
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
// Fallback: kalau MONGO_URI belum di-set, pakai MemoryStore supaya server
// tetap bisa jalan untuk development/testing.

let sessionStore;
if (!process.env.MONGO_URI) {
  console.error(
    "[Session] WARN: MONGO_URI belum di-set. Fallback ke MemoryStore. Login tidak akan " +
      "persisten di Vercel serverless. Set MONGO_URI untuk production.",
  );
  sessionStore = new session.MemoryStore();
} else {
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

  try {
    sessionStore = MongoStore.create({
      clientPromise: db.getClient(),
      dbName: process.env.MONGO_DB_NAME || "gereja",
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 hari (detik)
    });

    sessionStore.on("error", (err) => {
      console.error("[SessionStore] Error:", err.message);
    });
  } catch (err) {
    console.error("[Session] Gagal membuat MongoStore:", err.message);
    console.error("[Session] Fallback ke MemoryStore.");
    sessionStore = new session.MemoryStore();
  }
}

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

// ============== CSRF PROTECTION ==============
// Session-based CSRF token: simpan token di session, validasi setiap
// POST/PUT/DELETE request. Untuk form HTML dicek via body._csrf,
// untuk fetch/API dicek via header X-CSRF-Token.
// Login routes dikecualikan karena session belum ada.
// Login routes & dashboard APIs dikecualikan:
// - Login: session belum ada
// - Dashboard APIs: sudah terproteksi ensureDevAuth + sameSite:lax cookie
const CSRF_EXEMPT_PATHS = [
  "/admin/login", "/dev/login", "/login", "/dev/dashboard-mobile",
  "/api/dev/", "/dev/api/", "/api/events/"
];

app.use((req, res, next) => {
  // Generate token jika belum ada
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomUUID();
  }

  // Ekspos token ke semua view via res.locals
  res.locals.csrfToken = req.session.csrfToken;

  // Cuma validasi untuk method yang mengubah state
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

  // Skip untuk login paths (session belum exist)
  const isExempt = CSRF_EXEMPT_PATHS.some((p) => req.path === p || req.path.startsWith(p + "/"));
  if (isExempt) return next();

  // Baca token dari body (form) atau header (fetch/API)
  const tokenFromBody = req.body && req.body._csrf;
  const tokenFromHeader = req.headers["x-csrf-token"];
  const submitted = tokenFromBody || tokenFromHeader;

  if (!submitted || submitted !== req.session.csrfToken) {
    // Untuk request API (JSON), balik JSON error
    if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
      return res.status(403).json({ error: "CSRF token tidak valid. Refresh halaman dan coba lagi." });
    }
    // Untuk form submission, redirect back
    return res.status(403).send("CSRF token tidak valid. Refresh halaman dan coba lagi.");
  }

  next();
});

  // Multer for file uploads
  // Pakai memoryStorage: file masuk sebagai buffer di req.file.buffer,
  // supaya bisa diproses (crop 4:5 + resize + convert WebP) via sharp
  // SEBELUM ditulis ke disk. Ini menghindari nyimpen file mentah yang
  // besar/berat, sekaligus jadi tempat kita validasi ukuran & tipe file.
  const MAX_POSTER_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
  const POSTER_WIDTH = 720;
  const POSTER_HEIGHT = 900; // rasio 4:5, ukuran moderat (tidak perlu lebih besar untuk web)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POSTER_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    // Hanya izinkan format gambar yang spesifik: JPEG, PNG, WebP
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExts = /\.(jpe?g|png|webp)$/i;
    
    if (!file.mimetype || !allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Format file tidak didukung. Hanya JPG, PNG, dan WebP yang diperbolehkan."));
    }
    
    // Cek juga ekstensi file sebagai lapisan validasi tambahan
    const originalName = file.originalname || "";
    if (!allowedExts.test(originalName)) {
      return cb(new Error("Ekstensi file tidak didukung. Hanya .jpg, .jpeg, .png, dan .webp yang diperbolehkan."));
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

// Crop ke rasio 4:5 (cover, fokus otomatis ke area paling "menarik" biar tidak
// asal potong tengah), resize ke ukuran moderat, lalu convert ke WebP.
async function processPosterImage(buffer) {
  try {
    return await sharp(buffer)
      .rotate() // auto-orient sesuai EXIF (foto dari HP kadang kesimpen miring)
      .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (attentionErr) {
    // Fallback: jika attention crop gagal (misal libvips versi lawas / gambar tertentu),
    // pakai center crop sebagai cadangan yang lebih stabil.
    try {
      return await sharp(buffer)
        .rotate()
        .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (centerErr) {
      // Jika masih gagal, coba tanpa resize sama sekali — cukup konversi ke WebP
      try {
        return await sharp(buffer)
          .rotate()
          .webp({ quality: 80 })
          .toBuffer();
      } catch (finalErr) {
        throw new Error(
          "Sharp gagal memproses gambar: " + finalErr.message +
          " (attention: " + attentionErr.message + ")"
        );
      }
    }
  }
}

// Poster sekarang disimpan via MongoDB — lihat fungsi di bawah yang
// menghasilkan URL yang bisa dipakai di <img src="..."> untuk mengambil
// image langsung dari database.
function posterUrl(eventId) {
  return `/api/events/${eventId}/poster`;
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
  // Strip posterData dari cache (tidak perlu binary di memory server,
  // cukup URL string-nya saja).
  eventsCache = { data: events.map(({ posterData, ...rest }) => rest), expiresAt: now + EVENTS_CACHE_TTL_MS };
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
    // Strip binary poster data from JSON response
    const { posterData, ...safe } = event;
    res.json(safe);
  }),
);

// ============== SERVE POSTER IMAGE FROM MONGODB ==============
// Poster tidak lagi disimpan di filesystem (tidak bisa di Vercel serverless).
// Image diambil langsung dari field posterData (Buffer) di dokumen event.
app.get(
  "/api/events/:id/poster",
  asyncHandler(async (req, res) => {
    const event = await db.getEvent(req.params.id);
    if (!event || !event.posterData) {
      return res.status(404).send("Poster not found");
    }
    // posterData bisa berupa Buffer atau BSON Binary — keduanya punya .buffer
    const buf = Buffer.isBuffer(event.posterData)
      ? event.posterData
      : event.posterData.buffer;
    if (!buf || buf.length === 0) {
      return res.status(404).send("Poster not found");
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", buf.length);
    return res.send(buf);
  }),
);

// ============== ADMIN ROUTES (prefix /admin) ==============

// Login (canonical: /admin/login)
app.get("/admin/login", (req, res) => res.render("login/admin-login", { error: null }));

const handleAdminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const admins = await db.getAdmins();
  const admin = (admins || []).find((a) => a.username === username);
  if (!admin) {
    return res.render("login/admin-login", { error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.render("login/admin-login", { error: "Invalid credentials" });
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
  const redirectTo = req.query.redirect || "/dev/login";
  req.session.destroy(() => {
    if (username) {
      db.setAdminOffline(username).catch((e) => {
        console.error("[Logout] setAdminOffline gagal:", e.message);
      });
    }
    res.redirect(redirectTo);
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
  return res.render("login/login", { error: null });
});

app.post("/dev/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "dev" && password === "dev123") {
    req.session.devUser = { username: "dev" };
    const redirectTo = req.session.redirectTo || "/dev/dashboard-desktop";
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  } else {
    return res.render("login/login", { error: "Username atau password developer salah." });
  }
});

// ============== DEV DASHBOARD DESKTOP PAGES ==============
// Halaman sidebar (Overview, Analytics, Monitoring, Admins) masing-masing punya view & route sendiri.
// Route /dev/dashboard dialihkan ke /dev/dashboard-desktop untuk backward compatibility.

app.get("/dev/dashboard", (req, res) => res.redirect("/dev/dashboard-desktop"));
app.get("/dev/dashboard/analytics", (req, res) => res.redirect("/dev/dashboard-desktop/analytics"));
app.get("/dev/dashboard/monitoring", (req, res) => res.redirect("/dev/dashboard-desktop/monitoring"));
app.get("/dev/dashboard/admins", (req, res) => res.redirect("/dev/dashboard-desktop/admins"));
app.get("/dev/dashboard/landing", (req, res) => res.redirect("/dev/dashboard-desktop/landing"));
app.get("/dev/dashboard/health", (req, res) => res.redirect("/dev/dashboard-desktop/health"));
app.get("/dev/dashboard/maintenance", (req, res) => res.redirect("/dev/dashboard-desktop/maintenance"));
app.get("/dev/dashboard/security", (req, res) => res.redirect("/dev/dashboard-desktop/security"));

app.get(
  "/dev/dashboard-desktop",
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

    return res.render("overview/overview", {
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
  "/dev/dashboard-desktop/analytics",
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

    return res.render("analytics/analytics", {
      avgLatencyMs,
      pvStats,
      timeRange,
    });
  }),
);

app.get(
  "/dev/dashboard-desktop/monitoring",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const metrics = await db.getMetrics();
    const avgLatencyMs = metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;

    return res.render("monitoring/monitoring", {
      metrics,
      avgLatencyMs,
    });
  }),
);

app.get(
  "/dev/dashboard-desktop/admins",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [adminStatuses, admins] = await Promise.all([
      db.getAdminStatuses(),
      db.getAdmins(),
    ]);

    return res.render("admins/admins", {
      admins: admins || [],
      adminStatuses,
    });
  }),
);

// Redirect aliases for dashboard monitoring
app.get("/admin/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard-desktop");
});

app.get("/admin/dashboard", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard-desktop");
});

app.get("/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard-desktop");
});

app.get("/admin/events/dashboard-monitoring", ensureDevAuth, (req, res) => {
  return res.redirect("/dev/dashboard-desktop");
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
    return res.render("events/events", { events });
  }),
);

app.get("/admin/events/new", ensureAuth, (req, res) => {
  return res.render("events/form", { event: null, error: req.query.error || null });
});

app.post(
  "/admin/events/new",
  ensureAuth,
  uploadPoster,
  asyncHandler(async (req, res) => {
    const { title, day, time, location, googleForm } = req.body;
    const eventId = crypto.randomUUID();

    let poster = "";
    let posterData = null;
    if (req.file) {
      try {
        posterData = await processPosterImage(req.file.buffer);
        poster = posterUrl(eventId);
      } catch (err) {
        console.error("[Poster] Gagal memproses gambar:", err.message);
        console.error("[Poster] Stack:", err.stack);
        const message = "Gagal memproses gambar poster. Detail: " + encodeURIComponent(err.message);
        return res.redirect(`/admin/events/new?error=${message}`);
      }
    }

    const event = {
      id: eventId,
      title,
      day,
      time,
      location,
      poster,
      posterData,
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
    res.render("events/form", { event, error: req.query.error || null });
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
        patch.posterData = processed;
        patch.poster = posterUrl(req.params.id);
      } catch (err) {
        console.error("[Poster] Gagal memproses gambar:", err.message);
        console.error("[Poster] Stack:", err.stack);
        const message = "Gagal memproses gambar poster. Detail: " + encodeURIComponent(err.message);
        return res.redirect(`/admin/events/${req.params.id}/edit?error=${message}`);
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
    return res.render("documentation/documentation", { events });
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

// Admin panel at /admin — render login page directly (canonical route)
app.get("/admin", (req, res) => res.render("login/admin-login", { error: null }));

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

// ============== SPEED INSIGHTS MONTHLY SNAPSHOT ==============
// Ambil snapshot performa saat ini dan simpan ke MongoDB untuk history.
// Bisa dipanggil manual dari dashboard atau via cron job eksternal.
app.post(
  "/api/dev/speed-insights/scan",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const data = await getSpeedInsightsData("30d");
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const snapshot = await db.saveSpeedInsightsSnapshot(data);
    return res.json({ ok: true, label: snapshot.label, summary: snapshot.summary });
  }),
);

// Ambil history snapshot
app.get(
  "/api/dev/speed-insights/snapshots",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const snapshots = await db.getSpeedInsightsSnapshots({ limit: 12 });
    return res.json({ snapshots });
  }),
);

// Cek kapan snapshot terakhir diambil
app.get(
  "/api/dev/speed-insights/last-scan",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const label = await db.getLatestSnapshotLabel();
    return res.json({ label });
  }),
);

// ============== DEV DASHBOARD: MOBILE V2 ==============
// Halaman mobile dengan 5 tab: Home, Overview, System, Monitoring, Account
// Route ini STANDALONE — punya login sendiri, tidak perlu redirect ke /dev/login.
app.get(
  "/dev/dashboard-mobile",
  (req, res) => {
    // Jika sudah login, tampilkan dashboard
    if (req.session && req.session.devUser) {
      const user = req.session.devUser.username;
      return res.render("dashboard-mobile/dashboard-mobile", { user });
    }
    // Jika belum login, tampilkan form login langsung di halaman yang sama
    return res.render("login/login", { error: null, actionUrl: "/dev/dashboard-mobile" });
  },
);

app.post(
  "/dev/dashboard-mobile",
  (req, res) => {
    const { username, password } = req.body || {};
    if (username === "dev" && password === "dev123") {
      req.session.devUser = { username: "dev" };
      return res.redirect("/dev/dashboard-mobile");
    }
    return res.render("login/login", {
      error: "Username atau password salah.",
      actionUrl: "/dev/dashboard-mobile",
    });
  },
);

// ============== GOOGLE PAGE SPEED INSIGHTS API ==============
// Proxy ke Google PageSpeed Insights API dengan proteksi API key dari DB
app.get(
  "/api/dev/pagespeed",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const url = req.query.url || "https://gpieluzaikids.vercel.app";
    const strategy = req.query.strategy || "mobile";
    const locale = req.query.locale || "id-ID";

    // Cari API key: environment variable > DB config
    let apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || "";
    if (!apiKey) {
      try {
        const config = await db.getPageSpeedConfig();
        apiKey = config.apiKey || "";
      } catch (_) {}
    }

    if (!apiKey) {
      return res.json({ error: "Google PageSpeed API key belum dikonfigurasi. Set GOOGLE_PAGESPEED_API_KEY di environment variable atau di halaman konfigurasi." });
    }

    try {
      const https = require("https");
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${encodeURIComponent(apiKey)}&strategy=${encodeURIComponent(strategy)}&locale=${encodeURIComponent(locale)}`;

      const response = await new Promise((resolve, reject) => {
        https.get(psiUrl, (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error("Failed to parse PSI response")); }
          });
        }).on("error", reject);
      });

      return res.json(response);
    } catch (err) {
      return res.json({ error: err.message || "Gagal mengambil data PageSpeed Insights" });
    }
  }),
);

// Get PageSpeed config status
app.get(
  "/api/dev/pagespeed/config",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const envKey = process.env.GOOGLE_PAGESPEED_API_KEY || "";
    let dbConfig = { apiKey: "" };
    try {
      dbConfig = await db.getPageSpeedConfig();
    } catch (_) {}

    const hasApiKey = !!(envKey || dbConfig.apiKey);
    return res.json({
      configured: hasApiKey,
      source: envKey ? "env" : (dbConfig.apiKey ? "db" : "none"),
    });
  }),
);

// Save PageSpeed API key to DB
app.post(
  "/api/dev/pagespeed/config",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const { apiKey } = req.body || {};
    await db.savePageSpeedConfig({ apiKey: apiKey || "" });
    return res.json({ ok: true });
  }),
);

// ============== DASHBOARD LANDING PAGE ==============
// Halaman utama dashboard — ringkasan sistem dengan status banner,
// statistik real-time, online admins, dan quick actions.
app.get(
  "/dev/dashboard-desktop/landing",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    return res.render("dashboard-landing/dashboard", {});
  }),
);

// Health Check page
app.get(
  "/dev/dashboard-desktop/health",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    return res.render("health/health", {});
  }),
);

// Maintenance page
app.get(
  "/dev/dashboard-desktop/maintenance",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const maintenanceMode = await db.getMaintenanceMode();
    return res.render("maintenance/maintenance", { maintenanceMode });
  }),
);

// Security page
app.get(
  "/dev/dashboard-desktop/security",
  ensureDevAuth,
  asyncHandler(async (req, res) => {
    const [secStats, secLogs, blockedIps] = await Promise.all([
      db.getSecurityStats(),
      db.getSecurityLogs({ limit: 50 }),
      db.getBlockedIps(),
    ]);
    return res.render("security/security", { secStats, secLogs, blockedIps });
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
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Desktop dashboard: http://localhost:${PORT}/dev/dashboard-desktop`);
  });
}