const { MongoClient } = require("mongodb");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority";
const DB_NAME = process.env.MONGO_DB_NAME || "gereja";

let client = null;
let db = null;

/**
 * Koneksi ke MongoDB (singleton) - cache untuk Vercel serverless
 */
async function connect() {
  if (db) return db;

  client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(DB_NAME);

  // Pastikan collections & indexes dibuat
  try {
    await db.collection("events").createIndex({ id: 1 }, { unique: true });
    await db.collection("admins").createIndex({ username: 1 }, { unique: true });
    await db.collection("pageviews").createIndex({ timestamp: -1 });
  } catch (e) {
    // Index mungkin sudah ada, ignore error
  }

  console.log("[MongoDB] Connected to", DB_NAME);
  return db;
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

async function setAdminOnline(username) {
  const d = await connect();
  await d.collection("adminStatus").updateOne(
    { username },
    {
      $set: {
        online: true,
        lastOnline: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
}

async function setAdminOffline(username) {
  const d = await connect();
  await d.collection("adminStatus").updateOne(
    { username },
    { $set: { online: false, updatedAt: new Date().toISOString() } },
  );
}

async function getAdminStatuses() {
  const d = await connect();
  const statuses = await d.collection("adminStatus").find().toArray();
  const result = {};
  statuses.forEach((s) => {
    result[s.username] = s;
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

  // Hitung visitors (unique IPs)
  const visitorsResult = await d
    .collection("pageviews")
    .aggregate([
      { $match: { timestamp: { $gte: cutOff } } },
      { $group: { _id: "$ip" } },
      { $count: "count" },
    ])
    .toArray();
  const visitorsCount = visitorsResult[0]?.count || 0;

  // Hitung total pageviews
  const totalCount = await d
    .collection("pageviews")
    .countDocuments({ timestamp: { $gte: cutOff } });

  // Bounce Rate (satu IP hanya punya 1 pageview)
  const bounceResult = await d
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
    .toArray();
  const bounceRate = bounceResult[0]
    ? Math.round((bounceResult[0].singlePage / bounceResult[0].total) * 100)
    : 0;

  // Online users (active in last 5 minutes)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineResult = await d
    .collection("pageviews")
    .aggregate([
      { $match: { timestamp: { $gte: fiveMinAgo } } },
      { $group: { _id: "$ip" } },
      { $count: "count" },
    ])
    .toArray();
  const activeOnline = onlineResult[0]?.count || 0;

  // Chart Data
  const chartData = {};
  if (timeRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      chartData[`${d.getHours().toString().padStart(2, "0")}:00`] = 0;
    }
  } else {
    const days = timeRange === "30d" ? 30 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = `${d.getDate()} ${d.toLocaleString("id-ID", { month: "short" })}`;
      chartData[label] = 0;
    }
  }

  const chartDocs = await d
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
    .toArray();
  chartDocs.forEach((doc) => {
    if (chartData[doc._id] !== undefined) chartData[doc._id] = doc.count;
  });

  // Top Paths
  const topPaths = await d
    .collection("pageviews")
    .aggregate([
      { $match: { timestamp: { $gte: cutOff } } },
      { $group: { _id: "$path", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, path: "$_id", count: 1 } },
    ])
    .toArray();

  return {
    visitors: visitorsCount,
    pageviews: totalCount,
    bounceRate,
    online: activeOnline || 1,
    chartData,
    topPaths,
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
  setAdminOffline,
  getAdminStatuses,
  logPageView,
  getPageViewStats,
  // Untuk migrasi data dari db.json ke MongoDB
  db,
  client,
};