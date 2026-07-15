# Panduan Maintenance & Update Website GPI Eluzai Kids

## 📌 Masalah: Event hilang saat update fitur baru

**Penyebab:** File `database/db.json` (tempat menyimpan events, admin, dll) tertimpa saat deploy ulang kode.

**Solusi:** Database disimpan TERPISAH dari kode dan TIDAK di-commit ke git.

---

## 🔧 Langkah-langkah agar event tidak hilang

### 1. Cek file `.gitignore` (sudah otomatis)

Pastikan baris ini ada di `.gitignore`:

```
database/db.json
database/backups/
frontend/public/uploads/
```

Artinya: saat push ke GitHub, file database dan backup TIDAK ikut terupload. Kode aman di-update tanpa menyentuh data.

### 2. Backup sebelum update (WAJIB)

Jalankan command berikut SEBELUM update kode:

```bash
node scripts/backup.js
```

Hasil: file backup tersimpan di `database/backups/db_backup_20260715_1430.json`

### 3. Lihat daftar backup yang tersedia

```bash
node scripts/backup.js list
```

### 4. Restore jika terjadi masalah

```bash
node scripts/backup.js restore
```

Akan mengembalikan database ke kondisi backup terbaru.

### 5. Auto-backup saat server di-restart

Sudah ditambahkan di `backend/server.js` — setiap server restart, database otomatis di-backup sebelum kode baru dijalankan.

---

## 📋 Prosedur Update Fitur Baru (Step by Step)

### ✅ Aman — event tetap ada:

```
1. git pull                      ← ambil kode terbaru
2. node scripts/backup.js        ← backup database dulu
3. npm install                   ← install dependencies baru (jika ada)
4. node backend/server.js        ← jalanin server (database tetap utuh)
```

### ❌ Berbahaya — event bisa hilang:

```
✗ git pull (database ikut tertimpa)
✗ hapus folder dan clone ulang (database ikut terhapus)
✗ deploy ke Vercel tanpa setup database eksternal
```

---

## 🚀 Untuk Deployment ke Vercel / Hosting Online

**⚠️ PERHATIAN:** Vercel menggunakan filesystem read-only, jadi `db.json` tidak bisa disimpan di Vercel.

### Solusi untuk production:

Gunakan database eksternal gratis seperti:

1. **Supabase** (PostgreSQL, gratis 500MB) — www.supabase.com
2. **Railway** (PostgreSQL, gratis $5 credit) — www.railway.app
3. **MongoDB Atlas** (MongoDB, gratis 512MB) — www.mongodb.com/atlas

Jika tetap ingin menggunakan file JSON, jalankan di VPS (Virtual Private Server) seperti:

- DigitalOcean droplet ($6/bulan)
- Linode Nanode ($5/bulan)
- Hosting standard dengan Node.js support

---

## 💾 Cara Backup Manual (Tanpa Script)

1. Buka folder `database/`
2. Copy file `db.json` ke folder lain (Desktop, Google Drive, dll)
3. Rename dengan tanggal, misal `db_backup_15_Juli_2026.json`

Restore: tinggal copy balik file backup ke `database/db.json`

---

## 🔍 Troubleshooting

**Q: Event tiba-tiba hilang setelah git pull?**  
A: Jangan panik. Jalankan: `node scripts/backup.js restore`  
 File backup terakhir akan mengembalikan database.

**Q: Backup script error "database not found"?**  
A: Jalankan server dulu sekali agar `db.json` terbentuk, lalu backup.

**Q: Mau update fitur tapi takut data hilang?**  
A: Backup dulu: `node scripts/backup.js`  
 Jika terjadi error, restore: `node scripts/backup.js restore`
