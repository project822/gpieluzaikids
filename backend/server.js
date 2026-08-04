// ============================================================
// GPI ELUZAI KIDS — Backend (Node.js + Express)
// ------------------------------------------------------------
// Struktur:
//   backend/   -> server.js, store.js (MongoDB + fallback JSON), rateLimit.js
//   frontend/  -> halaman publik + panel admin (admin.html) + login (login.html)
//   database/  -> fallback file JSON
//
// Jalankan: npm start   lalu buka http://localhost:10085
// Login admin: http://localhost:10085/admin/login
// Panel admin: http://localhost:10085/admin
// ============================================================

require("dotenv").config();

// ---------- DNS fix ----------
// Resolver DNS bawaan Node di sebagian mesin (terutama Windows) gagal
// (ECONNREFUSED) saat lookup SRV MongoDB Atlas, padahal DNS normal berhasil.
// Arahkan resolver ke server DNS publik yang sehat agar koneksi Atlas lancar.
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.error("  ⚠️  Gagal set DNS server:", err.message);
}

const express = require("express");
const session = require("express-session");
const connectMongoModule = require("connect-mongo");
const MongoStore = connectMongoModule.default || connectMongoModule;
const multer = require("multer");
const sharp = require("sharp");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const store = require("./store");
const { rateLimitLogin, recordLoginFailure, clearLoginState } = require("./rateLimit");

const app = express();
const PORT = 10085;

app.set("trust proxy", 1); // WAJIB: agar req.ip & req.secure benar di belakang proxy (PRD NFR-2)

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const DATABASE_DIR = path.join(__dirname, "..", "database");
const IMAGE_DIR = path.join(FRONTEND_DIR, "image");

// Origin yang diizinkan untuk CORS (SECURITY.md §3.1) — whitelist dari env,
// plus semua localhost untuk kemudahan development.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_SECRET =
  process.env.SESSION_SECRET || (global._sessionSecret || (global._sessionSecret = crypto.randomUUID()));
if (!process.env.SESSION_SECRET) {
  console.log("  ⚠️  SESSION_SECRET belum diatur — memakai random UUID (session tidak persisten antar restart).");
}

// ---------- Helper baca database (fallback static) ----------
function readDB(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

// ============================================================
// SECURITY HEADERS — semua route (PRD NFR-1)
// ============================================================
app.use((req, res, next) => {
  // CORS whitelist (SECURITY.md §3.1) — batasi akses API dari domain asing
  const origin = req.headers["origin"];
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; " +
      "img-src 'self' data: blob: https://s.wordpress.com https://api.microlink.io https://image.thum.io; " + // thumbnail event (chain Microlink/thum.io/mshots) + preview banner (blob:)
      "connect-src 'self'; " +
      "frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

// HTTPS redirect (PRD NFR-2) — hanya saat produksi
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (!req.secure) return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    next();
  });
}

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true, limit: "100kb" })); // form login
app.use(express.json({ limit: "100kb" })); // anti DoS via body besar (SECURITY.md §3.4)

// Sanitasi input (PRD NFR-3): strip tag HTML dari string body.
// Dipakai sebagai middleware global & juga untuk field text banner (yang
// di-parse multer SETELAH middleware ini — jadi dipanggil ulang di handler).
function stripHtml(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value;
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      req.body[key] = stripHtml(req.body[key]);
    }
  }
  next();
});

// Session server-side 14 hari (PRD FR-4 + SECURITY.md §3.5)
// MongoStore dipakai saat MongoDB terhubung (tahan lama di serverless),
// fallback MemoryStore bila koneksi belum tersedia. Cookie selalu httpOnly,
// sameSite lax, secure "auto", maxAge 14 hari.
let sessionMiddleware = null;
function getSessionMiddleware() {
  if (sessionMiddleware) return sessionMiddleware;
  let store2 = null;
  const clientPromise = store.getClient();
  if (clientPromise) {
    try {
      store2 = MongoStore.create({
        clientPromise,
        dbName: process.env.MONGODB_DB || "gpi_eluzai_kids",
        collectionName: "sessions",
        ttl: 14 * 24 * 60 * 60,
      });
    } catch (err) {
      console.error("  ⚠️  Gagal buat MongoStore:", err.message);
    }
  }
  if (!store2) store2 = new session.MemoryStore();
  sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store2,
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari
      httpOnly: true,
      secure: "auto",
      sameSite: "lax",
    },
  });
  return sessionMiddleware;
}
app.use((req, res, next) => getSessionMiddleware()(req, res, next));

