/**
 * Database Backup Script
 * 
 * Cara pakai:
 *   node scripts/backup.js             → backup dengan timestamp
 *   node scripts/backup.js restore      → restore dari backup terbaru
 *   node scripts/backup.js list         → lihat daftar backup
 * 
 * File backup disimpan di folder database/backups/
 * Tidak ter-commit ke git (ada di .gitignore)
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "database", "db.json");
const BACKUP_DIR = path.join(__dirname, "..", "database", "backups");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yy}${mm}${dd}_${hh}${min}`;
}

function backup() {
  ensureDir(BACKUP_DIR);

  if (!fs.existsSync(DB_PATH)) {
    console.error("❌ Database tidak ditemukan:", DB_PATH);
    console.log("   Jalankan server dulu agar database terbentuk.");
    process.exit(1);
  }

  const name = `db_backup_${timestamp()}.json`;
  const dest = path.join(BACKUP_DIR, name);

  fs.copyFileSync(DB_PATH, dest);
  console.log("✅ Backup berhasil!");
  console.log(`   File: ${dest}`);

  // Hitung jumlah event
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const events = data.events || [];
    console.log(`   Event tersimpan: ${events.length} event`);
  } catch (_) {}

  console.log(`   Ukuran: ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`);
}

function listBackups() {
  ensureDir(BACKUP_DIR);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("📂 Belum ada backup.");
    return;
  }

  console.log(`📂 Daftar Backup (${files.length} file):`);
  console.log("─".repeat(60));
  files.forEach((f, i) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    const size = (stat.size / 1024).toFixed(1);
    const date = stat.birthtime.toLocaleString("id-ID");
    console.log(`  ${i + 1}. ${f}`);
    console.log(`     📅 ${date} | ${size} KB`);
  });
}

function restore() {
  ensureDir(BACKUP_DIR);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("❌ Tidak ada backup untuk direstore.");
    process.exit(1);
  }

  const latest = files[0];
  const src = path.join(BACKUP_DIR, latest);

  // Backup dulu database yang sekarang sebelum ditimpa
  if (fs.existsSync(DB_PATH)) {
    const safetyBackup = path.join(BACKUP_DIR, `db_sebelum_restore_${timestamp()}.json`);
    fs.copyFileSync(DB_PATH, safetyBackup);
    console.log(`💾 Database lama dibackup ke: ${safetyBackup}`);
  }

  fs.copyFileSync(src, DB_PATH);

  const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  console.log("✅ Restore berhasil!");
  console.log(`   File: ${latest}`);
  console.log(`   Event: ${(data.events || []).length} event`);
  console.log(`   Admin: ${(data.admins || []).length} akun`);
}

// ── Main ──
const cmd = process.argv[2] || "backup";

if (cmd === "backup") {
  backup();
} else if (cmd === "list") {
  listBackups();
} else if (cmd === "restore") {
  restore();
} else {
  console.log("Perintah tidak dikenal. Gunakan: backup, list, atau restore");
  process.exit(1);
}