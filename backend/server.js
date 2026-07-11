const express = require("express");
const path = require("path");
const fs = require("fs");

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 10082;

// ** KRUSIAL: Di Vercel serverless, __dirname TIDAK sama dengan di local **
// __dirname di Vercel menunjuk ke folder internal serverless function,
// BUKAN ke root proyek. process.cwd() adalah satu-satunya cara yang
// konsisten untuk mendapatkan root proyek di kedua environment.
const projectRoot = process.cwd();

const PUBLIC_VIEWS_DIR = path.join(projectRoot, "frontend", "views");
const PUBLIC_ASSETS_DIR = path.join(projectRoot, "frontend", "public");

// Fallback: jika views tidak ditemukan di process.cwd(), coba __dirname
let viewsDir = PUBLIC_VIEWS_DIR;
if (!fs.existsSync(path.join(viewsDir, "index.ejs"))) {
  const altViews = path.join(__dirname, "..", "frontend", "views");
  if (fs.existsSync(path.join(altViews, "index.ejs"))) {
    viewsDir = altViews;
  }
}

app.set("view engine", "ejs");
app.set("views", viewsDir);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_ASSETS_DIR));

// Serve favicon to prevent 404 errors
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// Basic metrics for admin monitoring (traffic/performance)
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    try {
      db.incRequestMetrics({ latencyMs });
    } catch (e) {
      // Metrics shouldn't break main flow
    }
  });

  next();
});

app.get("/", (req, res) => {
  const events = db.getEvents().slice().reverse();
  res.render("index", { events });
});

app.get("/events", (req, res) => res.redirect("/"));
app.get("/events/:id", (req, res) => res.redirect("/"));
app.get("/documentation", (req, res) => res.redirect("/"));
app.get("/contact", (req, res) => res.redirect("/"));

app.get("/login", (req, res) => {
  res.redirect("http://localhost:10083/login");
});

app.get("/api/events/:id", (req, res) => {
  const event = db.getEvent(req.params.id);

  if (!event) return res.status(404).json({ error: "Not found" });

  res.json(event);
});

// Vercel export - critical for serverless deployment
module.exports = app;

// Only listen when run directly (not on Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
  });
}