// ============================================================
// MAINTENANCE MODE & BLOCKED IP (SECURITY.md §3.10) + audit log (§3.11)
// ============================================================
const MAINTENANCE_BYPASS_PREFIXES = ["/admin", "/dev", "/api", "/lib", "/fonts", "/css", "/js", "/image"];

app.use(async (req, res, next) => {
  try {
    // 1) Blocked IP — tolak akses & catat ke audit log
    const blockedIps = await store.getBlockedIps();
    if (blockedIps.includes(req.ip)) {
      store
        .logSecurityEvent({ type: "blocked_ip", ip: req.ip, path: req.path, userAgent: req.headers["user-agent"] })
        .catch(() => {});
      return res.status(403).type("text/plain").send("403 — Akses diblokir.");
    }

    // 2) Maintenance mode — halaman publik 503, admin/dev/api & aset statis tetap jalan
    const mode = await store.getMaintenanceMode();
    if (mode.enabled) {
      const bypass = MAINTENANCE_BYPASS_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"));
      if (!bypass) {
        return res
          .status(503)
          .type("html")
          .send(
            `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>503 — Sedang Perbaikan</title></head>` +
              `<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f8fafc;color:#0f172a">` +
              `<div style="text-align:center;padding:20px"><div style="font-size:3rem">🛠️</div>` +
              `<h1 style="margin:8px 0 4px">503</h1>` +
              `<p style="margin:0;color:#475569">${mode.message || "Website sedang diperbaiki."}</p></div></body></html>`
          );
      }
    }
  } catch (err) {
    console.error("[Security]", err.message);
  }
  next();
});

// ---------- Auth helper ----------
// requireAdmin — untuk API JSON /api/admin/* (termasuk proteksi CSRF, PRD FR-9)
function requireAdmin(req, res, next) {
  if (!(req.session && req.session.user)) {
    return res.status(401).json({ error: "Unauthorized — silakan login sebagai admin" });
  }
  // Proteksi CSRF (PRD FR-9): route login dikecualikan; route admin lain
  // wajib menyertakan header X-CSRF-Token untuk request mutasi.
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (mutating && (!req.session.csrfToken || req.headers["x-csrf-token"] !== req.session.csrfToken)) {
    return res.status(403).json({ error: "CSRF token tidak valid" });
  }
  return next();
}

// ensureAuth — untuk route halaman /admin/*
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    // Heartbeat admin aktif (fire-and-forget)
    store.touchAdminActivity(req.session.user.username).catch((e) => {
      console.error("[AdminHeartbeat]", e.message);
    });
    return next();
  }
  if (req.session) req.session.redirectTo = req.originalUrl;
  return res.redirect("/admin/login");
}

// Proteksi akses langsung ke /admin.html (harus lewat sesi login)
app.get("/admin.html", ensureAuth, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "admin.html"));
});

// Cache-Control untuk aset statis (SECURITY.md §3.13)
// CSS/JS tidak content-hashed → cache pendek + revalidate.
// Font lokal versioned by filename → cache panjang (immutable).
// Gambar (folder image/) tidak content-hashed → cache sedang, hindari immutable.
function staticCacheHeaders(res, filePath) {
  if (/\.(css|js)$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
  } else if (/\.(woff2?|ttf)$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  }
}

// Asset lib (template animasi scroll) dapat diakses via /lib/...
app.use("/lib", express.static(path.join(__dirname, "..", "lib"), { setHeaders: staticCacheHeaders }));

// Font lokal (Hanken Grotesk & Inter) dapat diakses via /fonts/...
app.use("/fonts", express.static(path.join(__dirname, "..", "fonts"), { setHeaders: staticCacheHeaders }));

