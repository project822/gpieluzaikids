const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");
const { rateLimitLogin } = require("./rateLimit");

const app = express();
const PORT = process.env.PORT_ADMIN || 10083;
const ADMIN_VIEWS_DIR = path.join(__dirname, "views", "admin");
const PUBLIC_ASSETS_DIR = path.join(__dirname, "..", "frontend", "public");
const UPLOADS_DIR = path.join(PUBLIC_ASSETS_DIR, "uploads");

(async function ensureAdmin() {
  const admins = db.getAdmins();

  // Default admin jika belum ada
  if (!admins || admins.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    db.addAdmin({ username: "admin", passwordHash });
    console.log("Default admin created: username=admin password=admin123");
  }
})();

// ============== SECURITY MIDDLEWARE ==============
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.set("view engine", "ejs");
app.set("views", ADMIN_VIEWS_DIR);

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

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this-admin",
    resave: false,
    saveUninitialized: false,
  }),
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");

    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.session) {
    req.session.redirectTo = req.originalUrl;
  }
  return res.redirect("/login");
}

function ensureDevAuth(req, res, next) {
  if (req.session && req.session.devUser) return next();
  if (req.session) {
    req.session.redirectTo = req.originalUrl;
  }
  return res.redirect("/dev/login");
}

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

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

// ============== DEV API: Stats (for dashboard auto-refresh) ==============
app.get("/dev/api/stats", ensureDevAuth, (req, res) => {
  const timeRange = req.query.range || "7d";
  const pvStats = db.getPageViewStats(timeRange);
  const metrics = db.getMetrics();
  const avgLatencyMs =
    metrics && metrics.totalRequests
      ? Math.round((metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1))
      : 0;
  return res.json({ pvStats, metrics: { ...metrics, avgLatencyMs } });
});

app.post(
  "/login",
  rateLimitLogin({
    windowMs: 15 * 60 * 1000,
    max: 5,
    blockMs: 10 * 60 * 1000,
  }),
  async (req, res) => {
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
    
    const redirectTo = req.session.redirectTo || "/events";
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  },
);

app.get("/logout", (req, res) => {
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
    res.redirect("/login");
  });
});

app.get("/events", ensureAuth, (req, res) => {
  const events = db.getEvents().slice().reverse();
  return res.render("events", { events });
});

app.get("/events/new", ensureAuth, (req, res) => {
  return res.render("form", { event: null });
});

app.get("/documentation", ensureAuth, (req, res) => {
  const events = db.getEvents().slice().reverse();

  return res.render("documentation", { events });
});

app.get("/admins/new", ensureAuth, (req, res) => {
  return res.render("create-admin", { error: null });
});

app.post("/admins/new", ensureAuth, async (req, res) => {
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

  return res.redirect("/events");
});

app.post("/events/new", ensureAuth, upload.single("poster"), (req, res) => {
  const { title, day, time, location, googleForm } = req.body;
  const poster = req.file ? `/uploads/${req.file.filename}` : "";
  const event = {
    id: uuidv4(),
    title,
    day,
    time,
    location,
    poster,
    googleForm,
  };

  db.addEvent(event);
  res.redirect("/events");
});

app.get("/events/:id/edit", ensureAuth, (req, res) => {
  const event = db.getEvent(req.params.id);

  if (!event) return res.status(404).send("Not found");

  res.render("form", { event });
});

app.post(
  "/events/:id/edit",
  ensureAuth,
  upload.single("poster"),
  (req, res) => {
    const { title, day, time, location, googleForm } = req.body;
    const patch = { title, day, time, location, googleForm };

    if (req.file) patch.poster = `/uploads/${req.file.filename}`;

    db.updateEvent(req.params.id, patch);
    res.redirect("/events");
  },
);

app.use("/admin/api", ensureAuth);

app.post("/admin/api/events/delete", (req, res) => {
  const { id } = req.body || {};

  if (!id) return res.status(400).json({ error: "Missing event id" });

  const ev = db.getEvent(id);

  if (!ev) return res.status(404).json({ error: "Event not found" });

  db.deleteEvent(id);
  return res.json({ ok: true });
});

app.post("/admin/api/documentation/add", (req, res) => {
  const { eventId, driveLink } = req.body || {};

  if (!eventId || !driveLink)
    return res.status(400).json({ error: "Missing eventId or driveLink" });

  const ev = db.getEvent(eventId);

  if (!ev) return res.status(404).json({ error: "Event not found" });

  db.updateEvent(eventId, { driveLink });
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Admin server running http://localhost:${PORT}`);
});

module.exports = app;