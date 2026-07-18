const { MongoClient } = require("mongodb");

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
// FIX: sebelumnya status "online" murni event-based (cuma di-set true saat
// login, false saat klik Logout). Kalau admin nutup tab / session expire /
// server restart TANPA klik Logout, status "online: true" itu nyangkut di
// DB SELAMANYA -> dashboard nampilin admin "online" padahal sudah lama tidak
// aktif, dan "Last Online" juga cuma nunjuk waktu login (bukan aktivitas
// terakhir yang sebenarnya).
//
// Sekarang dipakai pola heartbeat: setiap request yang admin itu buat (lihat
// touchAdminActivity, dipanggil dari middleware ensureAuth di server.js)
// meng-update `lastSeen`. Status "online" DIHITUNG saat dibaca (bukan
// disimpan sebagai flag statis): admin dianggap online HANYA kalau sesinya
// masih aktif (belum logout) DAN ada aktivitas dalam beberapa menit terakhir.
// Ini sama seperti cara "Online Users" pengunjung situs dihitung di
// getPageViewStats (window 5 menit) -> otomatis "sembuh" sendiri tanpa perlu
// event logout yang eksplisit.
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

// Dipanggil di setiap request admin yang sudah login (lihat ensureAuth di
// server.js), fire-and-forget - supaya "Last Online" mencerminkan aktivitas
// nyata, bukan cuma waktu login.
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

  // FIX: sebelumnya 6 query Mongo dijalankan berurutan (await satu-satu),
  // padahal semuanya independen satu sama lain -> total waktu tunggu = jumlah
  // semua query. Dijalankan paralel via Promise.all, total waktu tunggu jadi
  // cuma sebesar query PALING LAMBAT (bisa motong latency dashboard drastis).
  // Query "topPaths" juga dihapus karena section "Top Pages" sudah tidak
  // dipakai di dashboard.
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

  // Chart Data
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

module.exports = {
  connect,
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
};