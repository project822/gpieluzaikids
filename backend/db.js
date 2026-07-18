const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "db.json");

function ensureDbDir(targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDbPathFallback() {
  return path.join(process.env.TMPDIR || "/tmp", "db.json");
}

function defaultData() {
  return {
    admins: [],
    events: [],
    metrics: {
      totalRequests: 0,
      totalLatencyMsSum: 0,
      lastRequestAt: null,
    },
    adminStatus: {},
  };
}

// FIX: logika init & migrasi sebelumnya diduplikasi persis di blok try dan catch
// (rawan divergen kalau salah satu diedit tapi yang lain lupa). Sekarang jadi
// satu fungsi bersama yang dipakai untuk path asli maupun path fallback (/tmp),
// supaya perilaku selalu konsisten.
function readFrom(targetPath, { allowWrite }) {
  ensureDbDir(targetPath);

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, JSON.stringify(defaultData(), null, 2));
  }

  const data = JSON.parse(fs.readFileSync(targetPath, "utf8"));

  let mutated = false;

  // Migration: versi lama pakai `admin` (single admin)
  if (data.admin && !data.admins) {
    data.admins = [
      { username: data.admin.username, passwordHash: data.admin.passwordHash },
    ];
    delete data.admin;
    mutated = true;
  }

  if (!data.admins) data.admins = [];
  if (!data.events) data.events = [];

  if (!data.metrics) {
    data.metrics = {
      totalRequests: 0,
      totalLatencyMsSum: 0,
      lastRequestAt: null,
    };
    mutated = true;
  }
  if (!data.adminStatus) {
    data.adminStatus = {};
    mutated = true;
  }

  if (mutated && allowWrite) {
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
  }

  return data;
}

function read() {
  try {
    return readFrom(dbPath, { allowWrite: true });
  } catch (e) {
    // Fallback untuk environment seperti Vercel yang tidak bisa write ke filesystem repo.
    // CATATAN PENTING: /tmp di lingkungan serverless bersifat sementara (ephemeral) dan
    // TIDAK dijamin persisten antar-invocation. Kalau server ini dijalankan di Vercel,
    // data yang ditulis lewat fallback ini bisa "hilang" saat instance function di-daur ulang.
    // Untuk data yang perlu persisten di Vercel, gunakan database eksternal (mis. MongoDB),
    // seperti yang sudah dipakai di dbMongo.js.
    return readFrom(getDbPathFallback(), { allowWrite: true });
  }
}

function write(data) {
  try {
    ensureDbDir(dbPath);
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    try {
      const fallbackPath = getDbPathFallback();
      ensureDbDir(fallbackPath);
      fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2));
    } catch (e2) {
      // FIX: kalau fallback juga gagal ditulis, jangan biarkan exception mentah
      // merambat tak tertangani ke caller (bisa bikin request crash tanpa respons).
      console.error("[db.write] Gagal menyimpan data (path utama & fallback):", e2.message);
    }
  }
}

function getEvents() {
  const data = read();
  return data.events || [];
}

function getEvent(id) {
  return getEvents().find((event) => event.id === id);
}

function addEvent(event) {
  const data = read();
  data.events = data.events || [];
  data.events.push(event);
  write(data);
}

function updateEvent(id, patch) {
  const data = read();
  data.events = data.events || [];
  data.events = data.events.map((event) =>
    event.id === id ? { ...event, ...patch } : event,
  );
  write(data);
}

function deleteEvent(id) {
  const data = read();
  data.events = (data.events || []).filter((event) => event.id !== id);
  write(data);
}

function getAdmins() {
  const data = read();
  return data.admins || [];
}

function addAdmin(admin) {
  const data = read();
  data.admins = data.admins || [];
  data.admins.push(admin);
  write(data);
}

function deleteAdmin(username) {
  const data = read();
  data.admins = (data.admins || []).filter((a) => a.username !== username);
  write(data);
}

function updateAdminPassword(username, newPasswordHash) {
  const data = read();
  data.admins = (data.admins || []).map((a) =>
    a.username === username ? { ...a, passwordHash: newPasswordHash } : a,
  );
  write(data);
}

function incRequestMetrics({ latencyMs = 0 } = {}) {
  const data = read();
  data.metrics = data.metrics || {
    totalRequests: 0,
    totalLatencyMsSum: 0,
    lastRequestAt: null,
  };

  data.metrics.totalRequests = (data.metrics.totalRequests || 0) + 1;
  data.metrics.totalLatencyMsSum =
    (data.metrics.totalLatencyMsSum || 0) + (Number(latencyMs) || 0);
  data.metrics.lastRequestAt = new Date().toISOString();

  write(data);
}

function getMetrics() {
  const data = read();
  return (
    data.metrics || {
      totalRequests: 0,
      totalLatencyMsSum: 0,
      lastRequestAt: null,
    }
  );
}

const ADMIN_ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 menit tanpa aktivitas = dianggap offline

