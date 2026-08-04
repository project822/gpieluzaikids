// ============================================================
// GPI ELUZAI KIDS — Seed MongoDB Atlas dari database/*.json
// ------------------------------------------------------------
// Cara pakai:
//   npm run seed
//
// Apa yang dilakukan:
//   - info     -> collection `info`    (dokumen tunggal, key: "main")
//   - schedule -> collection `schedule` (dokumen tunggal, key: "main")
//   - classes  -> collection `classes`  (array; _id = id string asli,
//                agar slug /baby dsb. & addMember/deleteMember tetap jalan)
//   - attendance -> collection `attendance` (_id = id string asli,
//                agar deleteAttendance via { $eq: id } tetap jalan)
//   - admins   -> dari database/admins.json (jika ada; biasanya dibuat
//                otomatis oleh bootstrap server — PRD FR-10)
//
// Idempoten: aman dijalankan ulang (replaceOne upsert berdasarkan _id).
// ============================================================

const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.error("  ⚠️  Gagal set DNS server:", err.message);
}

require("dotenv").config();

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DATABASE_DIR = path.join(__dirname, "..", "database");
const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "gpi_eluzai_kids";

function readJSON(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  if (!uri) {
    console.error("  ❌ MONGODB_URI tidak diatur di .env — tidak ada yang di-seed.");
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  console.log(`  ✅ Terhubung ke MongoDB Atlas (db: ${dbName})`);

  const summary = {};

  // ---------- INFO (dokumen tunggal) ----------
  const info = readJSON("info");
  if (info) {
    await db.collection("info").replaceOne({ key: "main" }, { key: "main", ...info }, { upsert: true });
    summary.info = "OK";
  } else {
    summary.info = "SKIP (info.json tidak ada)";
  }

  // ---------- SCHEDULE (dokumen tunggal) ----------
  const schedule = readJSON("schedule");
  if (schedule) {
    await db
      .collection("schedule")
      .replaceOne({ key: "main" }, { key: "main", ...schedule }, { upsert: true });
    summary.schedule = "OK";
  } else {
    summary.schedule = "SKIP (schedule.json tidak ada)";
  }

  // ---------- CLASSES (array; _id = id string asli) ----------
  // Catatan: events.json sengaja TIDAK di-seed — /api/events membaca
  // database/events.json langsung via readDB (bukan lewat store/MongoDB).
  const classes = readJSON("classes");
  if (Array.isArray(classes) && classes.length) {
    let seeded = 0;
    for (const cls of classes) {
      const { id, ...rest } = cls;
      if (!id) {
        console.warn(`    ⚠️  Kelas tanpa id dilewati: ${JSON.stringify(rest).slice(0, 60)}...`);
        continue;
      }
      await db.collection("classes").replaceOne({ _id: id }, { _id: id, ...rest }, { upsert: true });
      seeded++;
    }
    summary.classes = `${seeded} kelas`;
  } else {
    summary.classes = "SKIP (classes.json kosong/tidak ada)";
  }

  // ---------- ATTENDANCE (array; _id = id string asli) ----------
  const attendance = readJSON("attendance");
  if (Array.isArray(attendance) && attendance.length) {
    let seeded = 0;
    for (const rec of attendance) {
      const { id, ...rest } = rec;
      if (!id) {
        console.warn(`    ⚠️  Record absensi tanpa id dilewati.`);
        continue;
      }
      await db.collection("attendance").replaceOne({ _id: id }, { _id: id, ...rest }, { upsert: true });
      seeded++;
    }
    summary.attendance = `${seeded} record`;
  } else {
    summary.attendance = "SKIP (attendance.json kosong/tidak ada)";
  }

  // ---------- ADMINS (dari admins.json bila ada — gitignored) ----------
  // admins.json yang ditulis fallback JSON server tidak punya field `id`
  // (hanya username, passwordHash, createdAt) — jadi pakai username sebagai
  // _id agar replaceOne idempoten (filter == dokumen pengganti).
  // PENTING: field `username` TETAP disimpan di dokumen — handleAdminLogin
  // mencari admin via `admins.find((a) => a.username === username)`.
  const admins = readJSON("admins");
  if (Array.isArray(admins) && admins.length) {
    let seeded = 0;
    for (const adm of admins) {
      if (!adm.username) {
        console.warn("    ⚠️  Admin tanpa username dilewati.");
        continue;
      }
      const { username, ...rest } = adm;
      await db
        .collection("admins")
        .replaceOne({ _id: username }, { _id: username, username, ...rest }, { upsert: true });
      seeded++;
    }
    summary.admins = `${seeded} admin`;
  } else {
    summary.admins = "SKIP (admins.json tidak ada — server akan bootstrap admin default saat start)";
  }

  console.log("");
  console.log("  Hasil seed:");
  for (const [k, v] of Object.entries(summary)) {
    console.log(`    • ${k}: ${v}`);
  }
  console.log("");

  // Verifikasi akhir
  for (const name of ["info", "schedule", "classes", "attendance", "admins"]) {
    const n = await db.collection(name).countDocuments();
    console.log(`  ${name}: ${n} dokumen`);
  }

  await client.close();
  console.log("  ✅ Seed selesai.");
}

main().catch((err) => {
  console.error("  ❌ Seed gagal:", err.message);
  process.exit(1);
});
