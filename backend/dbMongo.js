const { MongoClient, ObjectId } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = process.env.MONGO_DB_NAME || "gereja";

if (!MONGO_URI) {
  // Jangan biarkan aplikasi diam-diam mencoba connect ke placeholder palsu.
  // Lebih baik gagal cepat & jelas di log daripada request menggantung.
  console.error(
    "[MongoDB] FATAL: environment variable MONGO_URI belum di-set. " +
      "Set MONGO_URI di file .env (lokal) atau di Vercel Project Settings > Environment Variables (production).",
  );
}

let client = null;
let db = null;
let connectingPromise = null; // mencegah race condition saat banyak request connect bersamaan

/**
 * Koneksi ke MongoDB (singleton) - cache untuk Vercel serverless.
 * Aman dipanggil bersamaan dari banyak request paralel (tidak akan connect dobel).
 */
async function connect() {
  if (db) return db;
  if (connectingPromise) return connectingPromise;

  if (!MONGO_URI) {
    throw new Error(
      "MONGO_URI tidak diset. Tidak bisa terhubung ke MongoDB.",
    );
  }

  connectingPromise = (async () => {
    try {
      client = new MongoClient(MONGO_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await client.connect();
      const database = client.db(DB_NAME);

      // Pastikan collections & indexes dibuat
      try {
        await database.collection("events").createIndex({ id: 1 }, { unique: true });
        await database.collection("admins").createIndex({ username: 1 }, { unique: true });
        await database.collection("pageviews").createIndex({ timestamp: -1 });
        await database.collection("songs").createIndex({ id: 1 }, { unique: true });
        await database.collection("songs").createIndex({ title: "text", lyrics: "text" });
        await database.collection("playlists").createIndex({ id: 1 }, { unique: true });
      } catch (e) {
        // Index mungkin sudah ada, ignore error
        console.warn("[MongoDB] createIndex warning:", e.message);
      }

      console.log("[MongoDB] Connected to", DB_NAME);
      db = database;
      return db;
    } catch (err) {
      // Reset state supaya request berikutnya boleh coba connect lagi
      client = null;
      db = null;
      console.error("[MongoDB] Connection failed:", err.message);
      throw err;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

/**
 * Ambil MongoClient yang sudah konek (dipakai ulang oleh session store /
 * connect-mongo, supaya tidak bikin koneksi MongoDB terpisah sendiri-sendiri
 * -> lebih hemat & lebih stabil, terutama saat cold start di serverless).
 */
async function getClient() {
  await connect();
  return client;
}

/**
 * Tutup koneksi (untuk graceful shutdown)
 */
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// ───────────── Events ─────────────

async function getEvents() {
  const d = await connect();
  return d.collection("events").find().sort({ day: -1 }).toArray();
}

async function getEvent(id) {
  const d = await connect();
  return d.collection("events").findOne({ id });
}

async function addEvent(event) {
  const d = await connect();
  event.createdAt = new Date().toISOString();
  await d.collection("events").insertOne(event);
  return event;
}

async function updateEvent(id, patch) {
  const d = await connect();
  patch.updatedAt = new Date().toISOString();
  await d.collection("events").updateOne({ id }, { $set: patch });
}

async function deleteEvent(id) {
  const d = await connect();
  await d.collection("events").deleteOne({ id });
}

// ───────────── Admins ─────────────

async function getAdmins() {
  const d = await connect();
  return d.collection("admins").find().toArray();
}

async function addAdmin(admin) {
  const d = await connect();
  admin.createdAt = new Date().toISOString();
  await d.collection("admins").insertOne(admin);
}

async function deleteAdmin(username) {
  const d = await connect();
  await d.collection("admins").deleteOne({ username });
}

async function updateAdminPassword(username, newPasswordHash) {
  const d = await connect();
  await d.collection("admins").updateOne(
    { username },
    {
      $set: {
        passwordHash: newPasswordHash,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

// ───────────── Metrics ─────────────

async function incRequestMetrics({ latencyMs = 0 } = {}) {
  const d = await connect();
  await d.collection("metrics").updateOne(
    { _id: "global" },
    {
      $inc: { totalRequests: 1, totalLatencyMsSum: latencyMs || 0 },
      $set: { lastRequestAt: new Date().toISOString() },
    },
    { upsert: true },
  );
}

async function getMetrics() {
  const d = await connect();
  const metrics = await d.collection("metrics").findOne({ _id: "global" });
  return (
    metrics || { totalRequests: 0, totalLatencyMsSum: 0, lastRequestAt: null }
  );
}

// ───────────── Admin Status ─────────────
const ADMIN_ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 menit tanpa aktivitas = dianggap offline

async function setAdminOnline(username) {
  const d = await connect();
  const now = new Date().toISOString();
  await d.collection("adminStatus").updateOne(
    { username },
    {
      $set: {
        sessionActive: true,
        lastSeen: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

async function touchAdminActivity(username) {
  const d = await connect();
  await d.collection("adminStatus").updateOne(
    { username },
    { $set: { lastSeen: new Date().toISOString() } },
    { upsert: true },
  );
}

async function setAdminOffline(username) {
  const d = await connect();
  await d.collection("adminStatus").updateOne(
    { username },
    { $set: { sessionActive: false, updatedAt: new Date().toISOString() } },
  );
}

async function getAdminStatuses() {
  const d = await connect();
  const statuses = await d.collection("adminStatus").find().toArray();
  const now = Date.now();
  const result = {};
  statuses.forEach((s) => {
    const lastSeenMs = s.lastSeen ? new Date(s.lastSeen).getTime() : 0;
    const isRecentlyActive = now - lastSeenMs < ADMIN_ONLINE_THRESHOLD_MS;
    result[s.username] = {
      ...s,
      online: Boolean(s.sessionActive) && isRecentlyActive,
      lastOnline: s.lastSeen || s.lastOnline || null,
    };
  });
  return result;
}

// ───────────── Pageview Analytics ─────────────

async function logPageView({ path, ip, userAgent }) {
  const d = await connect();
  await d.collection("pageviews").insertOne({
    path,
    ip: ip || "127.0.0.1",
    userAgent: userAgent || "",
    timestamp: new Date(),
  });
}

async function getPageViewStats(timeRange = "7d") {
  const d = await connect();
  const now = new Date();
  let cutOff = new Date();

  if (timeRange === "24h") cutOff.setHours(now.getHours() - 24);
  else if (timeRange === "30d") cutOff.setDate(now.getDate() - 30);
  else cutOff.setDate(now.getDate() - 7);

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [
    visitorsResult,
    totalCount,
    bounceResult,
    onlineResult,
    chartDocs,
  ] = await Promise.all([
    d
      .collection("pageviews")
      .aggregate([
        { $match: { timestamp: { $gte: cutOff } } },
        { $group: { _id: "$ip" } },
        { $count: "count" },
      ])
      .toArray(),
    d.collection("pageviews").countDocuments({ timestamp: { $gte: cutOff } }),
    d
      .collection("pageviews")
      .aggregate([
        { $match: { timestamp: { $gte: cutOff } } },
        { $group: { _id: "$ip", count: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            singlePage: { $sum: { $cond: [{ $eq: ["$count", 1] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    d
      .collection("pageviews")
      .aggregate([
        { $match: { timestamp: { $gte: fiveMinAgo } } },
        { $group: { _id: "$ip" } },
        { $count: "count" },
      ])
      .toArray(),
    d
      .collection("pageviews")
      .aggregate([
        { $match: { timestamp: { $gte: cutOff } } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: [timeRange, "24h"] },
                { $dateToString: { format: "%H:00", date: "$timestamp" } },
                { $dateToString: { format: "%d %b", date: "$timestamp" } },
              ],
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const visitorsCount = visitorsResult[0]?.count || 0;
  const bounceRate = bounceResult[0]
    ? Math.round((bounceResult[0].singlePage / bounceResult[0].total) * 100)
    : 0;
  const activeOnline = onlineResult[0]?.count || 0;

  const chartData = {};
  if (timeRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const d2 = new Date(Date.now() - i * 60 * 60 * 1000);
      chartData[`${d2.getHours().toString().padStart(2, "0")}:00`] = 0;
    }
  } else {
    const days = timeRange === "30d" ? 30 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d2 = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = `${d2.getDate()} ${d2.toLocaleString("id-ID", { month: "short" })}`;
      chartData[label] = 0;
    }
  }

  chartDocs.forEach((doc) => {
    if (chartData[doc._id] !== undefined) chartData[doc._id] = doc.count;
  });

  return {
    visitors: visitorsCount,
    pageviews: totalCount,
    bounceRate,
    online: activeOnline || 1,
    chartData,
  };
}

// ───────────── Maintenance Mode ─────────────

async function getMaintenanceMode() {
  const d = await connect();
  const doc = await d.collection("settings").findOne({ _id: "maintenance" });
  return doc || { enabled: false, message: "Website sedang dalam perbaikan. Silakan kembali lagi nanti.", updatedAt: null };
}

async function setMaintenanceMode({ enabled, message }) {
  const d = await connect();
  const updateFields = {
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  };
  if (message !== undefined) {
    updateFields.message = message || "Website sedang dalam perbaikan. Silakan kembali lagi nanti.";
  }
  await d.collection("settings").updateOne(
    { _id: "maintenance" },
    { $set: updateFields },
    { upsert: true },
  );
}

// ───────────── Security: IP Log ─────────────

const MAX_SECURITY_LOGS = 500;

async function logSecurityEvent({ type, ip, path, userAgent, detail }) {
  const d = await connect();
  await d.collection("securityLogs").insertOne({
    type,          // 'blocked_ip' | 'rate_limit' | 'bot' | 'suspicious'
    ip: ip || "unknown",
    path: path || "/",
    userAgent: userAgent || "",
    detail: detail || "",
    timestamp: new Date(),
  });

  const count = await d.collection("securityLogs").countDocuments();
  if (count > MAX_SECURITY_LOGS) {
    const oldest = await d.collection("securityLogs")
      .find()
      .sort({ timestamp: 1 })
      .limit(count - MAX_SECURITY_LOGS)
      .toArray();
    const ids = oldest.map((o) => o._id);
    await d.collection("securityLogs").deleteMany({ _id: { $in: ids } });
  }
}

async function getSecurityLogs({ limit = 100, type } = {}) {
  const d = await connect();
  const query = type ? { type } : {};
  return d.collection("securityLogs")
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

async function getSecurityStats() {
  const d = await connect();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total24h, byType, topIps, totalBlocked] = await Promise.all([
    d.collection("securityLogs").countDocuments({ timestamp: { $gte: oneDayAgo } }),
    d.collection("securityLogs").aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]).toArray(),
    d.collection("securityLogs").aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$ip", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray(),
    d.collection("securityLogs").countDocuments({ type: "blocked_ip" }),
  ]);

  const typeMap = {};
  byType.forEach((t) => { typeMap[t._id] = t.count; });

  return {
    events24h: total24h,
    blocked: typeMap.blocked_ip || 0,
    rateLimited: typeMap.rate_limit || 0,
    botDetected: typeMap.bot || 0,
    suspicious: typeMap.suspicious || 0,
    topIps,
    totalBlocked,
  };
}

// ───────────── Blocked IPs ─────────────

async function getBlockedIps() {
  const d = await connect();
  const doc = await d.collection("settings").findOne({ _id: "blockedIps" });
  return doc ? (doc.ips || []) : [];
}

async function blockIp(ip) {
  const d = await connect();
  await d.collection("settings").updateOne(
    { _id: "blockedIps" },
    { $addToSet: { ips: ip }, $set: { updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}

async function unblockIp(ip) {
  const d = await connect();
  await d.collection("settings").updateOne(
    { _id: "blockedIps" },
    { $pull: { ips: ip }, $set: { updatedAt: new Date().toISOString() } },
  );
}

// ───────────── Force Admin Logout ─────────────

async function forceLogoutAdmin(username) {
  const d = await connect();
  const sessionsCol = d.collection("sessions");
  const allSessions = await sessionsCol.find({}).toArray();
  let deleted = 0;
  for (const s of allSessions) {
    try {
      const data = typeof s.session === "string" ? JSON.parse(s.session) : s.session;
      if (data && data.user && data.user.username === username) {
        await sessionsCol.deleteOne({ _id: s._id });
        deleted++;
      }
      if (data && data.devUser && data.devUser.username === username) {
        await sessionsCol.deleteOne({ _id: s._id });
        deleted++;
      }
    } catch (_) {
      // skip sessions that can't be parsed
    }
  }
  await d.collection("adminStatus").updateOne(
    { username },
    { $set: { sessionActive: false, updatedAt: new Date().toISOString() } },
  );
  return deleted;
}

async function forceLogoutAllAdmins() {
  const d = await connect();
  const sessionsCol = d.collection("sessions");
  const allSessions = await sessionsCol.find({}).toArray();
  let deleted = 0;
  for (const s of allSessions) {
    try {
      const data = typeof s.session === "string" ? JSON.parse(s.session) : s.session;
      if (data && (data.user || data.devUser)) {
        await sessionsCol.deleteOne({ _id: s._id });
        deleted++;
      }
    } catch (_) {}
  }
  await d.collection("adminStatus").updateMany(
    {},
    { $set: { sessionActive: false, updatedAt: new Date().toISOString() } },
  );
  return deleted;
}

// ───────────── Google PageSpeed Insights Config ─────────────

async function getPageSpeedConfig() {
  const d = await connect();
  const doc = await d.collection("settings").findOne({ _id: "pagespeedConfig" });
  return doc || { apiKey: "", updatedAt: null };
}

async function savePageSpeedConfig({ apiKey }) {
  const d = await connect();
  await d.collection("settings").updateOne(
    { _id: "pagespeedConfig" },
    {
      $set: {
        apiKey: apiKey || "",
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
}

// ───────────── Activity Log / Audit Trail ─────────────

const MAX_ACTIVITY_LOGS = 1000;

async function logActivity({ action, detail, username, ip }) {
  const d = await connect();
  await d.collection("activityLogs").insertOne({
    action,
    detail: detail || "",
    username: username || "system",
    ip: ip || "",
    timestamp: new Date(),
  });

  const count = await d.collection("activityLogs").countDocuments();
  if (count > MAX_ACTIVITY_LOGS) {
    const oldest = await d.collection("activityLogs")
      .find()
      .sort({ timestamp: 1 })
      .limit(count - MAX_ACTIVITY_LOGS)
      .toArray();
    const ids = oldest.map((o) => o._id);
    await d.collection("activityLogs").deleteMany({ _id: { $in: ids } });
  }
}

async function getActivityLogs({ limit = 50, action } = {}) {
  const d = await connect();
  const query = action ? { action } : {};
  return d.collection("activityLogs")
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

// ───────────── Content Stats ─────────────

async function getContentStats() {
  const d = await connect();
  const [events, admins, docs, backups, songs] = await Promise.all([
    d.collection("events").countDocuments(),
    d.collection("admins").countDocuments(),
    d.collection("events").countDocuments({ driveLink: { $exists: true, $ne: "" } }),
    d.collection("backups").countDocuments(),
    d.collection("songs").countDocuments(),
  ]);
  return {
    events,
    admins,
    documentation: docs,
    backups,
    songs,
  };
}

// ───────────── Backup (MongoDB-based, works on Vercel) ─────────────

async function createBackup(triggeredBy = "system") {
  const d = await connect();
  
  const [events, admins, metrics, adminStatus, settings, securityLogs, activityLogs, pageviews] = await Promise.all([
    d.collection("events").find({}).toArray(),
    d.collection("admins").find({}).toArray(),
    d.collection("metrics").find({}).toArray(),
    d.collection("adminStatus").find({}).toArray(),
    d.collection("settings").find({}).toArray(),
    d.collection("securityLogs").find({}).toArray(),
    d.collection("activityLogs").find({}).toArray(),
    d.collection("pageviews").find({}).sort({ timestamp: -1 }).limit(1000).toArray(),
  ]);

  const backupDoc = {
    createdAt: new Date(),
    triggeredBy,
    summary: {
      events: events.length,
      admins: admins.length,
      metrics: metrics.length,
      adminStatus: adminStatus.length,
      settings: settings.length,
      securityLogs: securityLogs.length,
      activityLogs: activityLogs.length,
      pageviews: pageviews.length,
    },
    data: JSON.stringify({
      events,
      admins,
      metrics,
      adminStatus,
      settings,
      securityLogs,
      activityLogs,
      pageviews,
    }),
  };

  await d.collection("backups").insertOne(backupDoc);

  const count = await d.collection("backups").countDocuments();
  if (count > 20) {
    const oldest = await d.collection("backups")
      .find()
      .sort({ createdAt: 1 })
      .limit(count - 20)
      .toArray();
    const ids = oldest.map((o) => o._id);
    await d.collection("backups").deleteMany({ _id: { $in: ids } });
  }

  await logActivity({
    action: "backup.create",
    detail: `Backup created: ${events.length} events, ${admins.length} admins`,
    username: triggeredBy,
  });

  return {
    id: backupDoc._id.toString(),
    createdAt: backupDoc.createdAt,
    summary: backupDoc.summary,
  };
}

async function getBackups({ limit = 10 } = {}) {
  const d = await connect();
  return d.collection("backups")
    .find({}, { projection: { data: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

async function getBackup(id) {
  const d = await connect();
  return d.collection("backups").findOne({ _id: new ObjectId(id) });
}

async function getLatestBackup() {
  const d = await connect();
  return d.collection("backups")
    .findOne({}, { sort: { createdAt: -1 }, projection: { data: 0 } });
}

// ════════════════════════════════════════════════
// ───────────── SONGS & PLAYLISTS ─────────────
// ════════════════════════════════════════════════

async function getSongs() {
  const d = await connect();
  return d.collection("songs").find({}, { projection: { mp3Data: 0 } }).sort({ title: 1 }).toArray();
}

async function getSong(id) {
  const d = await connect();
  return d.collection("songs").findOne({ id });
}

async function getSongMp3(id) {
  const d = await connect();
  return d.collection("songs").findOne({ id }, { projection: { mp3Data: 1, title: 1 } });
}

async function addSong(song) {
  const d = await connect();
  song.createdAt = new Date().toISOString();
  await d.collection("songs").insertOne(song);
  return song;
}

async function updateSong(id, patch) {
  const d = await connect();
  patch.updatedAt = new Date().toISOString();
  await d.collection("songs").updateOne({ id }, { $set: patch });
}

async function deleteSong(id) {
  const d = await connect();
  await d.collection("songs").deleteOne({ id });
  // Also remove from all playlists
  await d.collection("playlists").updateMany(
    {},
    { $pull: { songIds: id } }
  );
}

async function searchSongs(query) {
  const d = await connect();
  if (!query || query.trim().length === 0) {
    return d.collection("songs").find({}, { projection: { mp3Data: 0 } }).sort({ title: 1 }).toArray();
  }
  
  // Text search with priority on title
  const regex = new RegExp(query.trim(), "i");
  const results = await d.collection("songs").find(
    { $or: [{ title: regex }, { lyrics: regex }] },
    { projection: { mp3Data: 0 } }
  ).toArray();
  
  // Sort: title matches first
  results.sort((a, b) => {
    const aTitle = regex.test(a.title) ? 0 : 1;
    const bTitle = regex.test(b.title) ? 0 : 1;
    return aTitle - bTitle;
  });
  
  return results;
}

async function toggleFavorite(id) {
  const d = await connect();
  const song = await d.collection("songs").findOne({ id }, { projection: { favorite: 1 } });
  const newFav = !(song && song.favorite);
  await d.collection("songs").updateOne({ id }, { $set: { favorite: newFav, updatedAt: new Date().toISOString() } });
  return newFav;
}

async function getFavorites() {
  const d = await connect();
  return d.collection("songs").find({ favorite: true }, { projection: { mp3Data: 0 } }).sort({ title: 1 }).toArray();
}

// ───────────── Playlists ─────────────

async function getPlaylists() {
  const d = await connect();
  const playlists = await d.collection("playlists").find().sort({ createdAt: -1 }).toArray();
  // Enrich with song count
  for (const pl of playlists) {
    pl.songCount = (pl.songIds || []).length;
  }
  return playlists;
}

async function getPlaylist(id) {
  const d = await connect();
  const pl = await d.collection("playlists").findOne({ id });
  if (pl) {
    pl.songCount = (pl.songIds || []).length;
  }
  return pl;
}

async function createPlaylist(name) {
  const d = await connect();
  const id = require("crypto").randomUUID();
  const playlist = {
    id,
    name: name.trim(),
    songIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await d.collection("playlists").insertOne(playlist);
  return playlist;
}

async function addSongToPlaylist(playlistId, songId) {
  const d = await connect();
  await d.collection("playlists").updateOne(
    { id: playlistId },
    { $addToSet: { songIds: songId }, $set: { updatedAt: new Date().toISOString() } }
  );
}

async function removeSongFromPlaylist(playlistId, songId) {
  const d = await connect();
  await d.collection("playlists").updateOne(
    { id: playlistId },
    { $pull: { songIds: songId }, $set: { updatedAt: new Date().toISOString() } }
  );
}

async function deletePlaylist(id) {
  const d = await connect();
  await d.collection("playlists").deleteOne({ id });
}

async function getPlaylistSongs(playlistId) {
  const d = await connect();
  const pl = await d.collection("playlists").findOne({ id: playlistId });
  if (!pl || !pl.songIds || pl.songIds.length === 0) return [];
  return d.collection("songs").find(
    { id: { $in: pl.songIds } },
    { projection: { mp3Data: 0 } }
  ).sort({ title: 1 }).toArray();
}

module.exports = {
  connect,
  getClient,
  close,
  getEvents,
  getEvent,
  addEvent,
  updateEvent,
  deleteEvent,
  getAdmins,
  addAdmin,
  deleteAdmin,
  updateAdminPassword,
  incRequestMetrics,
  getMetrics,
  setAdminOnline,
  touchAdminActivity,
  setAdminOffline,
  getAdminStatuses,
  logPageView,
  getPageViewStats,
  getMaintenanceMode,
  setMaintenanceMode,
  logSecurityEvent,
  getSecurityLogs,
  getSecurityStats,
  getBlockedIps,
  blockIp,
  unblockIp,
  forceLogoutAdmin,
  forceLogoutAllAdmins,
  getPageSpeedConfig,
  savePageSpeedConfig,
  logActivity,
  getActivityLogs,
  getContentStats,
  createBackup,
  getBackups,
  getBackup,
  getLatestBackup,
  // Songs & Playlists
  getSongs,
  getSong,
  getSongMp3,
  addSong,
  updateSong,
  deleteSong,
  searchSongs,
  toggleFavorite,
  getFavorites,
  getPlaylists,
  getPlaylist,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
  getPlaylistSongs,
};