app.use(express.static(FRONTEND_DIR, { setHeaders: staticCacheHeaders }));

// ---------- Multer (upload banner) — SECURITY.md §3.12 ----------
const upload = multer({
  storage: multer.memoryStorage(), // jangan simpan ke disk (serverless read-only)
  limits: { fileSize: 4 * 1024 * 1024 }, // maks 4MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExts = /\.(jpe?g|png|webp)$/i;
    if (!file.mimetype || !allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Format tidak didukung. Hanya JPG, PNG, WebP."));
    }
    if (!allowedExts.test(file.originalname || "")) {
      return cb(new Error("Ekstensi tidak didukung."));
    }
    cb(null, true);
  },
});

// ============================================================
// API PUBLIK
// ============================================================
app.get("/api/info", async (req, res) => {
  res.json(await store.getInfo());
});

app.get("/api/schedule", async (req, res) => {
  res.json(await store.getSchedule());
});

app.get("/api/classes", async (req, res) => {
  res.json(await store.getList("classes"));
});

app.get("/api/events", (req, res) => {
  const data = readDB("events");
  data ? res.json(data) : res.status(500).json({ error: "Data event tidak tersedia" });
});

// Daftar foto slider dari folder frontend/image/
app.get("/api/images", (req, res) => {
  fs.readdir(IMAGE_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: "Folder image/ tidak ditemukan" });
    const images = files
      .filter((f) => /\\.(png|jpe?g|webp|gif|svg)$/i.test(f))
      .map((name) => ({ name, url: `/image/${encodeURIComponent(name)}` }));
    res.json(images);
  });
});

// Status koneksi database (untuk panel admin)
app.get("/api/status", (req, res) => {
  const isAdmin = !!(req.session && req.session.user);
  res.json({
    db: store.isConnected(),
    admin: isAdmin,
    csrfToken: isAdmin && req.session.csrfToken ? req.session.csrfToken : null,
  });
});

// Daftar banner (metadata saja, tanpa data gambar)
app.get("/api/banners", async (req, res) => {
  const banners = await store.getBanners();
  res.json(banners.map((b) => ({ ...b, imageUrl: `/api/banners/${b.id}/image` })));
});

// Gambar banner
app.get("/api/banners/:id/image", async (req, res) => {
  const banner = await store.getBannerById(req.params.id);
  if (!banner || !banner.image) return res.status(404).json({ error: "Banner tidak ditemukan" });
  const buf = Buffer.isBuffer(banner.image) ? banner.image : Buffer.from(banner.image, "base64");
  res.set("Content-Type", banner.contentType || "image/png");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(buf);
});

// ============================================================
// API ADMIN (perlu login — requireAdmin)
// ============================================================

// Data lengkap untuk mengisi form admin
app.get("/api/admin/data", requireAdmin, async (req, res) => {
  const [info, classes, schedule, banners] = await Promise.all([
    store.getInfo(),
    store.getList("classes"),
    store.getSchedule(),
    store.getBanners(),
  ]);
  res.json({ info, classes, schedule, banners: banners.map((b) => ({ ...b, imageUrl: `/api/banners/${b.id}/image` })) });
});

// Simpan informasi
app.put("/api/admin/info", requireAdmin, async (req, res) => {
  const info = await store.setInfo(req.body || {});
  res.json({ ok: true, info });
});

// Anggota kelas (kelas bersifat tetap — tidak bisa ditambah/dihapus dari admin)
app.post("/api/admin/classes/:id/members", requireAdmin, async (req, res) => {
  const { nama, tanggalLahir } = req.body || {};
  if (!nama || !nama.trim()) return res.status(400).json({ error: "Nama anggota wajib diisi" });
  const member = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    nama: nama.trim(),
    tanggalLahir: (tanggalLahir || "").trim(),
  };
  const saved = await store.addMember(req.params.id, member);
  res.json({ ok: true, member: saved });
});

app.delete("/api/admin/classes/:id/members/:memberId", requireAdmin, async (req, res) => {
  await store.deleteMember(req.params.id, req.params.memberId);
  res.json({ ok: true });
});

