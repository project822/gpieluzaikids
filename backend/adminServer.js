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

app.set("view engine", "ejs");
app.set("views", ADMIN_VIEWS_DIR);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_ASSETS_DIR));

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
  return res.redirect("/login");
}

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.get("/dashboard-monitoring", ensureAuth, (req, res) => {
  const metrics = db.getMetrics();
  const adminStatuses = db.getAdminStatuses();

  const admins = db.getAdmins() || [];

  // last request avg latency
  const avgLatencyMs =
    metrics && metrics.totalRequests
      ? Math.round(
          (metrics.totalLatencyMsSum || 0) / (metrics.totalRequests || 1),
        )
      : 0;

  return res.render("dashboard", {
    metrics,
    avgLatencyMs,
    admins,
    adminStatuses,
  });
});

// Redirect aliases for dashboard monitoring
app.get("/admin/dashboard", ensureAuth, (req, res) => {
  return res.redirect("/dashboard-monitoring");
});

app.get("/admin/dashboard-monitoring", ensureAuth, (req, res) => {
  return res.redirect("/dashboard-monitoring");
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
      // Jangan tampilkan detail lain supaya konsisten dengan rate-limit.
      return res.render("login", { error: "Invalid credentials" });
    }

    req.session.user = { username };
    db.setAdminOnline(username);
    return res.redirect("/events");
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
app.use(express.json());

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
