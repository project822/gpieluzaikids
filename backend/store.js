// ============================================================
// GPI ELUZAI KIDS — Lapisan Penyimpanan (Store)
// ------------------------------------------------------------
// MongoDB Atlas (jika MONGODB_URI diatur & terhubung).
// Jika tidak, memakai fallback file JSON di folder database/.
// ============================================================

const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DATABASE_DIR = path.join(__dirname, "..", "database");
const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "gpi_eluzai_kids";

let client = null;
let db = null;
let clientPromise = null;

// ---------- Koneksi ----------
async function connect() {
  if (!uri) {
    console.log("  ⚠️  MONGODB_URI belum diatur — memakai fallback database/ (JSON).");
    return false;
  }
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    clientPromise = client.connect().then(() => client);
    await clientPromise;
    db = client.db(dbName);
    console.log(`  ✅ Terhubung ke MongoDB Atlas (db: ${dbName})`);
    return true;
  } catch (err) {
    console.error(`  ❌ Gagal terhubung MongoDB: ${err.message}`);
    console.log("  ⚠️  Memakai fallback database/ (JSON).");
    clientPromise = null;
    db = null;
    return false;
  }
}

const isConnected = () => !!db;

// Promise koneksi untuk connect-mongo (MongoStore session — SECURITY.md §3.5)
function getClient() {
  return clientPromise;
}

// ---------- Helper JSON fallback ----------
function readJSON(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}
function writeJSON(name, data) {
  fs.writeFileSync(path.join(DATABASE_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf8");
}

// ============================================================
// INFO (dokumen tunggal)
// ============================================================
async function getInfo() {
  if (db) {
    const doc = await db.collection("info").findOne({ key: "main" });
    if (doc) {
      const { _id, key, ...rest } = doc;
      return rest;
    }
  }
  return readJSON("info") || {};
}

async function setInfo(info) {
  const { _id, key, ...rest } = info;
  if (db) {
    await db.collection("info").updateOne({ key: "main" }, { $set: rest }, { upsert: true });
  } else {
    writeJSON("info", rest);
  }
  return rest;
}

// ============================================================
// SCHEDULE (dokumen tunggal — ibadah & latihan)
// ============================================================
async function getSchedule() {
  if (db) {
    const doc = await db.collection("schedule").findOne({ key: "main" });
    if (doc) {
      const { _id, key, ...rest } = doc;
      return rest;
    }
  }
  return readJSON("schedule") || {};
}

async function setSchedule(schedule) {
  const { _id, key, ...rest } = schedule;
  if (db) {
    await db.collection("schedule").updateOne({ key: "main" }, { $set: rest }, { upsert: true });
  } else {
    writeJSON("schedule", rest);
  }
  return rest;
}

// ============================================================
// LIST — kelas (array dokumen)
// ============================================================
async function getList(name) {
  if (db) {
    const docs = await db.collection(name).find({}).toArray();
    if (docs.length) {
      return docs.map((d) => {
        const { _id, ...rest } = d;
        return { id: _id.toString(), ...rest };
      });
    }
  }
  return readJSON(name) || [];
}

async function addItem(name, item) {
  if (db) {
    const result = await db.collection(name).insertOne({ ...item, createdAt: new Date() });
    return { id: result.insertedId.toString(), ...item };
  }
  const list = readJSON(name) || [];
  const newItem = { id: Date.now().toString(), ...item };
  list.push(newItem);
  writeJSON(name, list);
  return newItem;
}

async function deleteItem(name, id) {
  if (db) {
    await db.collection(name).deleteOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : { $eq: id },
    });
    return;
  }
  writeJSON(name, (readJSON(name) || []).filter((x) => String(x.id) !== String(id)));
}

// ============================================================
// ANGGOTA KELAS (array nama di dalam dokumen kelas)
// ============================================================
async function addMember(classId, member) {
  if (db) {
    await db.collection("classes").updateOne(
      { _id: ObjectId.isValid(classId) ? new ObjectId(classId) : { $eq: classId } },
      { $push: { anggota: member } }
    );
    return member;
  }
  const list = readJSON("classes") || [];
  const idx = list.findIndex((x) => String(x.id) === String(classId));
  if (idx === -1) throw new Error("Kelas tidak ditemukan");
  if (!Array.isArray(list[idx].anggota)) list[idx].anggota = [];
  list[idx].anggota.push(member);
  writeJSON("classes", list);
  return member;
}