// Jadwal (dokumen tunggal: ibadah & latihan)
app.put("/api/admin/schedule", requireAdmin, async (req, res) => {
  const schedule = await store.setSchedule(req.body || {});
  res.json({ ok: true, schedule });
});

// Banner — upload gambar + data
app.post(
  "/api/admin/banners",
  requireAdmin,
  upload.single("image"),
  (req, res) => {
    (async () => {
      // multer mengisi req.body setelah middleware sanitasi global berjalan,
      // jadi strip HTML di sini (PRD NFR-3) sebelum disimpan.
      const judul = stripHtml((req.body && req.body.judul) || "").trim();
      const url = stripHtml((req.body && req.body.url) || "").trim();
      const deskripsi = stripHtml((req.body && req.body.deskripsi) || "");
      if (!judul || !url) return res.status(400).json({ error: "Judul dan URL wajib diisi" });
      if (!req.file) return res.status(400).json({ error: "File gambar banner wajib diunggah" });
      if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: "URL harus diawali http:// atau https://" });
      }

      // Proses ulang gambar dengan sharp (SECURITY.md §3.12):
      // strip metadata EXIF & batasi dimensi, simpan sebagai WebP 80%.
      let image = req.file.buffer;
      let contentType = req.file.mimetype;
      try {
        const processed = await sharp(req.file.buffer)
          .rotate() // hormati orientasi EXIF
          .resize(1280, 720, { fit: "cover", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        image = processed;
        contentType = "image/webp";
      } catch (err) {
        // Bila sharp gagal (file rusak/bukan gambar asli), pakai buffer asli
        // yang sudah lolos validasi mime+ekstensi multer.
        console.error("[Sharp]", err.message);
      }

      const banner = await store.addBanner({
        judul,
        url,
        deskripsi,
        contentType,
        image,
      });
      res.json({ ok: true, banner });
    })().catch((err) => res.status(500).json({ error: err.message }));
  }
);

app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
  await store.deleteBanner(req.params.id);
  res.json({ ok: true });
});

// ---------- Absensi (kehadiran anak per kelas & tanggal) ----------
// Daftar semua data absensi (terbaru dulu)
app.get("/api/admin/attendance", requireAdmin, async (req, res) => {
  const list = await store.getAttendance();
  res.json(list);
});

// Simpan data absensi: { tanggal, kelasId, kelasNama, anggota: [{ id, nama, hadir }] }
app.post("/api/admin/attendance", requireAdmin, async (req, res) => {
  const { tanggal, kelasId, kelasNama, anggota } = req.body || {};
  if (!tanggal || !kelasId || !kelasNama) {
    return res.status(400).json({ error: "Tanggal, kelas wajib diisi" });
  }
  if (!Array.isArray(anggota)) {
    return res.status(400).json({ error: "Data anggota tidak valid" });
  }
  const record = {
    tanggal: stripHtml(tanggal),
    kelasId: stripHtml(kelasId),
    kelasNama: stripHtml(kelasNama),
    anggota: anggota.map((a) => ({
      id: stripHtml(String(a.id || "")),
      nama: stripHtml(String(a.nama || "")),
      hadir: !!a.hadir,
    })),
  };
  // Cegah absensi ganda: kelas + tanggal yang sama → tolak dengan 409.
  // Frontend memakai existing.id untuk langsung beralih ke mode edit.
  const existing = await store.findAttendanceByClassDate(record.tanggal, record.kelasId);
  if (existing) {
    return res.status(409).json({
      error: "Absensi untuk kelas & tanggal ini sudah ada",
      existing: {
        id: existing.id,
        tanggal: existing.tanggal,
        kelasId: existing.kelasId,
        kelasNama: existing.kelasNama,
        anggota: existing.anggota || [],
      },
    });
  }
  const saved = await store.addAttendance(record);
  res.json({ ok: true, record: saved });
});

