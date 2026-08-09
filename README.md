# ⛪ GPI Eluzai — Website Landing Page

Website **full-stack JavaScript** untuk gereja **GPI Eluzai** (Gereja Pantekosta di Indonesia).

Dibangun dengan **Next.js (App Router)**, **Bootstrap 5**, font **lokal Inter & Hanken Grotesk**, warna utama **biru tua** dengan aksen **hijau**, default **light mode**, dan responsif di semua perangkat (desktop, tablet, mobile).

---

## ✨ Fitur

| Fitur | Keterangan |
| --- | --- |
| **Beranda (satu halaman)** | Seluruh konten dalam satu halaman scroll: **Hero** (badge, tagline, deskripsi, CTA + **slider foto suasana gereja** — tanpa statistik), **Informasi** (**1 banner** landscape **16:9** agar fokus), **Event** (card: nama, tema, tanggal, open gate, waktu mulai, lokasi + tombol **Daftar** & **Detail**), **Lokasi** (peta + alamat), dan **Kontak** (WhatsApp, Instagram, YouTube). Animasi **fade-in & fade-out** dua arah saat scroll di seluruh section (diadaptasi dari template `lib/scroll.js`) |
| **Detail Event** | `/event/[id]` — format lengkap + **peta Google Maps**. Pendaftaran **otomatis ditutup H-2**: tombol Daftar berubah menjadi **Foto** (Google Drive) bila link foto sudah diisi; jika belum, tombol **terkunci (kursor terblokir)**. Form event mewajibkan nama, tema, foto (4:5), tanggal, open gate, waktu mulai, lokasi, link Google Maps & Form — link Google Drive dikelola **terpisah** dari form |
| **Jadwal Mingguan** | `#schedule` (setelah Informasi) — 2 kartu: **Ibadah Sekolah Minggu** & **Latihan**. Hanya status **ada/tidak** (centang ✓ hijau / silang ✗ merah), waktu **mulai** saja, dan tanggal (selalu **Hari Minggu** terdekat). Deskripsi otomatis: "Selamat Beribadah"/"Latihan Musik/Vocal" saat ada, "Tidak ada ibadah"/"Tidak ada latihan" saat tidak |
| **Arsip Event** | `/events` — semua event (1 tahun penuh) dalam satu halaman: **filter tahun & bulan**, **pencarian** (nama/tema/lokasi), dan **paginasi** (9 per halaman). Beranda hanya menampilkan **3 event mendatang + 3 lampau terbaru** agar tidak menumpuk |
| **Admin** | `/admin` — login (multi-user, lihat bawah), dashboard, CRUD **jadwal** (tanggal hanya Hari Minggu), event, & banner informasi dengan upload gambar (PNG/JPG/WebP, maks 4MB, rasio otomatis dipotong). **Toggle 👁 tampil/sembunyikan** per event: event lama bisa disembunyikan dari publik tanpa dihapus (data & foto tetap tersimpan). Event diurutkan **tanggal terdekat + urutan penambahan** (tanpa field unggulan/urutan) |
| **Mode Tema** | Situs publik default **light** (toggle 🌙/☀️ opsional, kunci `eluzai-theme`). Area admin punya tema **terpisah & independen** (kunci `eluzai-admin-theme`, default light, toggle di sidebar) — tidak mengikuti tema situs publik. Anti-flash via skrip inline di `app/layout.js` |

## 🖼️ Upload Gambar (via /admin)

- **Banner Informasi**: format **PNG/JPG/WebP**, maks **4MB**, rasio **16:9**. Hanya **1 banner** yang dapat ditampilkan — mengunggah banner baru akan **menggantikan** banner yang ada (agar penyampaian fokus).
- **Foto Event**: format **PNG/JPG/WebP**, maks **4MB**, rasio **4:5**.
- Gambar dipotong (cover-crop) & dikompres otomatis di browser menjadi WebP, lalu disimpan sebagai data URL di database — tanpa layanan eksternal.

## ✨ Animasi Scroll (fade-in & fade-out)

