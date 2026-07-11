# GPI Eluzai Kids - Website Gereja

Website landing page + admin dashboard untuk GPI Eluzai Kids.

## Tech Stack

- **Backend**: Node.js, Express
- **View Engine**: EJS
- **Database**: JSON file (`database/db.json`)
- **Auth**: express-session + bcrypt (password hashing)
- **File Upload**: multer
- **Ports**: 
  - Landing Page: `http://localhost:10082`
  - Admin Dashboard: `http://localhost:10083`

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Jalankan landing page (terminal 1)
npm start

# Jalankan admin dashboard (terminal 2)
npm run start:admin
```

Buka `http://localhost:10082` untuk landing page, dan `http://localhost:10083/login` untuk admin dashboard.

## Admin Dashboard

### Login Default

| Username | Password   |
|----------|------------|
| `admin`  | `admin123` |

> **PENTING**: Ganti password default segera setelah pertama kali login!

### Cara Mengganti Password Admin

Saat ini password admin disimpan dalam bentuk **hash** (bukan plain text) di `database/db.json`. Untuk mengganti password:

**Metode 1 - Langsung edit file (manual):**

1. Hapus file `database/db.json`
2. Restart admin server (`npm run start:admin`)
3. Server akan membuat admin baru dengan password `admin123`

**Metode 2 - Generate hash online:**

1. Kunjungi generator bcrypt online (contoh: https://bcrypt-generator.com)
2. Masukkan password baru, generate hash
3. Buka `database/db.json`
4. Ganti nilai `"passwordHash"` dengan hash baru
5. Restart admin server

### Cara Menambah Admin Baru

Saat ini sistem hanya mendukung **1 admin**. Untuk menambah, Anda perlu memodifikasi `backend/adminServer.js`:

1. Buka `backend/adminServer.js`
2. Cari bagian `ensureAdmin` (sekitar baris 15-24)
3. Ubah logika untuk support multiple admin, atau ganti username/password hash sesuai keinginan

Contoh jika ingin admin dengan username `admin2` password `rahasia123`:
```javascript
const passwordHash = await bcrypt.hash('rahasia123', 10);
db.setAdmin({ username: 'admin2', passwordHash });
```

### Fitur Admin Dashboard

- `Add New Event` - Tambah event dengan poster, tanggal, lokasi, Google Form link
- `Edit` - Ubah event yang sudah ada
- `Hapus Event` - Hapus event (dengan konfirmasi)
- `Add New Documentation` - Tambah link Google Drive dokumentasi ke event
- `Log out` - Keluar dari admin

## Struktur Folder

```
gereja/
├── backend/
│   ├── server.js          # Landing page server (port 10082)
│   ├── adminServer.js     # Admin dashboard server (port 10083)
│   ├── db.js              # Database helper (CRUD JSON)
│   └── views/
│       └── admin/         # Admin EJS templates
│           ├── login.ejs
│           ├── events.ejs
│           ├── form.ejs
│           └── documentation.ejs
│
├── frontend/
│   ├── views/             # Public EJS templates
│   │   ├── index.ejs      # Halaman utama landing page
│   │   └── partials/
│   │       ├── header.ejs # Navbar + head HTML
│   │       └── footer.ejs # Footer
│   └── public/            # Static assets (auto-served)
│       ├── css/style.css
│       ├── js/main.js
│       ├── images/
│       └── uploads/       # Uploaded poster images
│
├── database/
│   └── db.json            # Database file (admin + events)
│
├── scripts/
│   └── checkLanding.js    # Script pengecekan
│
└── package.json
```

## Tentang Password Hash (bcrypt)

Password admin tidak disimpan dalam bentuk teks biasa, melainkan dalam bentuk **hash** yang dihasilkan oleh library `bcrypt`.

Contoh hash yang tersimpan di `db.json`:
```
$2b$10$wEJKmhBv9Ug0/hI4pRq1tezLFkpLZdHaLrrcODV6kE7xj6AIyJotu
```

Format hash bcrypt:
```
$2b$10$[22 karakter salt][31 karakter hash]
```

- `$2b$` - Versi algoritma bcrypt
- `10` - Cost factor (semakin tinggi, semakin lama proses hashing, semakin aman)
- Salt (22 karakter) - Nilai acak unik per hash
- Hash (31 karakter) - Password yang sudah di-hash

**Keamanan**: Meskipun `db.json` bocor, password asli tidak bisa diketahui karena hash tidak bisa di-reverse (one-way function).

## API Endpoints

### Landing Page API
- `GET /api/events/:id` - Ambil detail event (response JSON)

### Admin API (dilindungi session)
- `POST /admin/api/events/delete` - Hapus event `{ id: "..." }`
- `POST /admin/api/documentation/add` - Tambah link Drive `{ eventId: "...", driveLink: "..." }`