async function deleteMember(classId, memberId) {
  if (db) {
    await db.collection("classes").updateOne(
      { _id: ObjectId.isValid(classId) ? new ObjectId(classId) : { $eq: classId } },
      { $pull: { anggota: { id: memberId } } }
    );
    return;
  }
  const list = readJSON("classes") || [];
  const idx = list.findIndex((x) => String(x.id) === String(classId));
  if (idx === -1) throw new Error("Kelas tidak ditemukan");
  list[idx].anggota = (list[idx].anggota || []).filter((m) => String(m.id) !== String(memberId));
  writeJSON("classes", list);
}

// ============================================================
// BANNER (dengan gambar — disimpan base64 di database)
// ============================================================
async function getBanners() {
  if (db) {
    const docs = await db.collection("banners").find({}).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => ({
      id: d._id.toString(),
      judul: d.judul,
      url: d.url,
      deskripsi: d.deskripsi || "",
      contentType: d.contentType,
      createdAt: d.createdAt,
    }));
  }
  return (readJSON("banners") || []).map(({ image, ...rest }) => rest);
}

async function addBanner(banner) {
  const { image, ...meta } = banner;
  if (db) {
    const result = await db.collection("banners").insertOne({
      ...meta,
      image: Buffer.isBuffer(image) ? image : Buffer.from(image || "", "base64"),
      createdAt: new Date(),
    });
    return { id: result.insertedId.toString(), ...meta };
  }
  const list = readJSON("banners") || [];
  const newB = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...meta, image };
  list.push(newB);
  writeJSON("banners", list);
  return { id: newB.id, ...meta };
}

async function getBannerById(id) {
  if (db) {
    const doc = await db.collection("banners").findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : { $eq: id },
    });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }
  return (readJSON("banners") || []).find((x) => String(x.id) === String(id)) || null;
}

async function deleteBanner(id) {
  if (db) {
    await db.collection("banners").deleteOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : { $eq: id },
    });
    return;
  }
  writeJSON("banners", (readJSON("banners") || []).filter((x) => String(x.id) !== String(id)));
}

// ============================================================
// ABSENSI (daftar kehadiran anak per kelas & tanggal)
// ============================================================
async function getAttendance() {
  if (db) {
    const docs = await db.collection("attendance").find({}).sort({ tanggal: -1, createdAt: -1 }).toArray();
    return docs.map((d) => {
      const { _id, ...rest } = d;
      return { id: _id.toString(), ...rest };
    });
  }
  const list = readJSON("attendance") || [];
  // Urutkan sama seperti jalur MongoDB: tanggal & createdAt terbaru di depan
  return list.sort((a, b) => String(b.tanggal || "").localeCompare(String(a.tanggal || "")) || 0);
}

// Cari absensi untuk kelas + tanggal tertentu (untuk cegah duplikat)
async function findAttendanceByClassDate(tanggal, kelasId) {
  if (db) {
    const doc = await db.collection("attendance").findOne({
      tanggal: String(tanggal),
      kelasId: String(kelasId),
    });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }
  const list = readJSON("attendance") || [];
  return (
    list.find(
      (x) => String(x.tanggal) === String(tanggal) && String(x.kelasId) === String(kelasId)
    ) || null
  );
}

async function addAttendance(record) {
  if (db) {
    const result = await db.collection("attendance").insertOne({
      ...record,
      createdAt: new Date(),
    });
    return { id: result.insertedId.toString(), ...record };
  }
  const list = readJSON("attendance") || [];
  const newRec = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...record };
  list.push(newRec);
  writeJSON("attendance", list);
  return newRec;
}