Template `lib/scroll.js` / `lib/scroll.min.js` menyediakan animasi scroll-triggered dua arah (fade-in saat masuk viewport, **fade-out halus saat keluar viewport**) plus stagger untuk grup item. Diadaptasi natively ke React:

- `components/ui/Reveal.jsx` — fade **dua arah** untuk elemen tunggal (props: `delay`, `duration`, `once`).
- `components/ui/Stagger.jsx` — grup item muncul berurutan (`i × baseDelay` saat masuk, berurutan terbalik saat keluar), dipakai di grid event, kontak, dan lokasi.

Keduanya menghormati `prefers-reduced-motion`, punya fallback tanpa `IntersectionObserver`, dan konten tetap terlihat tanpa JavaScript (`html:not(.js)` + skrip pendeteksi di `app/layout.js`).

## 🛠️ Teknologi

- **Next.js 16** (App Router, React 19) — full-stack JavaScript
- **Bootstrap 5.3** + CSS kustom (desain sistem sendiri di `app/globals.css`)
- **Font lokal** Inter & Hanken Grotesk via `next/font/local` (`fonts/`) — tanpa Google Fonts (privasi & kecepatan)
- **MongoDB + Mongoose** sebagai database
- **JWT (jose)** + cookie httpOnly untuk sesi admin

## 📁 Struktur Folder

```
├── app/
│   ├── (public)/            # Frontend USER (situs publik)
│   │   ├── page.js          # Landing satu halaman (semua section)
│   │   ├── events/          # Halaman arsip event (filter + pencarian + paginasi)
│   │   └── event/[id]/      # Halaman detail event + peta
│   ├── admin/               # Frontend ADMIN
│   │   ├── login/           # Halaman login
│   │   └── (panel)/         # Semua halaman panel — layout-nya MEMERIKSA ulang
│   │       ├── layout.js    #   sesi JWT di sisi server (defense-in-depth)
│   │       ├── page.js      # Dashboard
│   │       ├── informasi/   # CRUD banner (upload 16:9)
│   │       ├── jadwal/      # CRUD jadwal mingguan
│   │       ├── absensi/     # Kelola absensi & anggota kelas
│   │       └── events/      # CRUD event (upload 4:5 + tautan)
│   └── api/                 # Backend API (app router routes)
├── components/
│   ├── user/                # Frontend USER: Navbar, Footer, HomeSlider, section landing, kartu event
│   ├── admin/               # Frontend ADMIN: AdminShell, login, CRUD generik, upload gambar, toggle tema admin
│   └── ui/                  # Primitif UI bersama: Icons, SectionHeading, PageHeader, Reveal, Stagger, ThemeToggle, useSiteTheme
├── database/
│   └── models/              # Skema Mongoose (database layer)
├── fonts/                   # Font LOKAL: Inter (400–700) + Hanken Grotesk (600–800)
├── lib/                     # Backend helpers: data, format, repo, db, auth, token, security, validasi
└── proxy.js                 # Lapisan keamanan request-level (konvensi Next.js 16)
```

## 🚀 Menjalankan di Lokal

```bash
npm install
npm run dev        # buka http://localhost:22889
```

Tanpa mengisi `MONGODB_URI`, situs berjalan dengan **data demo** — seluruh halaman dan CRUD admin tetap berfungsi (data tersimpan in-memory selama server menyala). Store in-memory disimpan di `globalThis` sehingga perubahan dari admin **langsung terlihat** di halaman publik pada proses yang sama.

> **Catatan mode demo:** karena data tersimpan in-memory, perubahan admin akan hilang saat server di-restart. Gunakan MongoDB (`MONGODB_URI`) untuk penyimpanan permanen.

### Login Admin (multi-user)

- Buka `http://localhost:22889/admin`
- **User database** (dibuat lewat `/api/dev/users` atau langsung oleh project `/dev`) menjadi sumber utama; kredensial env (`admin` / `eluzai123`) tetap berfungsi sebagai **super-admin cadangan**.
- Untuk menjalankan build produksi di lokal: `ADMIN_USERNAME=admin ADMIN_PASSWORD=eluzai123 ADMIN_SECRET=<secret> npm run build && npm start`