function setAdminOnline(username) {
  const data = read();
  data.adminStatus = data.adminStatus || {};

  const now = new Date().toISOString();
  data.adminStatus[username] = {
    ...(data.adminStatus[username] || {}),
    sessionActive: true,
    lastSeen: now,
    updatedAt: now,
  };

  write(data);
}

// Dipanggil di setiap request admin yang sudah login, supaya "Last Online"
// mencerminkan aktivitas nyata, bukan cuma waktu login.
function touchAdminActivity(username) {
  const data = read();
  data.adminStatus = data.adminStatus || {};

  data.adminStatus[username] = {
    ...(data.adminStatus[username] || {}),
    lastSeen: new Date().toISOString(),
  };

  write(data);
}

function setAdminOffline(username) {
  const data = read();
  data.adminStatus = data.adminStatus || {};

  if (!data.adminStatus[username]) data.adminStatus[username] = {};

  data.adminStatus[username].sessionActive = false;
  data.adminStatus[username].updatedAt = new Date().toISOString();

  write(data);
}

function getAdminStatuses() {
  const data = read();
  const raw = data.adminStatus || {};
  const now = Date.now();
  const result = {};
  Object.keys(raw).forEach((username) => {
    const s = raw[username];
    const lastSeenMs = s.lastSeen ? new Date(s.lastSeen).getTime() : 0;
    const isRecentlyActive = now - lastSeenMs < ADMIN_ONLINE_THRESHOLD_MS;
    result[username] = {
      ...s,
      online: Boolean(s.sessionActive) && isRecentlyActive,
      lastOnline: s.lastSeen || s.lastOnline || null,
    };
  });
  return result;
}

function logPageView({ path, ip, userAgent }) {
  const data = read();
  data.pageviews = data.pageviews || [];

  data.pageviews.push({
    path,
    ip: ip || "127.0.0.1",
    userAgent: userAgent || "",
    timestamp: new Date().toISOString(),
  });

  // Keep only the last 5000 pageviews to avoid database growth
  if (data.pageviews.length > 5000) {
    data.pageviews = data.pageviews.slice(data.pageviews.length - 5000);
  }

  write(data);
}

function getPageViewStats(timeRange = "7d") {
  const data = read();
  const pageviews = data.pageviews || [];

  const now = new Date();
  let cutOff = new Date();
  if (timeRange === "24h") {
    cutOff.setHours(now.getHours() - 24);
  } else if (timeRange === "30d") {
    cutOff.setDate(now.getDate() - 30);
  } else {
    cutOff.setDate(now.getDate() - 7);
  }

  const filtered = pageviews.filter((p) => new Date(p.timestamp) >= cutOff);

  // 1. Visitors (unique IPs)
  const uniqueIps = new Set(filtered.map((p) => p.ip));
  const visitorsCount = uniqueIps.size;

  // 2. Page views
  const pageViewsCount = filtered.length;

  // 3. Bounce Rate
  const visitsByIp = {};
  filtered.forEach((p) => {
    visitsByIp[p.ip] = (visitsByIp[p.ip] || 0) + 1;
  });
  const totalIps = Object.keys(visitsByIp).length;
  const singlePageIps = Object.values(visitsByIp).filter((count) => count === 1).length;
  const bounceRate = totalIps > 0 ? Math.round((singlePageIps / totalIps) * 100) : 0;

  // 4. Online Users (active in the last 5 minutes)
  const fiveMinAgo = new Date();
  fiveMinAgo.setMinutes(now.getMinutes() - 5);
  const activeOnline = new Set(
    pageviews.filter((p) => new Date(p.timestamp) >= fiveMinAgo).map((p) => p.ip),
  ).size;

  // 5. Chart Data
  const chartData = {};

  if (timeRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setHours(now.getHours() - i);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      chartData[label] = 0;
    }
  } else {
    const daysToGenerate = timeRange === "30d" ? 30 : 7;
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const label = `${d.getDate()} ${d.toLocaleString("id-ID", { month: "short" })}`;
      chartData[label] = 0;
    }
  }

  filtered.forEach((p) => {
    const d = new Date(p.timestamp);
    let key;
    if (timeRange === "24h") {
      key = `${d.getHours().toString().padStart(2, "0")}:00`;
    } else {
      key = `${d.getDate()} ${d.toLocaleString("id-ID", { month: "short" })}`;
    }
    if (chartData[key] !== undefined) {
      chartData[key]++;
    }
  });

  // 6. (Top Paths dihapus - section "Top Pages" sudah tidak dipakai di dashboard)

  return {
    visitors: visitorsCount,
    pageviews: pageViewsCount,
    bounceRate,
    online: activeOnline || 1,
    chartData,
  };
}

module.exports = {
  read,
  write,
  getEvents,
  getEvent,
  addEvent,
  updateEvent,
  deleteEvent,
  getAdmins,
  addAdmin,
  deleteAdmin,
  updateAdminPassword,

  // Monitoring
  incRequestMetrics,
  getMetrics,
  setAdminOnline,
  touchAdminActivity,
  setAdminOffline,
  getAdminStatuses,

  // Pageview Analytics
  logPageView,
  getPageViewStats,

  dbPath,
};