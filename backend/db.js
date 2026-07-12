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

    // Migration: versi lama pakai `admin` (single admin)
    if (data.admin && !data.admins) {
      data.admins = [
        { username: data.admin.username, passwordHash: data.admin.passwordHash },
      ];
      delete data.admin;
      fs.writeFileSync(effectiveDbPath, JSON.stringify(data, null, 2));
    }

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

    return data;
  }
}

function write(data) {
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

  write(data);
}

function getAdminStatuses() {
  const data = read();
  return data.adminStatus || {};
}

function logPageView({ path, ip, userAgent }) {
  const data = read();
  data.pageviews = data.pageviews || [];
  
  data.pageviews.push({
    path,
    ip: ip || '127.0.0.1',
    userAgent: userAgent || '',
    timestamp: new Date().toISOString()
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
  } else { // default "7d"
    cutOff.setDate(now.getDate() - 7);
  }
  
  const filtered = pageviews.filter(p => new Date(p.timestamp) >= cutOff);
  
  // 1. Visitors (unique IPs)
  const uniqueIps = new Set(filtered.map(p => p.ip));
  const visitorsCount = uniqueIps.size;
  
  // 2. Page views
  const pageViewsCount = filtered.length;
  
  // 3. Bounce Rate
  const visitsByIp = {};
  filtered.forEach(p => {
    visitsByIp[p.ip] = (visitsByIp[p.ip] || 0) + 1;
  });
  const totalIps = Object.keys(visitsByIp).length;
  const singlePageIps = Object.values(visitsByIp).filter(count => count === 1).length;
  const bounceRate = totalIps > 0 ? Math.round((singlePageIps / totalIps) * 100) : 0;
  
  // 4. Online Users (active in the last 5 minutes)
  const fiveMinAgo = new Date();
  fiveMinAgo.setMinutes(now.getMinutes() - 5);
  const activeOnline = new Set(pageviews.filter(p => new Date(p.timestamp) >= fiveMinAgo).map(p => p.ip)).size;
  
  // 5. Chart Data
  const chartData = {};
  
  if (timeRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setHours(now.getHours() - i);
      const label = `${d.getHours().toString().padStart(2, '0')}:00`;
      chartData[label] = 0;
    }
  } else {
    const daysToGenerate = timeRange === "30d" ? 30 : 7;
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const label = `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'short' })}`;
      chartData[label] = 0;
    }
  }
  
  filtered.forEach(p => {
    const d = new Date(p.timestamp);
    let key;
    if (timeRange === "24h") {
      key = `${d.getHours().toString().padStart(2, '0')}:00`;
    } else {
      key = `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'short' })}`;
    }
    if (chartData[key] !== undefined) {
      chartData[key]++;
    }
  });
  
  // 6. Top Paths
  const pathsCount = {};
  filtered.forEach(p => {
    pathsCount[p.path] = (pathsCount[p.path] || 0) + 1;
  });
  const topPaths = Object.entries(pathsCount)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
    
  return {
    visitors: visitorsCount,
    pageviews: pageViewsCount,
    bounceRate,
    online: activeOnline || 1,
    chartData,
    topPaths
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
  setAdminOffline,
  getAdminStatuses,
  
  // Pageview Analytics
  logPageView,
  getPageViewStats,
  
  dbPath,
};