// Perbarui data absensi (edit real-time) — PUT /api/admin/attendance/:id
app.put("/api/admin/attendance/:id", requireAdmin, async (req, res) => {
  const { tanggal, kelasId, kelasNama, anggota } = req.body || {};
  if (!tanggal || !kelasId || !kelasNama) {
    return res.status(400).json({ error: "Tanggal, kelas wajib diisi" });
  }
  if (!Array.isArray(anggota)) {
    return res.status(400).json({ error: "Data anggota tidak valid" });
  }
  const record = {
    tanggal: stripHtml(tanggal),
    kelasId: stripHtml(kelasId),
    kelasNama: stripHtml(kelasNama),
    anggota: anggota.map((a) => ({
      id: stripHtml(String(a.id || "")),
      nama: stripHtml(String(a.nama || "")),
      hadir: !!a.hadir,
    })),
  };
  try {
    const saved = await store.updateAttendance(req.params.id, record);
    res.json({ ok: true, record: saved });
  } catch (err) {
    const notFound = /tidak ditemukan/i.test(err.message || "");
    res.status(notFound ? 404 : 500).json({ error: err.message });
  }
});

// Hapus data absensi
app.delete("/api/admin/attendance/:id", requireAdmin, async (req, res) => {
  await store.deleteAttendance(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// LOGIN ADMIN (PRD docs/PRD-ADMIN-LOGIN.md)
// ============================================================

const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5, blockMs: 10 * 60 * 1000 };

// Kirim halaman login dengan pesan error tertanam (PRD AC-4: HTTP 429 +
// render ulang halaman login dengan pesan hitung mundur). Browser tidak
// otomatis mengikuti redirect 429 (bukan 3xx), jadi halaman dikirim
// langsung dengan atribut data-error yang dibaca login.html.
function sendLoginPage(res, status, message) {
  fs.readFile(path.join(FRONTEND_DIR, "login.html"), "utf8", (err, html) => {
    if (err) return res.status(status).type("text/plain").send(message);
    const injected = html.replace('data-error=""', `data-error="${encodeURIComponent(message)}"`);
    res.status(status).type("html").send(injected);
  });
}

function blockLogin(res, message) {
  return sendLoginPage(res, 429, message);
}

// Catat percobaan login yang kena rate limit ke audit log (SECURITY.md §3.11)
function logLoginBlocked(req, message) {
  store
    .logSecurityEvent({
      type: "rate_limit",
      ip: req.ip,
      path: req.path,
      userAgent: req.headers["user-agent"],
      detail: message,
    })
    .catch((e) => console.error("[SecurityLog]", e.message));
}

// Proses login: verifikasi username (case-sensitive) + bcrypt (PRD FR-3)
async function handleAdminLogin(req, res) {
  const { username, password } = req.body || {};
  const admins = await store.getAdmins();
  const admin = (admins || []).find((a) => a.username === username);
  if (!admin || !admin.passwordHash) {
    // Catat 1 kegagalan (rate limiter baru HANYA menghitung kegagalan) &
    // kirim ulang halaman login dengan pesan yang dibaca login.html → alert.
    recordLoginFailure(req, username, LOGIN_RATE_LIMIT);
    return sendLoginPage(res, 401, "Username atau password salah");
  }
  const ok = await bcrypt.compare(password || "", admin.passwordHash);
  if (!ok) {
    recordLoginFailure(req, username, LOGIN_RATE_LIMIT);
    return sendLoginPage(res, 401, "Username atau password salah");
  }

  // Login berhasil → bersihkan catatan kegagalan & blokir utk IP+akun ini,
  // supaya percobaan lama tidak membuat pengguna sah terblokir (bug "login 2x").
  clearLoginState(req, username);

  req.session.user = { username };
  req.session.csrfToken = crypto.randomUUID(); // proteksi CSRF (PRD FR-9)
  store.setAdminOnline(username).catch((e) => console.error("[AdminOnline]", e.message));

  // Redirect hanya ke path yang aman (PRD FR-5)
  const savedRedirect = req.session.redirectTo || "";
  let redirectTo = "/admin";
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
}

// GET /admin/login → render form login (PRD FR-1)
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "login.html"));
});

