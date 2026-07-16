# Panduan Migrasi Database ke MongoDB Atlas & Koneksi dari Vercel

Dokumen ini menjelaskan langkah-langkah untuk mengganti penyimpanan database dari file JSON lokal (`database/db.json`) ke **MongoDB Atlas** dan menghubungkannya dari **Vercel**.

---

## 1. Buat Cluster MongoDB Atlas

1. Buka [https://cloud.mongodb.com](https://cloud.mongodb.com) dan login/register.
2. Klik **"Build a Database"** → pilih **"Free Shared Cluster"** (M0 - gratis).
3. Pilih provider (AWS/GCP/Azure) dan region yang **paling dekat dengan pengguna** (misalnya `Singapore` untuk Indonesia).
4. Klik **"Create Cluster"** (proses memakan waktu 1-5 menit).

## 2. Konfigurasi Database Access & Network

### a) Database User

1. Di sidebar kiri → **Security** → **Database Access** → **"Add New Database User"**
2. Isi:
   - **Username**: `gereja_user` (atau terserah)
   - **Password**: klik **"Autogenerate Secure Password"** lalu **copy password** ke notepad sementara
   - **Built-in Role**: pilih **"Atlas Admin"**
3. Klik **"Add User"**

### b) Network Access

1. **Security** → **Network Access** → **"Add IP Address"**
2. Untuk development lokal: klik **"Add Current IP Address"**
3. Untuk Vercel: klik **"Allow Access from Anywhere"** (0.0.0.0/0) atau masukkan IP publik Vercel jika diketahui.
   > **Catatan**: Vercel menggunakan IP dinamis, jadi Anda harus mengizinkan `0.0.0.0/0` agar koneksi dari Vercel bisa bekerja.
4. Klik **"Confirm"**

## 3. Dapatkan Connection String

1. Di halaman cluster, klik **"Connect"** → **"Connect your application"**
2. Pilih:
   - **Driver**: `Node.js`
   - **Version**: `5.1 or later`
3. **Copy connection string**, contoh:
   ```
   mongodb+srv://gereja_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Ganti `<password>` dengan password user yang sudah dicatat di langkah 2a.
5. Ganti **`/?retryWrites=...`** menjadi **`/gereja?retryWrites=true&w=majority`** (nama database = `gereja`).

   Hasil akhir:

   ```
   mongodb+srv://gereja_user:PASSWORD_ANDA@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority
   ```

---

## 4. Install MongoDB Driver di Project

Jalankan perintah ini di terminal (root project `d:\gereja`):

```bash
npm install mongodb
```

---

## 5. Buat File `backend/dbMongo.js`

Buat file baru untuk menggantikan `db.js` dengan MongoDB. Berikut implementasi lengkapnya:

### `backend/dbMongo.js`

```javascript
const { MongoClient } = require("mongodb");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://gereja_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority";
const DB_NAME = process.env.MONGO_DB_NAME || "gereja";

let client = null;
let db = null;

/**
 * Koneksi ke MongoDB (singleton)
 */
async function connect() {
  if (db) return db;

  client = new MongoClient(MONGO_URI, {
    // Pool connection untuk performa lebih baik
    maxPoolSize: 10,
    // Timeout agar tidak hang
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(DB_NAME);

  // Pastikan collections & indexes dibuat
  await db.collection("events").createIndex({ id: 1 }, { unique: true });
  await db.collection("admins").createIndex({ username: 1 }, { unique: true });
  await db.collection("pageviews").createIndex({ timestamp: -1 });

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
  await d
    .collection("admins")
    .updateOne(
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
  await d
    .collection("adminStatus")
    .updateOne(
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

  const pipeline = [
    { $match: { timestamp: { $gte: cutOff } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        uniqueIps: { $addToSet: "$ip" },
        singlePageIps: { $addToSet: "$ip" },
        records: { $push: "$$ROOT" },
      },
    },
  ];

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
```

---

## 6. Ubah `backend/server.js` untuk Menggunakan MongoDB

Di `backend/server.js`:

### a) Ganti require db

```javascript
// HAPUS baris ini:
const db = require("./db");

// TAMBAHKAN:
const db = require("./dbMongo");

// Panggil connect() saat startup
(async () => {
  try {
    await db.connect();
    console.log("[DB] MongoDB connected");

    // Init default admin jika belum ada
    const admins = await db.getAdmins();
    if (!admins || admins.length === 0) {
      const bcrypt = require("bcrypt");
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.addAdmin({ username: "admin", passwordHash });
      console.log("Default admin created: username=admin password=admin123");
    }
  } catch (err) {
    console.error("[DB] MongoDB connection failed:", err.message);
    process.exit(1);
  }
})();
```

### b) Hapus blok `ensureAdmin()` yang lama

Hapus atau komentari kode ini (yang ada setelah middleware auth):

```javascript
// HAPUS block ini:
// (async function ensureAdmin() {
//   const admins = db.getAdmins();
//   ...
// })();
```

---

## 7. Set Environment Variables di Vercel

### Via Vercel Dashboard (Recommended)

1. Buka [https://vercel.com](https://vercel.com) → pilih project Anda
2. **Settings** → **Environment Variables**
3. Tambahkan:

| Name             | Value                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`      | `mongodb+srv://gereja_user:PASSWORD_ANDA@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority` |
| `MONGO_DB_NAME`  | `gereja`                                                                                                |
| `SESSION_SECRET` | `(buat string random panjang, misal: 6a8f1c3b9e2d4a7f)`                                                 |

4. Klik **Save**, lalu redeploy project.

### Via File `.env` (Lokal)

Buat file `.env` di root project (`d:\gereja\.env`):

```
MONGO_URI=mongodb+srv://gereja_user:PASSWORD_ANDA@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority
MONGO_DB_NAME=gereja
```

**Catatan**: Jangan commit file `.env` ke Git. Pastikan sudah di `.gitignore`.

---

## 8. Migrasi Data dari db.json ke MongoDB Atlas

Jalankan script migrasi berikut untuk memindahkan data lama:

### `scripts/migrateToMongo.js`

```javascript
/**
 * Script migrasi dari db.json ke MongoDB Atlas
 *
 * Cara pakai:
 *   1. Set environment variable MONGO_URI (atau edit langsung di script)
 *   2. Jalankan: node scripts/migrateToMongo.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://gereja_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority";
const DB_NAME = process.env.MONGO_DB_NAME || "gereja";
const DB_JSON_PATH = path.join(__dirname, "..", "database", "db.json");

async function migrate() {
  console.log("=== Migrasi db.json → MongoDB Atlas ===\n");

  // 1. Baca db.json
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error("db.json tidak ditemukan di:", DB_JSON_PATH);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf8"));
  console.log(`File db.json berhasil dibaca.`);

  // 2. Konek ke MongoDB
  console.log("Menghubungkan ke MongoDB Atlas...");
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  const db = client.db(DB_NAME);
  console.log("Terhubung ke MongoDB Atlas.\n");

  // 3. Migrasi Events
  if (data.events && data.events.length > 0) {
    // Hapus semua data lama (opsional, untuk menghindari duplikat)
    await db.collection("events").deleteMany({});
    await db.collection("events").insertMany(data.events);
    console.log(`✓ Events: ${data.events.length} data berhasil dimigrasi`);
  } else {
    console.log("✓ Events: tidak ada data");
  }

  // 4. Migrasi Admins
  if (data.admins && data.admins.length > 0) {
    await db.collection("admins").deleteMany({});
    await db
      .collection("admins")
      .insertMany(
        data.admins.map((a) => ({ ...a, createdAt: new Date().toISOString() })),
      );
    console.log(`✓ Admins: ${data.admins.length} data berhasil dimigrasi`);
  } else {
    console.log("✓ Admins: tidak ada data");
  }

  // 5. Migrasi Metrics
  if (data.metrics) {
    await db
      .collection("metrics")
      .updateOne(
        { _id: "global" },
        {
          $set: {
            ...data.metrics,
            lastRequestAt: data.metrics.lastRequestAt || null,
          },
        },
        { upsert: true },
      );
    console.log(`✓ Metrics: berhasil dimigrasi`);
  }

  // 6. Migrasi Admin Status
  if (data.adminStatus) {
    const statusEntries = Object.entries(data.adminStatus);
    if (statusEntries.length > 0) {
      for (const [username, status] of statusEntries) {
        await db
          .collection("adminStatus")
          .updateOne({ username }, { $set: status }, { upsert: true });
      }
      console.log(
        `✓ Admin Status: ${statusEntries.length} data berhasil dimigrasi`,
      );
    }
  }

  // 7. Pastikan indexes
  await db.collection("events").createIndex({ id: 1 }, { unique: true });
  await db.collection("admins").createIndex({ username: 1 }, { unique: true });
  await db.collection("pageviews").createIndex({ timestamp: -1 });

  console.log("\n✓ Indexes berhasil dibuat");
  console.log("\n=== Migrasi Selesai! ===");

  await client.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});
```

### Jalankan Migrasi

```bash
cd d:\gereja
set MONGO_URI=mongodb+srv://gereja_user:PASSWORD_ANDA@cluster0.xxxxx.mongodb.net/gereja?retryWrites=true&w=majority
node scripts/migrateToMongo.js
```

---

## 9. Update `vercel.json` (Opsional)

Jika Anda menggunakan Vercel, pastikan file `vercel.json` tetap seperti ini:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "backend/server.js"
    }
  ]
}
```

Tidak perlu perubahan karena MongoDB Atlas diakses via network, bukan file.

---

## 10. Catatan Penting

### Keamanan

- **Jangan pernah commit** `MONGO_URI` atau password ke GitHub.
- Gunakan **Environment Variables** di Vercel Dashboard.
- Untuk development lokal, gunakan file `.env` yang sudah di `.gitignore`.

### Performa

- MongoDB Atlas M0 (free tier) memiliki **512MB storage** - cukup untuk ribuan events.
- Koneksi dari Vercel ke MongoDB Atlas Singapore memiliki latency ~30-50ms.
- Gunakan **connection pooling** (already implemented di `dbMongo.js`).
- Untuk Vercel Serverless, koneksi MongoDB **disimpan di global cache** agar tidak membuat koneksi baru setiap request.

### Cold Start (Vercel Serverless)

- Fungsi serverless Vercel akan "tidur" setelah tidak digunakan.
- Request pertama setelah idle akan mengalami **cold start** (~1-3 detik).
- Solusi: gunakan [MongoDB Atlas Serverless](https://www.mongodb.com/atlas/serverless) (bukan M0 shared) atau gunakan [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) untuk keep-warm.

### Jika Ingin Tetap menggunakan JSON File (Alternatif)

Untuk penyimpanan sederhana, `db.js` sudah cukup baik dengan fallback ke `/tmp` di Vercel. Namun:

- Data akan hilang saat fungsi Vercel di-redeploy atau di-scale.
- Tidak bisa sharing data antar functions.
- Lebih lambat karena read/write file setiap request.

MongoDB Atlas adalah solusi yang **rekomendasi untuk production**.

---

## Troubleshooting

| Masalah                                                 | Solusi                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MongooseServerSelectionError: connection timed out`    | Pastikan Network Access di Atlas mengizinkan `0.0.0.0/0`                                                                     |
| `Authentication failed`                                 | Cek username & password di connection string. Password mungkin mengandung karakter spesial yang harus di-encode (URL encode) |
| `Cannot read properties of null (reading 'collection')` | Pastikan `connect()` dipanggil sebelum operasi database                                                                      |
| Data tidak muncul setelah deploy                        | Cek Environment Variables di Vercel Dashboard sudah di-set dengan benar                                                      |
| Connection string error di Vercel                       | Jangan pakai karakter spesial seperti `@`, `#`, `$` di password. Jika terpaksa, URL-encode: `@` → `%40`, `#` → `%23`         |

---

## Referensi

- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel + MongoDB Integration](https://vercel.com/integrations/mongodbatlas)
