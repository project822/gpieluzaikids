/**
 * Script migrasi dari db.json ke MongoDB Atlas
 *
 * Cara pakai:
 *   1. Set environment variable MONGO_URI (WAJIB, tidak ada fallback placeholder lagi)
 *   2. Jalankan: node scripts/migrateToMongo.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = process.env.MONGO_DB_NAME || "gereja";
const DB_JSON_PATH = path.join(__dirname, "..", "database", "db.json");

async function migrate() {
  console.log("=== Migrasi db.json → MongoDB Atlas ===\n");

  // 0. Validasi MONGO_URI wajib ada (fallback placeholder lama berbahaya:
  //    kalau lupa di-set, script akan mencoba connect ke host palsu dan gagal membingungkan)
  if (!MONGO_URI) {
    console.error(
      "MONGO_URI belum di-set. Jalankan dengan: MONGO_URI='mongodb+srv://...' node scripts/migrateToMongo.js",
    );
    process.exit(1);
  }

  // 1. Baca db.json
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error("db.json tidak ditemukan di:", DB_JSON_PATH);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf8"));
  } catch (e) {
    console.error("Gagal membaca/parse db.json:", e.message);
    process.exit(1);
  }
  console.log("File db.json berhasil dibaca.");

  // 2. Konek ke MongoDB
  console.log("Menghubungkan ke MongoDB Atlas...");
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Terhubung ke MongoDB Atlas.\n");

    // 3. Migrasi Events
    if (data.events && data.events.length > 0) {
      await db.collection("events").deleteMany({});
      await db.collection("events").insertMany(data.events);
      console.log(`✓ Events: ${data.events.length} data berhasil dimigrasi`);
    } else {
      console.log("✓ Events: tidak ada data");
    }

    // 4. Migrasi Admins
    if (data.admins && data.admins.length > 0) {
      await db.collection("admins").deleteMany({});
      await db.collection("admins").insertMany(
        data.admins.map((a) => ({ ...a, createdAt: new Date().toISOString() })),
      );
      console.log(`✓ Admins: ${data.admins.length} data berhasil dimigrasi`);
    } else {
      console.log("✓ Admins: tidak ada data");
    }

    // 5. Migrasi Metrics
    if (data.metrics) {
      await db.collection("metrics").updateOne(
        { _id: "global" },
        {
          $set: {
            ...data.metrics,
            lastRequestAt: data.metrics.lastRequestAt || null,
          },
        },
        { upsert: true },
      );
      console.log("✓ Metrics: berhasil dimigrasi");
    } else {
      console.log("✓ Metrics: tidak ada data");
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
      } else {
        console.log("✓ Admin Status: tidak ada data");
      }
    } else {
      console.log("✓ Admin Status: tidak ada data");
    }

    // 7. Migrasi Pageviews
    if (data.pageviews && data.pageviews.length > 0) {
      const pageviews = data.pageviews.map((pv) => ({
        ...pv,
        timestamp: new Date(pv.timestamp),
      }));
      await db.collection("pageviews").deleteMany({});
      await db.collection("pageviews").insertMany(pageviews);
      console.log(`✓ Pageviews: ${pageviews.length} data berhasil dimigrasi`);
    } else {
      console.log("✓ Pageviews: tidak ada data");
    }

    // 8. Pastikan indexes
    await db.collection("events").createIndex({ id: 1 }, { unique: true });
    await db.collection("admins").createIndex({ username: 1 }, { unique: true });
    await db.collection("pageviews").createIndex({ timestamp: -1 });

    console.log("\n✓ Indexes berhasil dibuat");
    console.log("\n=== Migrasi Selesai! ===");

    process.exitCode = 0;
  } catch (err) {
    console.error("\nMigrasi gagal:", err.message);
    process.exitCode = 1;
  } finally {
    // Pastikan koneksi selalu ditutup, baik sukses maupun gagal
    await client.close().catch(() => {});
  }
}

migrate();