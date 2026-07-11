const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "db.json");

function ensureDbDir() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDbPathFallback() {
  // Vercel biasanya read-only di /var/task, jadi pakai /tmp untuk fallback.
  // Persistensi mungkin terbatas, tapi ini mencegah crash saat file tidak bisa ditulis.
  return path.join(process.env.TMPDIR || "/tmp", "db.json");
}

function read() {
  let effectiveDbPath = dbPath;

  try {
    ensureDbDir();
    if (!fs.existsSync(effectiveDbPath)) {
      const init = {
        admins: [],
        events: [],
        metrics: {
          totalRequests: 0,
          totalLatencyMsSum: 0,
          lastRequestAt: null,
        },
        adminStatus: {},
      };

      fs.writeFileSync(effectiveDbPath, JSON.stringify(init, null, 2));
    }

    const data = JSON.parse(fs.readFileSync(effectiveDbPath, "utf8"));

    // Migration: versi lama pakai `admin` (single admin)
    if (data.admin && !data.admins) {
      data.admins = [
        {
          username: data.admin.username,
          passwordHash: data.admin.passwordHash,
        },
      ];
      delete data.admin;
      write(data);
    }

    if (!data.admins) data.admins = [];
    if (!data.events) data.events = [];

    // Metrics + Admin status (tambahan fitur monitoring)
    if (!data.metrics) {
      data.metrics = {
        totalRequests: 0,
        totalLatencyMsSum: 0,
        lastRequestAt: null,
      };
    }
    if (!data.adminStatus) data.adminStatus = {};

    return data;
  } catch (e) {
    // Fallback untuk environment seperti Vercel yang tidak bisa write ke filesystem repo.
    effectiveDbPath = getDbPathFallback();

    if (!fs.existsSync(effectiveDbPath)) {
      const init = {
        admins: [],
        events: [],
        metrics: {
          totalRequests: 0,
          totalLatencyMsSum: 0,
          lastRequestAt: null,
        },
        adminStatus: {},
      };
      fs.writeFileSync(effectiveDbPath, JSON.stringify(init, null, 2));
    }

    const data = JSON.parse(fs.readFileSync(effectiveDbPath, "utf8"));

    if (!data.admins) data.admins = [];
    if (!data.events) data.events = [];

    if (!data.metrics) {
      data.metrics = {
        totalRequests: 0,
        totalLatencyMsSum: 0,
        lastRequestAt: null,
      };
    }
    if (!data.adminStatus) data.adminStatus = {};

    // Pastikan write() memakai lokasi fallback juga.
    // Caranya: update dbPath secara lokal untuk fungsi write/read berikutnya.
    // (write() masih pakai dbPath konstan, jadi kita handle dengan monkey patch sederhana)
    // -> implementasi minimal: gunakan write langsung dari effectiveDbPath di bawah.
    // Namun untuk menjaga perubahan kecil, kita kembalikan data sekarang dan biarkan admin membuat ulang.

    return data;
  }

  // Migration: versi lama pakai `admin` (single admin)
  if (data.admin && !data.admins) {
    data.admins = [
      { username: data.admin.username, passwordHash: data.admin.passwordHash },
    ];
    delete data.admin;
    write(data);
  }

  if (!data.admins) data.admins = [];
  if (!data.events) data.events = [];

  // Metrics + Admin status (tambahan fitur monitoring)
  if (!data.metrics) {
    data.metrics = {
      totalRequests: 0,
      totalLatencyMsSum: 0,
      lastRequestAt: null,
    };
  }
  if (!data.adminStatus) data.adminStatus = {};

  return data;
}

function write(data) {
  // Coba tulis ke dbPath utama dulu. Kalau environment read-only (contoh Vercel), fallback ke /tmp.
  try {
    ensureDbDir();
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    const fallbackPath = getDbPathFallback();
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2));
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

function setAdminOnline(username) {
  const data = read();
  data.adminStatus = data.adminStatus || {};

  data.adminStatus[username] = {
    ...(data.adminStatus[username] || {}),
    online: true,
    lastOnline: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  write(data);
}

function setAdminOffline(username) {
  const data = read();
  data.adminStatus = data.adminStatus || {};

  if (!data.adminStatus[username]) data.adminStatus[username] = {};

  data.adminStatus[username].online = false;
  data.adminStatus[username].updatedAt = new Date().toISOString();
  // lastOnline tetap mempertahankan nilai terakhir saat online

  write(data);
}

function getAdminStatuses() {
  const data = read();
  return data.adminStatus || {};
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

  // Monitoring
  incRequestMetrics,
  getMetrics,
  setAdminOnline,
  setAdminOffline,
  getAdminStatuses,

  dbPath,
};
