const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");

const db = require("./db");
const { rateLimitLogin } = require("./rateLimit");

const app = express();
const PORT = process.env.PORT || 10082;

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(PUBLIC_ASSETS_DIR, {
  maxAge: '7d',
  immutable: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this-admin",
    resave: false,
    saveUninitialized: false,
  }),
);

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Buat folder uploads jika belum ada
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

// ============== FAVICON ==============
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// ============== METRICS ==============
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    try {
      db.incRequestMetrics({ latencyMs: Date.now() - start });

      // Track pageviews for public GET requests (skip static assets, dev routes)
      const isGet = req.method === "GET";
      const isAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|webp)$/i.test(req.path);
      const isApi = req.path.startsWith("/api/") || req.path.startsWith("/dev/") || req.path.startsWith("/admin/");
      const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

      if (isGet && !isAsset && !isApi && isSuccess) {
        const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
        db.logPageView({ path: req.path, ip, userAgent: req.headers["user-agent"] || "" });
      }
    } catch (e) {
      // ignore
    }
  });
  next();
});

// ============== AUTH MIDDLEWARE ==============
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) return next();
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

// Init default admin
(async function ensureAdmin() {
  const admins = db.getAdmins();
  if (!admins || admins.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    db.addAdmin({ username: "admin", passwordHash });
    console.log("Default admin created: username=admin password=admin123");
  }
})();

// ============== PUBLIC ROUTES ==============
app.get("/", (req, res) => {
  const events = db.getEvents().slice().reverse();
  res.render("index", { events });
});

app.get("/events", (req, res) => res.redirect("/"));
app.get("/events/:id", (req, res) => res.redirect("/"));
app.get("/documentation", (req, res) => res.redirect("/"));
app.get("/contact", (req, res) => res.redirect("/"));

app.get("/api/events/:id", (req, res) => {
  const event = db.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Not found" });
  res.json(event);
});

// ============== ADMIN ROUTES (prefix /admin) ==============

// Login (canonical: /admin/login)
app.get("/admin/login", (req, res) => res.render("login", { error: null }));