// POST /admin/login → proses login (rate limited)
app.post(
  "/admin/login",
  rateLimitLogin({
    ...LOGIN_RATE_LIMIT,
    onBlocked: (req, res, msg) => {
      logLoginBlocked(req, msg);
      blockLogin(res, msg);
    },
  }),
  async (req, res, next) => {
    handleAdminLogin(req, res).catch(next);
  }
);

// Alias backward compat (PRD FR-1): GET /login → redirect ke /admin/login
app.get("/login", (req, res) => res.redirect("/admin/login"));
// POST /login → sama dengan POST /admin/login
app.post(
  "/login",
  rateLimitLogin({
    ...LOGIN_RATE_LIMIT,
    onBlocked: (req, res, msg) => {
      logLoginBlocked(req, msg);
      blockLogin(res, msg);
    },
  }),
  async (req, res, next) => {
    handleAdminLogin(req, res).catch(next);
  }
);

// Logout (PRD FR-8)
app.get("/admin/logout", (req, res) => {
  const username = req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy(() => {
    if (username) {
      store.setAdminOffline(username).catch((e) => console.error("[Logout]", e.message));
    }
    res.redirect("/admin/login");
  });
});

// ---------- Panel admin ----------
// Route canonical: GET /admin → render form login langsung bila belum login,
// atau dashboard bila sudah login (PRD FR-1).
app.get("/admin", (req, res) => {
  if (req.session && req.session.user) {
    return res.sendFile(path.join(FRONTEND_DIR, "admin.html"));
  }
  return res.sendFile(path.join(FRONTEND_DIR, "login.html"));
});

// Fallback API 404 (didaftarkan sebelum route kelas agar /api tetap JSON 404)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
});

// ---------- Halaman kelas (route generik: /baby, /samuel, dst, termasuk kelas baru) ----------
// Didaftarkan setelah /admin, static, & /api 404; class.js mengarahkan balik bila slug tidak dikenal.
app.get("/:slug", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "class.html"));
});

// ============================================================
// INISIALISASI — koneksi DB + bootstrap admin default
// ------------------------------------------------------------
// Dijalankan fire-and-forget (tanpa await) supaya module selesai
// dimuat dengan cepat. Ini PENTING untuk Vercel serverless:
// handler harus langsung siap, dan store otomatis memakai fallback
// JSON bila MongoDB belum terhubung pada request pertama.
// ============================================================
store
  .connect()
  .then(async () => {
    // Bootstrap default admin (PRD FR-10): saat collection admins kosong &
    // DISABLE_DEFAULT_ADMIN tidak diset, buat admin default (bcrypt cost 10).
    try {
      const admins = await store.getAdmins();
      if (!process.env.DISABLE_DEFAULT_ADMIN && (!admins || admins.length === 0)) {
        const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
        const password = process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";
        const passwordHash = await bcrypt.hash(password, 10);
        await store.addAdmin({ username, passwordHash });
        console.log("");
        console.log(`  🔑 Admin default dibuat: ${username} / ${process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD ? "<dari env>" : "admin123"}`);
        console.log("  ⚠️  AMAN: Set DISABLE_DEFAULT_ADMIN=1 setelah deploy untuk menonaktifkan fitur ini.");
        console.log("");
      }
    } catch (err) {
      console.error("[DB] Gagal bootstrap admin default:", err.message);
    }
  })
  .catch((err) => {
    console.error("[DB] Gagal terhubung MongoDB:", err.message);
  });

// Export aplikasi Express — dipakai Vercel sebagai serverless function
// (lihat api/index.js).
module.exports = app;

// Jalankan server langsung HANYA saat dieksekusi lokal (npm start),
// bukan saat module ini di-import oleh serverless function Vercel.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("");
    console.log("  🎈 GPI Eluzai Kids — Backend");
    console.log("  ──────────────────────────────────");
    console.log(`  🌐 Situs   : http://localhost:${PORT}`);
    console.log(`  🔐 Login   : http://localhost:${PORT}/admin/login`);
    console.log(`  🛠️  Admin   : http://localhost:${PORT}/admin`);
    console.log("  ──────────────────────────────────");
    console.log("  Tekan Ctrl+C untuk menghentikan server.");
    console.log("");
  });
}