async function updateAttendance(id, record) {
  if (db) {
    const result = await db.collection("attendance").updateOne(
      { _id: ObjectId.isValid(id) ? new ObjectId(id) : { $eq: id } },
      { $set: { ...record, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) throw new Error("Data absensi tidak ditemukan");
    return { id, ...record };
  }
  const list = readJSON("attendance") || [];
  const idx = list.findIndex((x) => String(x.id) === String(id));
  if (idx === -1) throw new Error("Data absensi tidak ditemukan");
  list[idx] = { ...list[idx], ...record, updatedAt: new Date().toISOString() };
  writeJSON("attendance", list);
  return { id, ...record };
}

async function deleteAttendance(id) {
  if (db) {
    await db.collection("attendance").deleteOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : { $eq: id },
    });
    return;
  }
  writeJSON("attendance", (readJSON("attendance") || []).filter((x) => String(x.id) !== String(id)));
}

// ============================================================
// ADMIN (PRD docs/PRD-ADMIN-LOGIN.md — collection `admins`)
// ============================================================
async function getAdmins() {
  if (db) {
    const docs = await db.collection("admins").find({}).toArray();
    return docs.map((d) => {
      const { _id, ...rest } = d;
      return { id: _id.toString(), ...rest };
    });
  }
  return readJSON("admins") || [];
}

async function addAdmin({ username, passwordHash }) {
  if (db) {
    const result = await db.collection("admins").insertOne({
      username,
      passwordHash,
      createdAt: new Date(),
    });
    return { id: result.insertedId.toString(), username, passwordHash };
  }
  const list = readJSON("admins") || [];
  const existing = list.find((a) => a.username === username);
  const doc = { username, passwordHash, createdAt: new Date().toISOString() };
  if (existing) {
    Object.assign(existing, { passwordHash, updatedAt: new Date().toISOString() });
  } else {
    list.push(doc);
  }
  writeJSON("admins", list);
  return doc;
}

async function setAdminOnline(username) {
  const fields = { online: true, lastActiveAt: new Date() };
  if (db) {
    await db.collection("admins").updateOne({ username }, { $set: fields });
    return;
  }
  const list = readJSON("admins") || [];
  const a = list.find((x) => x.username === username);
  if (a) {
    a.online = true;
    a.lastActiveAt = new Date().toISOString();
    writeJSON("admins", list);
  }
}

async function setAdminOffline(username) {
  if (db) {
    await db.collection("admins").updateOne({ username }, { $set: { online: false } });
    return;
  }
  const list = readJSON("admins") || [];
  const a = list.find((x) => x.username === username);
  if (a) {
    a.online = false;
    writeJSON("admins", list);
  }
}

async function touchAdminActivity(username) {
  const fields = { lastActiveAt: new Date() };
  if (db) {
    await db.collection("admins").updateOne({ username }, { $set: fields });
    return;
  }
  const list = readJSON("admins") || [];
  const a = list.find((x) => x.username === username);
  if (a) {
    a.lastActiveAt = new Date().toISOString();
    writeJSON("admins", list);
  }
}

// ============================================================
// SECURITY (SECURITY.md §3.10–3.11)
// ------------------------------------------------------------
// maintenance mode, blocked IP, dan audit log keamanan.
// Di MongoDB: collection `security` (dokumen ber-key) + `securityLogs`.
// Fallback JSON: file database/security.json.
// ============================================================

const SECURITY_JSON_FILE = "security";
const MAX_SECURITY_LOG = 500;

async function readSecurityDoc(key, fallback) {
  if (db) {
    const doc = await db.collection("security").findOne({ key });
    if (!doc) return fallback;
    const { _id, key: _k, value, ...rest } = doc;
    // value bisa array (blockedIps) atau objek (maintenance)
    return value !== undefined ? value : rest;
  }
  const data = readJSON(SECURITY_JSON_FILE) || {};
  return key in data ? data[key] : fallback;
}

async function writeSecurityDoc(key, value) {
  if (db) {
    await db.collection("security").updateOne({ key }, { $set: { value } }, { upsert: true });
    return;
  }
  const data = readJSON(SECURITY_JSON_FILE) || {};
  data[key] = value;
  writeJSON(SECURITY_JSON_FILE, data);
}

// ---------- Maintenance mode ----------
async function getMaintenanceMode() {
  const mode = await readSecurityDoc("maintenance", { enabled: false, message: "" });
  return { enabled: !!mode.enabled, message: mode.message || "Website sedang diperbaiki." };
}

async function setMaintenanceMode({ enabled, message } = {}) {
  const value = {
    enabled: !!enabled,
    message: String(message || "Website sedang diperbaiki."),
  };
  await writeSecurityDoc("maintenance", value);
  return value;
}