async function handleAdminLogin(req, res) {
  const { username, password } = req.body;
  const admins = db.getAdmins();
  const admin = (admins || []).find((a) => a.username === username);
  if (!admin) {
    return res.render("login", { error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.render("login", { error: "Invalid credentials" });
  }
  req.session.user = { username };
  db.setAdminOnline(username);
  
  // Only redirect to admin-accessible paths, NOT dev paths (e.g. /admin/dashboard → /dev/dashboard)
  const savedRedirect = req.session.redirectTo || "";
  let redirectTo = "/admin/events";
  if (savedRedirect && !savedRedirect.includes("/dashboard") && !savedRedirect.includes("/dev/") && (savedRedirect.startsWith("/admin/") || savedRedirect.startsWith("/events") || savedRedirect.startsWith("/documentation") || savedRedirect === "/")) {
    redirectTo = savedRedirect;
  }
  delete req.session.redirectTo;
  return res.redirect(redirectTo);
}

app.post(
  "/admin/login",
  rateLimitLogin({
    windowMs: 15 * 60 * 1000,
    max: 5,
    blockMs: 10 * 60 * 1000,
  }),
  (req, res) => handleAdminLogin(req, res),
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
  (req, res) => handleAdminLogin(req, res),
);

app.get("/dev/logout", (req, res) => {
  const username =
    req.session && req.session.devUser ? req.session.devUser.username : null;
  req.session.destroy(() => {
    if (username) {
      try {
        db.setAdminOffline(username);
      } catch (e) {
        // ignore
      }
    }
    res.redirect("/dev/login");
  });
});

app.get("/admin/logout", (req, res) => {
  const username =
    req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy(() => {
    if (username) {
      try {
        db.setAdminOffline(username);
      } catch (e) {
        // ignore
      }
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
app.get("/dev/dashboard", ensureDevAuth, (req, res) => {
  const timeRange = req.query.range || "7d";
  const metrics = db.getMetrics();
  const adminStatuses = db.getAdminStatuses();
  const admins = db.getAdmins() || [];
  const avgLatencyMs =
    metrics && metrics.totalRequests
      ? Math.round(
          (metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1),
        )
      : 0;
  const pvStats = db.getPageViewStats(timeRange);
  return res.render("dashboard", {
    metrics,
    avgLatencyMs,
    admins,
    adminStatuses,
    pvStats,
    timeRange,
  });
});

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
app.get("/api/dev/stats", ensureDevAuth, (req, res) => {
  const timeRange = req.query.range || "7d";
  const pvStats = db.getPageViewStats(timeRange);
  const metrics = db.getMetrics();
  const avgLatencyMs =
    metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;
  return res.json({ pvStats, metrics: { ...metrics, avgLatencyMs } });
});

// ============== DEV API: Add Admin ==============
app.post("/dev/api/admins/add", ensureDevAuth, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }
  const admins = db.getAdmins();
  const exists = (admins || []).some((a) => a.username === username);
  if (exists) {
    return res.status(400).json({ error: "Username sudah dipakai" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  db.addAdmin({ username, passwordHash });
  return res.json({ ok: true, username });
});

// ============== DEV API: Reset Password ==============
app.post("/dev/api/admins/reset-password", ensureDevAuth, async (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) {
    return res.status(400).json({ error: "Username dan password baru wajib diisi" });
  }
  const admins = db.getAdmins();
  const exists = (admins || []).some((a) => a.username === username);
  if (!exists) {
    return res.status(400).json({ error: "Username tidak ditemukan" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.updateAdminPassword(username, passwordHash);
  return res.json({ ok: true, username });
});

// ============== DEV API: Delete Admin ==============
app.post("/dev/api/admins/delete", ensureDevAuth, (req, res) => {
  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "Username wajib diisi" });
  }
  db.deleteAdmin(username);
  return res.json({ ok: true });
});

// ============== DEV API: Get Admin Statuses (for real-time refresh) ==============
app.get("/dev/api/admins/statuses", ensureDevAuth, (req, res) => {
  const adminStatuses = db.getAdminStatuses();
  const admins = db.getAdmins() || [];
  return res.json({ admins, adminStatuses });
});

// Events management
app.get("/admin/events", ensureAuth, (req, res) => {
  const events = db.getEvents().slice().reverse();
  return res.render("events", { events });
});

app.get("/admin/events/new", ensureAuth, (req, res) => {
  return res.render("form", { event: null });
});

app.post(
  "/admin/events/new",
  ensureAuth,
  upload.single("poster"),
  (req, res) => {
    const { title, day, time, location, googleForm } = req.body;
    const poster = req.file ? `/uploads/${req.file.filename}` : "";
    const event = {
      id: crypto.randomUUID(),
      title,
      day,
      time,
      location,
      poster,
      googleForm,
    };
    db.addEvent(event);
    res.redirect("/admin/events");
  },
);

app.get("/admin/events/:id/edit", ensureAuth, (req, res) => {
  const event = db.getEvent(req.params.id);
  if (!event) return res.status(404).send("Not found");
  res.render("form", { event });
});

app.post(
  "/admin/events/:id/edit",
  ensureAuth,
  upload.single("poster"),
  (req, res) => {
    const { title, day, time, location, googleForm } = req.body;
    const patch = { title, day, time, location, googleForm };
    if (req.file) patch.poster = `/uploads/${req.file.filename}`;
    db.updateEvent(req.params.id, patch);
    res.redirect("/admin/events");
  },
);

app.post("/admin/api/events/delete", ensureAuth, (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing event id" });
  const ev = db.getEvent(id);
  if (!ev) return res.status(404).json({ error: "Event not found" });
  db.deleteEvent(id);
  return res.json({ ok: true });
});

// Documentation
app.get("/admin/documentation", ensureAuth, (req, res) => {
  const events = db.getEvents().slice().reverse();
  return res.render("documentation", { events });
});

app.post("/admin/api/documentation/add", ensureAuth, (req, res) => {
  const { eventId, driveLink } = req.body || {};
  if (!eventId || !driveLink)
    return res.status(400).json({ error: "Missing eventId or driveLink" });
  const ev = db.getEvent(eventId);
  if (!ev) return res.status(404).json({ error: "Event not found" });
  db.updateEvent(eventId, { driveLink });
  return res.json({ ok: true });
});

// Create admin (from dashboard)
app.get("/admin/admins/new", ensureAuth, (req, res) => {
  return res.render("create-admin", { error: null });
});

app.post("/admin/admins/new", ensureAuth, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .render("create-admin", { error: "Username dan password wajib diisi" });
  }
  const admins = db.getAdmins();
  const exists = (admins || []).some((a) => a.username === username);
  if (exists) {
    return res
      .status(400)
      .render("create-admin", { error: "Username sudah dipakai" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  db.addAdmin({ username, passwordHash });
  return res.redirect("/admin/events");
});

// Redirect root admin to login
app.get("/admin", (req, res) => res.redirect("/admin/login"));

// ============== SPEED INSIGHTS API ==============
const { getSpeedInsightsData, getMetricRating } = require("./speedInsights");

app.get("/api/dev/speed-insights", ensureDevAuth, async (req, res) => {
  try {
    const timeRange = req.query.range || "7d";
    const data = await getSpeedInsightsData(timeRange);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/dev/speed-insights/status", ensureDevAuth, (req, res) => {
  const token = process.env.VERCEL_TOKEN || "";
  const projectId = process.env.VERCEL_PROJECT_ID || "";
  return res.json({
    configured: !!(token && projectId),
    hasToken: !!token,
    hasProjectId: !!projectId,
  });
});

module.exports = { getMetricRating };

// ============== EXPORT (for Vercel) ==============
module.exports = app;

// Only listen when run directly (not on Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
  });
}