### Project /dev → tambah user admin

Project `/dev` (project terpisah) dapat menambah & melihat user admin lewat API ini:

- `POST /api/dev/users` — body `{ "username": "...", "password": "..." }`
- `GET /api/dev/users` — daftar user
- Header wajib: `X-Dev-Key: <DEV_API_KEY>` (nilai dari `.env.local` — harus sama di kedua project).
- Password di-hash **scrypt** di server; endpoint ini bebas CSRF (kunci sendiri), tapi tetap dilindungi rate limit IP/blocklist.

## 🍃 Menghubungkan MongoDB Atlas

1. Buat kluster **M0 (Shared, free)** di [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Isi di `.env.local`: `MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/Database?appName=<cluster>` — **nama database wajib eksplisit** (mis. `Database`), bukan default `test`.
3. Restart `npm run dev`. Data demo otomatis di-seed saat pertama diakses.

> **DNS resolver:** pada sebagian mesin (umumnya Windows), resolver DNS Node
> terbaca `127.0.0.1` tanpa layanan di sana sehingga koneksi Atlas gagal
> (`querySrv ECONNREFUSED`). Aplikasi mendeteksi kondisi ini dan otomatis
> memakai `8.8.8.8` / `1.1.1.1`. Untuk memaksa server DNS tertentu, set
> `DNS_SERVERS=8.8.8.8,1.1.1.1` di `.env.local`.

> **Prioritas env:** variabel yang terisi (non-kosong) di `.env.local` selalu
> menang atas nilai environment luar — loader env Next.js (dotenv) tidak menimpa
> `process.env` yang sudah ada, sehingga aplikasi menerapkan nilai `.env.local`
> secara eksplisit saat start. Nilai kosong di `.env.local` dibiarkan (env luar
> tetap menang). File `.env.<mode>.local` (mis. `.env.production.local`)
> diterapkan setelah `.env.local` dan berprioritas lebih tinggi.

## 🔐 Keamanan

- Rute `/admin/*` dilindungi middleware/proxy berbasis JWT cookie **httpOnly** (`SameSite=Lax`, `Secure` di produksi).
- API CRUD admin mewajibkan sesi valid + **token CSRF** (double-submit cookie `eluzai_csrf` ↔ header `X-CSRF-Token`).
- **Rate limiting login**: 5 percobaan/15 menit per IP & username, blokir 10 menit.
- **Sanitasi input** anti stored XSS di semua route POST/PUT (`lib/sanitize.js`).
- **Security headers** (CSP, HSTS, X-Frame-Options, dll.) di `next.config.mjs`.
- **Upload gambar** divalidasi ukuran, format, dan rasio di sisi klien; dicek kembali di API (MIME whitelist).
- Mode darurat: `MAINTENANCE_MODE=1` (halaman publik → 503) dan `BLOCKED_IPS=1.2.3.4,...` (→ 403).
- Di lingkungan produksi, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (atau `ADMIN_PASSWORD_HASH` scrypt), dan `ADMIN_SECRET` wajib diisi (kredensial default ditolak).

## ⚡ Performa

- **Gambar lewat `/img/[id]`** — base64 tidak lagi inline di HTML publik; disajikan sebagai biner dengan `Cache-Control: immutable` + cache-buster `?v=updatedAt` (gambar baru otomatis saat admin mengganti foto).
- **ISR 60 detik** di `/`, `/events`, `/event/[id]` (plus `generateStaticParams`) — halaman tidak dirender ulang tiap kunjungan.
- **Proxy ringan** — verifikasi JWT hanya untuk `/admin`; `/img` dilewati proxy sepenuhnya.
- **Font lokal** (Inter 400/500/600/700 + Hanken Grotesk 600/700/800 via `next/font/local`) — tanpa permintaan Google Fonts + `poweredByHeader: false`.

Detail lengkap: lihat [`SECURITY.md`](./SECURITY.md).