// ---------- Blocked IP ----------
async function getBlockedIps() {
  const doc = await readSecurityDoc("blockedIps", []);
  return Array.isArray(doc) ? doc.filter((x) => typeof x === "string") : [];
}

async function blockIp(ip) {
  const ips = await getBlockedIps();
  if (!ip || ips.includes(ip)) return ips;
  ips.push(ip);
  await writeSecurityDoc("blockedIps", ips);
  return ips;
}

async function unblockIp(ip) {
  const ips = (await getBlockedIps()).filter((x) => x !== ip);
  await writeSecurityDoc("blockedIps", ips);
  return ips;
}

// ---------- Security logging (audit trail) ----------
async function logSecurityEvent({ type, ip, path, userAgent, detail } = {}) {
  const record = {
    type: ["blocked_ip", "rate_limit", "bot", "suspicious"].includes(type) ? type : "suspicious",
    ip: String(ip || ""),
    path: String(path || ""),
    userAgent: String(userAgent || "").slice(0, 300),
    detail: String(detail || "").slice(0, 500),
    at: new Date().toISOString(),
  };
  if (db) {
    await db.collection("securityLogs").insertOne(record);
    // Batasi maksimal 500 entri (hapus yang tertua)
    const count = await db.collection("securityLogs").countDocuments();
    if (count > MAX_SECURITY_LOG) {
      const oldest = await db
        .collection("securityLogs")
        .find({})
        .sort({ at: 1 })
        .limit(count - MAX_SECURITY_LOG)
        .toArray();
      if (oldest.length) {
        await db.collection("securityLogs").deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
      }
    }
    return record;
  }
  const data = readJSON(SECURITY_JSON_FILE) || {};
  const logs = Array.isArray(data.logs) ? data.logs : [];
  logs.push(record);
  if (logs.length > MAX_SECURITY_LOG) logs.splice(0, logs.length - MAX_SECURITY_LOG);
  data.logs = logs;
  writeJSON(SECURITY_JSON_FILE, data);
  return record;
}

async function getSecurityLogs({ limit = 100, type } = {}) {
  let logs;
  if (db) {
    const filter = type ? { type } : {};
    const docs = await db
      .collection("securityLogs")
      .find(filter)
      .sort({ at: -1 })
      .limit(Math.min(limit, MAX_SECURITY_LOG))
      .toArray();
    logs = docs.map((d) => {
      const { _id, ...rest } = d;
      return rest;
    });
  } else {
    const data = readJSON(SECURITY_JSON_FILE) || {};
    const all = Array.isArray(data.logs) ? data.logs : [];
    logs = all
      .filter((l) => !type || l.type === type)
      .slice(-limit)
      .reverse();
  }
  return logs;
}

async function getSecurityStats() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const logs = await getSecurityLogs({ limit: MAX_SECURITY_LOG });
  const recent = logs.filter((l) => new Date(l.at).getTime() >= since);
  const countByType = (t) => recent.filter((l) => l.type === t).length;
  const ipCount = {};
  recent.forEach((l) => {
    if (l.ip) ipCount[l.ip] = (ipCount[l.ip] || 0) + 1;
  });
  const topIps = Object.entries(ipCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }));
  return {
    events24h: recent.length,
    blocked: countByType("blocked_ip"),
    rateLimited: countByType("rate_limit"),
    botDetected: countByType("bot"),
    suspicious: countByType("suspicious"),
    topIps,
  };
}

module.exports = {
  connect,
  isConnected,
  getClient,
  getInfo,
  setInfo,
  getSchedule,
  setSchedule,
  getList,
  addItem,
  deleteItem,
  addMember,
  deleteMember,
  getBanners,
  addBanner,
  getBannerById,
  deleteBanner,
  getAttendance,
  findAttendanceByClassDate,
  addAttendance,
  updateAttendance,
  deleteAttendance,
  getAdmins,
  addAdmin,
  setAdminOnline,
  setAdminOffline,
  touchAdminActivity,
  getMaintenanceMode,
  setMaintenanceMode,
  getBlockedIps,
  blockIp,
  unblockIp,
  logSecurityEvent,
  getSecurityLogs,
  getSecurityStats,
};
