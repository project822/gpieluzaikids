# PRD — Halaman Login Admin

**Dokumen:** Product Requirements Document (PRD)
**Fitur:** Halaman Login Admin (`/admin/login`)
**Tujuan:** Spesifikasi lengkap & dapat direplikasi **sama persis** di project lain (copy-paste).
**Status:** Final
**Berlaku untuk stack:** Node.js + Express + EJS + MongoDB + CSS vanilla (tanpa framework frontend)

---

## 1. Ringkasan (Summary)

Halaman login admin adalah gerbang autentikasi untuk seluruh route di bawah `/admin/*`.
Pengguna admin memasukkan username & password, sistem memverifikasi kredensial
terhadap database (bcrypt), lalu membuat **session server-side** yang bertahan 14 hari.
Halaman ini juga dilengkapi **rate limiting 3 dimensi** (per-IP, per-akun, per-IP+akun),
proteksi CSRF, security headers, dan fallback default admin untuk setup pertama.

Satu hal penting: PRD ini dibuat dari implementasi nyata yang sudah berjalan di
produksi (Vercel serverless + MongoDB Atlas), jadi semua nilai (token warna,
durasi animasi, konfigurasi rate limit, struktur session) adalah nilai final
yang terverifikasi — bukan asumsi.

---

## 2. Konteks & Tujuan

| Item | Detail |
|---|---|
| Route utama | `GET /admin/login` (render form), `POST /admin/login` (proses login) |
| Route alias | `GET /login` → redirect ke `/admin/login`; `POST /login` → sama dengan POST `/admin/login` (backward compat) |
| Route canonical | `GET /admin` → render form login langsung |
| Proteksi | Middleware `ensureAuth` pada semua route `/admin/*` kecuali login |
| Logout | `GET /admin/logout` → destroy session → redirect ke `/admin/login` |
| Target user | Admin konten (1+ akun) yang mengelola event, jadwal, dokumentasi |

**Tujuan utama:**
1. Autentikasi admin dengan aman (bcrypt + session server-side).
2. Mencegah brute-force (rate limiting 3 dimensi).
3. Pengalaman login yang mulus, konsisten dengan design system "Deep Ocean"
   yang dipakai seluruh situs (glassmorphism, glow biru, font Hanken Grotesk + Inter).
4. Dapat direplikasi 1:1 ke project baru tanpa perubahan perilaku.

---

## 3. Stack Teknologi & Dependensi

**Runtime:** Node.js 20.x

**Dependensi yang wajib ada** (versi terverifikasi dari `package.json` project asal):

```json
{
  "express": "^4.18.2",
  "ejs": "^3.1.9",
  "express-session": "^1.17.3",
  "connect-mongo": "^6.0.0",
  "mongodb": "^7.5.0",
  "bcrypt": "^5.1.0",
  "dotenv": "^17.4.2",
  "compression": "^1.8.1"
}
```

**Opsional (di project asal, bukan bagian inti login):** `sharp`, `multer`, `uuid`,
`@vercel/analytics`, `@vercel/speed-insights`.

**Ikon:** Font Awesome 6 (`/vendor/font-awesome/css/all.min.css`) — dipakai ikon
`fa-user` & `fa-lock` di dalam input. Bisa diganti SVG inline, tapi untuk "sama
persis" gunakan Font Awesome.

**Font:** `Hanken Grotesk` (display/heading) & `Inter` (body) — self-hosted woff2.

---

## 4. Struktur File (referensi implementasi)

```
project/
├── backend/
│   ├── server.js          # Semua route login, session, security middleware
│   └── rateLimit.js       # Rate limiter login 3 dimensi
├── admin/
│   └── login/
│       ├── admin-login.ejs  # Template halaman login (EJS)
│       └── login.css        # CSS khusus halaman login
└── frontend/
    └── public/
        ├── css/
        │   ├── variables.css   # Design tokens (wajib)
        │   ├── base.css        # Reset, body gradient, container (wajib)
        │   └── components.css  # .auth-card, .submit-btn, .error, form (wajib)
        └── images/
            └── logo-placeholder.png  # Logo 56×56 (bisa diganti)
```

**Rute static (wajib dipetakan di server):**
- `/css/*` → `frontend/public/css/` (atau direktori CSS project baru)
- `/admin-assets/*` → direktori `admin/` (menyajikan `login/login.css`)
- `/images/*` → `frontend/public/images/` (logo: `logo-placeholder.png`)
- `/vendor/*` → Font Awesome

> **Catatan aset:** di repo project asal, `frontend/public/images/logo-placeholder.png`
> **ada** (logo login). Namun **tidak ada** direktori `vendor/` (Font Awesome) dan
> tidak ada static mount `/vendor` — ikon `fa-user`/`fa-lock` di project asal
> berpotensi tidak tampil. Untuk replikasi "sama persis" sekaligus benar: sediakan
> Font Awesome di `/vendor/font-awesome/css/all.min.css` (self-host) atau ganti
> dengan SVG inline — tampilan tetap konsisten karena CSS `.input-icon` sudah
> mengatur posisi/warna ikon.

---

## 5. Kebutuhan Fungsional (Functional Requirements)

### FR-1 — Menampilkan halaman login
- `GET /admin/login` merender form login dengan `error: null`.
- `GET /admin` juga merender form login (canonical route).
- `GET /login` redirect 302 ke `/admin/login`.

### FR-2 — Form login
- Field **Username**: `type="text"`, `name="username"`, `id="admin-username"`,
  `required`, `autocomplete="username"`, placeholder `Username`, ikon `fa-user`.
- Field **Password**: `type="password"`, `name="password"`, `id="admin-password"`,
  `required`, `autocomplete="current-password"`, placeholder `Password`, ikon `fa-lock`.
- Tombol submit: `class="submit-btn"`, teks `Login`, `type="submit"`, full-width.
- Form `method="post" action="/admin/login"`.

### FR-3 — Verifikasi kredensial
- Username dicocokkan **case-sensitive** terhadap field `username` di collection `admins`.
- Password diverifikasi dengan `bcrypt.compare(password, admin.passwordHash)`.
- Jika username tidak ditemukan **atau** password salah → render ulang halaman
  dengan `error: "Invalid credentials"` (pesan sama untuk kedua kasus, tidak
  membocorkan username mana yang valid).

### FR-4 — Session (server-side)
- Setelah sukses: `req.session.user = { username }`.
- Session disimpan di **MongoStore** (collection `sessions`) dengan fallback MemoryStore.
- Cookie session:
  - `maxAge`: 14 hari (ms) = `14 * 24 * 60 * 60 * 1000`
  - `httpOnly: true`
  - `secure: "auto"`
  - `sameSite: "lax"`
  - `secret` dari env `SESSION_SECRET` (fallback random UUID + warning).
- `saveUninitialized: false`, `resave: false`.

### FR-5 — Redirect setelah login
- Default redirect: `/admin/events`.
- Jika ada `req.session.redirectTo` (disimpan oleh `ensureAuth` saat admin
  dipaksa ke login), redirect ke URL tersebut **hanya jika** memenuhi aturan:
  - Tidak mengandung `/dashboard` dan `/dev/`, dan
  - diawali `/admin/` atau `/events` atau `/documentation`, atau sama dengan `/`.
- `redirectTo` dihapus setelah dipakai.

### FR-6 — Rate limiting (anti brute-force)
- Middleware `rateLimitLogin` dengan konfigurasi route:
  - `windowMs: 15 * 60 * 1000` (15 menit)
  - `max: 5` (5 percobaan per window)
  - `blockMs: 10 * 60 * 1000` (blokir 10 menit)
- Pelacakan **3 dimensi sekaligus**:
  1. Per IP (`req.ip`)
  2. Per username (`acct::<username lowercased>`)
  3. Per kombinasi IP+username (`ipacct::<ip>::<username lowercased>`)
- Jika salah satu dimensi diblokir → `HTTP 429` + render ulang halaman login
  dengan pesan: `"Terlalu banyak percobaan. Coba lagi setelah <N> detik."`
- State rate limit disimpan di memory (reset saat server restart), dengan
  pembersih entri basi tiap 30 menit (prevent memory leak).

### FR-7 — Proteksi route admin
- Middleware `ensureAuth`:
  - Jika `req.session.user` ada → lanjut (plus fire-and-forget `touchAdminActivity`).
  - Jika tidak → simpan `req.session.redirectTo = req.originalUrl`, redirect ke `/admin/login`.
- Semua route `/admin/*` (events, schedule, documentation, dll.) dipasangi `ensureAuth`.

### FR-8 — Logout
- `GET /admin/logout`:
  - Ambil username dari session.
  - `req.session.destroy()`.
  - Panggil `db.setAdminOffline(username)` (fire-and-forget).
  - Redirect ke `/admin/login`.

### FR-9 — CSRF
- Login routes (`/admin/login`, `/login`, `/dev/login`, dll.) **dikecualikan** dari
  validasi CSRF karena session belum ada.
- Route lain di bawah CSRF protection (session token + `X-CSRF-Token` header / `_csrf` body).

### FR-10 — Bootstrap default admin (first-run)
- Saat server start, jika collection `admins` kosong **dan** env `DISABLE_DEFAULT_ADMIN`
  tidak diset:
  - Buat admin dari `DEFAULT_ADMIN_USERNAME` (default `admin`) &
    `DEFAULT_ADMIN_PASSWORD` (default `admin123`), hash bcrypt cost 10.
- Setelah deploy produksi, set `DISABLE_DEFAULT_ADMIN=1`.

---

## 6. Kebutuhan Non-Fungsional (NFR)

### NFR-1 — Keamanan (security headers — semua route)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy`:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://vitals.vercel-insights.com https://www.googletagmanager.com https://unpkg.com`
  - `style-src 'self' 'unsafe-inline'`
  - `font-src 'self'`
  - `img-src 'self' data:`
  - `connect-src 'self' https://vitals.vercel-insights.com`
  - `frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`

### NFR-2 — HTTPS redirect (production)
- `app.set("trust proxy", 1)` — wajib agar `req.ip` & `req.secure` benar di belakang proxy.
- Jika `NODE_ENV === "production"` dan request tidak secure → redirect 301 ke HTTPS.

### NFR-3 — Sanitasi input
- Semua string di body POST/PUT/PATCH di-strip tag HTML (`/<[^>]*>/g`)
  sebelum diproses — mencegah stored XSS (lapisan kedua setelah auto-escape EJS).

### NFR-4 — Aksesibilitas
- `<label for>` terhubung ke input.
- `autocomplete` diisi (`username` / `current-password`).
- `required` pada kedua field.
- `prefers-reduced-motion: reduce` → semua animasi/transisi dimatikan.

### NFR-5 — Responsivitas
- Kartu login: `width: min(100%, 440px)`, di tengah (`margin: 0 auto`).
- Container: `width: min(100% - 32px, 1280px)`.
- Padding kartu responsif: `clamp(24px, 5vw, 36px)`.

### NFR-6 — Performa & caching
- CSS/JS statis publik: `Cache-Control: public, max-age=31536000, immutable`.
- CSS/JS admin: `public, max-age=86400, stale-while-revalidate=86400`
  (bukan immutable agar update CSS admin tidak basi).

### NFR-7 — Maintenance mode tidak memblokir login
- Middleware maintenance mode melewati semua path `/admin/*`, `/dev/*`, `/api/*`,
  dan aset statis — admin & dev tetap bisa login saat maintenance aktif.

---

## 7. Spesifikasi UI/UX

### 7.1 Struktur visual (top → bottom)

```
<body>  (body.page-is-ready, background gradient Deep Ocean)
└── <main class="container">
    └── <div class="auth-page" style="margin-top:30px">
        └── <div class="auth-card hover-expand" style="margin:0 auto">
            ├── <div class="logo-wrap">
            │   ├── <img logo 56×56, radius 12px, margin-bottom 8px>
            │   └── <h1>Admin Login</h1>
            ├── [jika error] <p class="error">pesan error</p>
            └── <form method="post" action="/admin/login">
                ├── .form-group (Username + input ber-ikon fa-user)
                ├── .form-group (Password + input ber-ikon fa-lock)
                └── <button class="submit-btn">Login</button>
```

### 7.2 Design tokens yang dipakai (dari variables.css — tema gelap default)

| Token | Nilai | Fungsi |
|---|---|---|
| `--font-display` | `'Hanken Grotesk', system-ui, sans-serif` | Judul |
| `--font-body` | `'Inter', system-ui, sans-serif` | Body/input |
| `--bg` | `#0F172A` | Warna dasar body |
| `--bg-gradient` | `linear-gradient(170deg,#0a1628 0%,#0F172A 20%,#152240 50%,#1a2d5a 80%,#0F172A 100%)` | Latar body |
| `--glass-bg` | `rgba(30, 41, 59, 0.5)` | Latar kartu |
| `--glass-border` | `rgba(51, 65, 85, 0.5)` | Border kartu/input |
| `--glass-blur` | `12px` | Blur kartu |
| `--radius-lg` | `1.125rem` (18px) | Radius kartu login |
| `--radius-sm` | `0.5rem` (8px) | Radius input |
| `--radius-md` | `0.875rem` (14px) | Radius tombol |
| `--on-surface` | `#FFFFFF` | Teks utama |
| `--on-surface-variant` | `#94A3B8` | Placeholder / muted |
| `--electric-blue` | `#3B82F6` | Border input saat focus |
| `--primary-strong` | `#2563EB` | Latar tombol Login |
| `--primary-strong-hover` | `#1D4ED8` | Hover tombol |
| `--error` | `#ffb4ab` | Teks error |
| `--muted` | `var(--on-surface-variant)` | Warna ikon input |

### 7.3 Komponen & animasi

1. **`.auth-card`** — glassmorphism: `border:1px solid var(--glass-border)`,
   `background:var(--glass-bg)`, `backdrop-filter:blur(12px)`, `border-radius:var(--radius-lg)`,
   `width:min(100%,440px)`, `padding:clamp(24px,5vw,36px)`, `position:relative`, `overflow:hidden`.
2. **`.auth-card.hover-expand`** — hover/focus-within: `translateY(-3px) scale(1.03)`
   + `box-shadow: 0 0 40px rgba(59,130,246,0.12)`; transisi `transform 320ms cubic-bezier(0.2,0.9,0.2,1)`.
3. **Animasi masuk kartu** (dari `login.css`): `admin-auth-fade-in 560ms cubic-bezier(0.22,1,0.36,1) backwards`
   → `from { opacity:0; transform: translateY(16px) }` ke normal. Menggunakan `backwards`
   (bukan `both`) agar `hover-expand` tetap berfungsi setelah animasi selesai.
4. **`.submit-btn`** — tombol primary full-width (`width:100%`, `border:0`):
   `background:var(--primary-strong)`, `color:#fff`, `border-radius:var(--radius-md)`,
   `min-height:42px`, glow `box-shadow:0 0 20px rgba(59,130,246,0.2)`;
   hover: bg `#1D4ED8` + `translateY(-1px)` + glow 30px.
5. **`.error`** — banner merah: `border:1px solid rgba(239,68,68,0.3)`,
   `background:rgba(239,68,68,0.1)`, `color:var(--error)`, `border-radius:var(--radius-md)`,
   `padding:10px 12px`, `font-weight:600` (di template login admin juga diberi
   `color:var(--accent-2); font-weight:700` via inline style → **perhatikan**: token
   `--accent-2` tidak terdefinisi di variables.css; di praktiknya warna error
   muncul dari class `.error`. Untuk replikasi persis, pakai markup berikut apa adanya).
6. **Input ber-ikon** — `.input-with-icon { position:relative }`, ikon `fa-user`/`fa-lock`
   absolut di `left:12px; top:50%; translateY(-50%)` berwarna `var(--muted)`,
   input diberi `padding-left:42px`.
7. **Fokus input** — `border-color:var(--electric-blue)` + `box-shadow:0 0 0 3px
   rgba(59,130,246,0.15), 0 0 20px rgba(59,130,246,0.08)`, bg sedikit lebih terang.

### 7.4 Copy (teks)

| Elemen | Teks |
|---|---|
| Title tab | `Admin Login` |
| H1 | `Admin Login` |
| Label 1 | `Username` |
| Placeholder 1 | `Username` |
| Label 2 | `Password` |
| Placeholder 2 | `Password` |
| Tombol | `Login` |
| Error (kredensial salah) | `Invalid credentials` |
| Error (rate limited) | `Terlalu banyak percobaan. Coba lagi setelah <N> detik.` |
| Lang | `id` |

---

## 8. Kode Sumber Lengkap (copy-paste "sama persis")

### 8.1 `admin/login/admin-login.ejs`

```ejs
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Login</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/admin-assets/login/login.css">
    <link rel="stylesheet" href="/vendor/font-awesome/css/all.min.css">

    <!-- Vercel Analytics -->
    <script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
    <script defer src="/_vercel/insights/script.js"></script>

  </head>
  <body class="page-is-ready">
    <main class="container">
      <div class="auth-page" style="margin-top: 30px;">
        <div class="auth-card hover-expand" style="margin: 0 auto;">

          <div class="logo-wrap">
            <img
              src="/images/logo-placeholder.png"
              alt="Logo"
              style="width: 56px; height: 56px; border-radius: 12px; display: inline-block; margin-bottom: 8px;"
            >
            <h1>Admin Login</h1>
          </div>

          <% if (error) { %>
            <p class="error" style="color: var(--accent-2); font-weight: 700;"><%= error %></p>
          <% } %>

          <form method="post" action="/admin/login">
            <div class="form-group" style="margin-bottom: 14px;">
              <label for="admin-username">Username</label>
              <div class="input-with-icon">
                <i class="fas fa-user input-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; opacity: 0.9; pointer-events: none; color: var(--muted);"></i>
                <input
                  id="admin-username"
                  type="text"
                  name="username"
                  placeholder="Username"
                  required
                  autocomplete="username"
                >
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="admin-password">Password</label>
              <div class="input-with-icon">
                <i class="fas fa-lock input-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; opacity: 0.9; pointer-events: none; color: var(--muted);"></i>
                <input
                  id="admin-password"
                  type="password"
                  name="password"
                  placeholder="Password"
                  required
                  autocomplete="current-password"
                >
              </div>
            </div>

            <button class="submit-btn" type="submit">Login</button>
          </form>
        </div>
      </div>
    </main>
  </body>
</html>
```

### 8.2 `admin/login/login.css`

```css
/* ── Admin Login styles ── */
html { scroll-behavior: smooth; }
[id] { scroll-margin-top: 80px; }

/* Fade-in halus untuk kartu login (mirip animasi konten di halaman publik).
   Pakai fill-mode backwards (bukan both) supaya setelah animasi selesai,
   transform kembali ke nilai normal — hover-expand (translateY/scale) tetap bekerja. */
.auth-card {
  animation: admin-auth-fade-in 560ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

@keyframes admin-auth-fade-in {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .auth-card { animation: none; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 8.3 CSS pendukung wajib (dari design system publik)

**`frontend/public/css/style.css`** (entry point — urutan import menentukan cascade):

```css
@import url("/css/variables.css");
@import url("/css/base.css");
@import url("/css/navbar.css");
@import url("/css/hero.css");
@import url("/css/components.css");
@import url("/css/layout.css");
@import url("/css/scroll.css");
```

> **Catatan replikasi:** dari 7 file yang di-import, halaman login admin **hanya
> memakai** `variables.css`, `base.css`, dan `components.css`. `navbar.css`,
> `hero.css`, `layout.css`, `scroll.css` tidak diperlukan untuk login. Di project
> baru, agar tidak ada request 404: (a) salin ketiga file yang dipakai lalu
> kurangi daftar `@import` di `style.css`, atau (b) buat file stub kosong untuk
> empat file sisanya — hasil visual login sama persis.

**`variables.css`** → salin utuh dari project asal (lihat bagian 7.2 untuk token kunci).
Minimum yang wajib ada agar halaman login tampil benar:
`--font-display`, `--font-body`, `--bg`, `--bg-gradient`, `--glass-bg`,
`--glass-border`, `--glass-blur`, `--radius-sm/md/lg`, `--on-surface`,
`--on-surface-variant`, `--electric-blue`, `--primary-strong`,
`--primary-strong-hover`, `--error`, `--muted`, `--accent`.

**`base.css`** (bagian yang dipakai login):

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { min-height: 100%; scroll-behavior: smooth; background-color: var(--bg); }
body {
  min-height: 100%;
  font-family: var(--font-body);
  color: var(--on-surface);
  background: var(--bg-gradient);
  background-attachment: scroll;
  overscroll-behavior-y: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.container { width: min(100% - 32px, 1280px); margin: 0 auto; padding: 30px 0; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

**`components.css`** (bagian yang dipakai login — kartu, tombol, error, form):

```css
/* ── Buttons ── */
.btn, .submit-btn {
  display: inline-flex; min-height: 42px; align-items: center; justify-content: center;
  gap: 8px; border: 1px solid var(--glass-border); border-radius: var(--radius-md);
  padding: 10px 22px; color: var(--on-surface); background: var(--glass-bg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  font-family: var(--font-body); font-weight: 500; letter-spacing: 0.01em; line-height: 1.1;
  text-decoration: none; cursor: pointer;
  transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}
.btn:hover, .submit-btn:hover { transform: translateY(-1px); border-color: rgba(59,130,246,0.3); box-shadow: 0 0 20px rgba(59,130,246,0.12); }
.btn:active, .submit-btn:active { transform: translateY(0); }
.btn.primary, .submit-btn { color: #ffffff; background: var(--primary-strong, #2563eb); border-color: transparent; box-shadow: 0 0 20px rgba(59,130,246,0.2); }
.btn.primary:hover, .submit-btn:hover { background: var(--primary-strong-hover, #1d4ed8); box-shadow: 0 0 30px rgba(59,130,246,0.35); }

/* ── Auth card ── */
.hero-card, .auth-card { border: 1px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); }
.auth-card {
  width: min(100%, 440px); padding: clamp(24px, 5vw, 36px); border-radius: var(--radius-lg);
  position: relative; overflow: hidden;
}
.auth-card.hover-expand { transform: scale(1); transition: transform 320ms cubic-bezier(0.2,0.9,0.2,1), box-shadow 320ms ease; }
.auth-card.hover-expand:hover, .auth-card.hover-expand:focus-within { transform: translateY(-3px) scale(1.03); box-shadow: 0 0 40px rgba(59,130,246,0.12); }
.auth-card h1 { margin: 0 0 12px; font-family: var(--font-display); color: var(--on-surface); text-align: center; }

/* ── Error ── */
.error {
  border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-md); padding: 10px 12px;
  color: var(--error); background: rgba(239,68,68,0.1);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  font-family: var(--font-body); font-weight: 600;
}

/* ── Forms ── */
label { font-family: var(--font-label); font-size: 0.88rem; letter-spacing: 0; text-transform: none; color: var(--on-surface); font-weight: 600; display: block; }
input, select, textarea {
  width: 100%; min-height: 46px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm);
  padding: 11px 13px; font-family: var(--font-body); color: var(--on-surface);
  background: rgba(15, 23, 42, 0.4); outline: none;
  transition: border-color 200ms ease, box-shadow 200ms ease, background 200ms ease;
}
input::placeholder, textarea::placeholder { color: color-mix(in srgb, var(--on-surface-variant), transparent 18%); }
input:focus, select:focus, textarea:focus { border-color: var(--electric-blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.15), 0 0 20px rgba(59,130,246,0.08); background: rgba(15,23,42,0.6); }
.form-group { margin-bottom: 14px; }
.input-with-icon { position: relative; }
.input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; opacity: 0.9; pointer-events: none; }
.input-with-icon > input { padding-left: 42px; }
.submit-btn { width: 100%; border: 0; }
```

---

## 9. Spesifikasi Backend (kode referensi)

### 9.1 Setup Express & session (`backend/server.js`)

```js
const express = require("express");
const session = require("express-session");
const connectMongoModule = require("connect-mongo");
const MongoStore = connectMongoModule.default || connectMongoModule;
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { rateLimitLogin } = require("./rateLimit");

const app = express();
app.set("trust proxy", 1); // WAJIB: agar req.ip & req.secure benar di belakang proxy

// Helper async handler (Express 4 tidak menangkap rejection async otomatis)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Body parsers
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));

// ── Session config (cookie konsisten) ──
const SESSION_COOKIE_CONFIG = {
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari
  httpOnly: true,
  secure: "auto",
  sameSite: "lax",
};

function createSessionMiddleware(store) {
  const secret = process.env.SESSION_SECRET || (global._sessionSecret || (global._sessionSecret = crypto.randomUUID()));
  return session({ secret, resave: false, saveUninitialized: false, store, cookie: SESSION_COOKIE_CONFIG });
}
```

**Session store (MongoStore / MemoryStore fallback)** — pola yang dipakai di project asal:
inisialisasi store **sekali** di session wrapper middleware (bukan di initDb) agar
tidak terjadi switch store mid-flight yang membuat session orphan (user ke-logout).

```js
let _sessionMiddleware = null;
let _sessionInitPromise = null;

app.use((req, res, next) => {
  if (_sessionMiddleware) return _sessionMiddleware(req, res, next);
  if (!_sessionInitPromise) {
    _sessionInitPromise = (async () => {
      await db.connect();
      if (process.env.MONGO_URI) {
        const mongoStore = MongoStore.create({
          clientPromise: db.getClient(),
          dbName: process.env.MONGO_DB_NAME || "gereja",
          collectionName: "sessions",
          ttl: 14 * 24 * 60 * 60, // 14 hari (detik)
        });
        _sessionMiddleware = createSessionMiddleware(mongoStore);
      } else {
        _sessionMiddleware = createSessionMiddleware(new session.MemoryStore());
      }
    })().catch(() => {
      _sessionMiddleware = createSessionMiddleware(new session.MemoryStore());
    });
  }
  _sessionInitPromise.then(() => _sessionMiddleware(req, res, next));
});
```

### 9.2 Route login

```js
// ── Render form login ──
app.get("/admin/login", (req, res) => res.render("login/admin-login", { error: null }));

// ── Proses login ──
const handleAdminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const admins = await db.getAdmins();
  const admin = (admins || []).find((a) => a.username === username);
  if (!admin) {
    return res.render("login/admin-login", { error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.render("login/admin-login", { error: "Invalid credentials" });
  }
  req.session.user = { username };
  await db.setAdminOnline(username);

  // Redirect hanya ke path yang aman (bukan /dev, bukan dashboard)
  const savedRedirect = req.session.redirectTo || "";
  let redirectTo = "/admin/events";
  if (
    savedRedirect &&
    !savedRedirect.includes("/dashboard") &&
    !savedRedirect.includes("/dev/") &&
    (savedRedirect.startsWith("/admin/") ||
      savedRedirect.startsWith("/events") ||
      savedRedirect.startsWith("/documentation") ||
      savedRedirect === "/")
  ) {
    redirectTo = savedRedirect;
  }
  delete req.session.redirectTo;
  return res.redirect(redirectTo);
});

app.post(
  "/admin/login",
  rateLimitLogin({ windowMs: 15 * 60 * 1000, max: 5, blockMs: 10 * 60 * 1000 }),
  handleAdminLogin,
);

// ── Alias backward compat ──
app.get("/login", (req, res) => res.redirect("/admin/login"));
app.post(
  "/login",
  rateLimitLogin({ windowMs: 15 * 60 * 1000, max: 5, blockMs: 10 * 60 * 1000 }),
  handleAdminLogin,
);

// ── Logout ──
app.get("/admin/logout", (req, res) => {
  const username = req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy(() => {
    if (username) {
      db.setAdminOffline(username).catch((e) => console.error("[Logout]", e.message));
    }
    res.redirect("/admin/login");
  });
});
```

### 9.3 Middleware proteksi route admin

```js
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    // Heartbeat admin aktif (fire-and-forget)
    db.touchAdminActivity(req.session.user.username).catch((e) => {
      console.error("[AdminHeartbeat]", e.message);
    });
    return next();
  }
  if (req.session) {
    req.session.redirectTo = req.originalUrl;
  }
  return res.redirect("/admin/login");
}

// Pemakaian: app.get("/admin/events", ensureAuth, handler)
```

### 9.4 `backend/rateLimit.js` (lengkap)

```js
// Simple in-memory rate limiter for Express.
// Note: This resets when server restarts.

const DEFAULTS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // max attempts within window
  blockMs: 10 * 60 * 1000, // 10 minutes temporary ban
};

// Track separately:
// - per IP+device-ish (we approximate by IP)
// - per account username
// - per IP+username (to avoid edge cases)
const stateByIp = new Map();
const stateByAccount = new Map();
const stateByIpAccount = new Map();

// Cleanup entri basi tiap 30 menit (prevent memory leak).
// Entri yang tidak diblokir & tidak ada percobaan dalam 24 jam akan dihapus.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function sweepMap(map, now) {
  for (const [key, record] of map) {
    const stillBlocked = record.blockedUntil && now < record.blockedUntil;
    const lastAttempt = record.attempts.length
      ? record.attempts[record.attempts.length - 1]
      : 0;
    const isStale = !stillBlocked && now - lastAttempt > STALE_AFTER_MS;
    if (isStale) map.delete(key);
  }
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  sweepMap(stateByIp, now);
  sweepMap(stateByAccount, now);
  sweepMap(stateByIpAccount, now);
}, 30 * 60 * 1000);
// .unref() supaya timer tidak menahan proses Node tetap hidup
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function getIp(req) {
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function getUsername(req, usernameField = "username") {
  return ((req.body && req.body[usernameField]) || "").toString();
}

function makeState() {
  return { attempts: [], blockedUntil: 0 };
}

function getKeyIp(req) {
  return getIp(req);
}

function getKeyAccount(req, usernameField = "username") {
  return `acct::${getUsername(req, usernameField).toLowerCase()}`;
}

function getKeyIpAccount(req, usernameField = "username") {
  const ip = getIp(req);
  const u = getUsername(req, usernameField).toLowerCase();
  return `ipacct::${ip}::${u}`;
}

function getRecord(map, key) {
  const record = map.get(key);
  if (record) return record;
  const fresh = makeState();
  map.set(key, fresh);
  return fresh;
}

function rateLimitLogin(options = {}) {
  const { windowMs, max, blockMs } = { ...DEFAULTS, ...options };

  return (req, res, next) => {
    const now = Date.now();

    const ipKey = getKeyIp(req);
    const accountKey = getKeyAccount(req);
    const ipAccountKey = getKeyIpAccount(req);

    const ipRecord = getRecord(stateByIp, ipKey);
    const accountRecord = getRecord(stateByAccount, accountKey);
    const ipAccountRecord = getRecord(stateByIpAccount, ipAccountKey);

    // Block jika salah satu sudah diblokir
    const blockedUntil = Math.max(
      ipRecord.blockedUntil || 0,
      accountRecord.blockedUntil || 0,
      ipAccountRecord.blockedUntil || 0,
    );

    if (blockedUntil && now < blockedUntil) {
      return res.status(429).render("login", {
        error: `Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil(
          (blockedUntil - now) / 1000,
        )} detik.`,
      });
    }

    // Filter attempts dalam window
    ipRecord.attempts = ipRecord.attempts.filter((t) => now - t <= windowMs);
    accountRecord.attempts = accountRecord.attempts.filter((t) => now - t <= windowMs);
    ipAccountRecord.attempts = ipAccountRecord.attempts.filter((t) => now - t <= windowMs);

    // Kalau sudah menembus batas, block sementara untuk masing-masing dimensi
    if (ipRecord.attempts.length >= max) ipRecord.blockedUntil = now + blockMs;
    if (accountRecord.attempts.length >= max) accountRecord.blockedUntil = now + blockMs;
    if (ipAccountRecord.attempts.length >= max) ipAccountRecord.blockedUntil = now + blockMs;

    // Jika setelah evaluasi masih belum block, register attempt
    const isBlockedNow =
      (ipRecord.blockedUntil && now < ipRecord.blockedUntil) ||
      (accountRecord.blockedUntil && now < accountRecord.blockedUntil) ||
      (ipAccountRecord.blockedUntil && now < ipAccountRecord.blockedUntil);

    if (isBlockedNow) {
      const nextBlockedUntil = Math.max(
        ipRecord.blockedUntil || 0,
        accountRecord.blockedUntil || 0,
        ipAccountRecord.blockedUntil || 0,
      );
      return res.status(429).render("login", {
        error: `Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil(
          (nextBlockedUntil - now) / 1000,
        )} detik.`,
      });
    }

    // Register attempt di 3 dimensi
    ipRecord.attempts.push(now);
    accountRecord.attempts.push(now);
    ipAccountRecord.attempts.push(now);

    return next();
  };
}

module.exports = { rateLimitLogin };
```

> **Catatan penting (WAJIB diperbaiki saat replikasi):** middleware rate limit
> me-render view bernama `"login"` via `res.render("login", ...)`. Pada struktur
> views project asal — `app.set("views", [viewsDir, dashboardDir, adminViewsDir,
> dashboardSharedDir])` — template yang tersedia hanya `login/admin-login.ejs`
> (di folder `admin/login/`) dan `login/login.ejs` (di folder `dashboard/login/`).
> Express/EJS lookup untuk `render("login")` mencari `login.ejs` atau
> `login/index.ejs` di tiap views dir, sehingga **tidak menemukan template mana
> pun** → branch 429 akan gagal dengan error `Failed to lookup view "login"`
> (respons menjadi 500, bukan halaman hitung mundur).
>
> **Perbaikan wajib di project baru:** ganti `res.render("login", ...)` menjadi
> `res.render("login/admin-login", ...)` pada **kedua** cabang 429 di
> `rateLimit.js`. Dengan begitu pesan rate limit tampil pada template login
> admin yang sama persis.

### 9.5 Bootstrap admin awal (first-run)

```js
(async function initDb() {
  try {
    await db.connect();
    const admins = await db.getAdmins();
    if (!process.env.DISABLE_DEFAULT_ADMIN && (!admins || admins.length === 0)) {
      const passwordHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || "admin123", 10);
      await db.addAdmin({
        username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
        passwordHash,
      });
      console.log("Default admin created: " + (process.env.DEFAULT_ADMIN_USERNAME || "admin") + "/" + (process.env.DEFAULT_ADMIN_PASSWORD ? "<from env>" : "admin123"));
      console.log("⚠️  AMAN: Set DISABLE_DEFAULT_ADMIN=1 setelah deploy untuk menonaktifkan fitur ini.");
    }
  } catch (err) {
    console.error("[DB] Failed to connect to MongoDB:", err.message);
  }
})();
```

---

## 10. Skema Database (MongoDB)

**Collection `admins`** — satu dokumen per admin:

```js
{
  username: "admin",          // string, unique
  passwordHash: "$2b$10$...", // string, bcrypt hash (cost 10)
  // opsional (dipakai fitur lain): online, lastActiveAt, createdAt, updatedAt
}
```

**Collection `sessions`** — dikelola otomatis oleh connect-mongo (ttl 14 hari).

Metode DB yang wajib ada di project baru (sesuaikan dengan driver Mongo):
- `getAdmins()` → array dokumen admins
- `addAdmin({ username, passwordHash })`
- `setAdminOnline(username)` / `setAdminOffline(username)` (boleh no-op jika fitur
  status online tidak dipakai, tapi dipanggil oleh route login/logout)
- `touchAdminActivity(username)` (dipanggil ensureAuth; boleh no-op)

---

## 11. Environment Variables

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `MONGO_URI` | Ya (produksi) | — | Connection string MongoDB (untuk session + admins) |
| `MONGO_DB_NAME` | Tidak | `gereja` | Nama database |
| `SESSION_SECRET` | **Ya** (produksi) | random UUID | Secret session; tanpa ini session tidak persisten di serverless |
| `DEFAULT_ADMIN_USERNAME` | Tidak | `admin` | Username admin default (first-run) |
| `DEFAULT_ADMIN_PASSWORD` | Tidak | `admin123` | Password admin default (first-run) |
| `DISABLE_DEFAULT_ADMIN` | Disarankan di produksi | — | Set `1` untuk menonaktifkan bootstrap default admin |
| `NODE_ENV` | Ya (produksi) | — | `production` mengaktifkan HTTPS redirect |

---

## 12. Kriteria Penerimaan (Acceptance Criteria)

1. **AC-1** — `GET /admin/login` merender form dengan logo, judul "Admin Login",
   field username & password, dan tombol Login.
2. **AC-2** — Login dengan kredensial benar → redirect ke `/admin/events`
   (atau `redirectTo` yang valid) dan session `req.session.user` terisi.
3. **AC-3** — Login dengan username/password salah → halaman login dirender ulang
   dengan pesan `Invalid credentials`, tanpa mengecoh perbedaan username vs password.
4. **AC-4** — Middleware mencatat **setiap** request POST login yang lolos
   pengecekan (berhasil maupun gagal). Setelah 5 attempt dalam 15 menit (per
   IP/akun/IP+akun) → blokir 10 menit; request selama blokir ditolak dengan
   `HTTP 429` (di project baru: render ulang halaman login dengan pesan hitung
   mundur — setelah perbaikan view di bagian 9.4).
5. **AC-5** — Akses `/admin/events` tanpa login → redirect ke `/admin/login`,
   dan setelah login sukses kembali ke halaman yang diminta semula.
6. **AC-6** — `GET /admin/logout` menghancurkan session dan redirect ke `/admin/login`;
   akses `/admin/*` setelah logout → redirect ke login lagi.
7. **AC-7** — Session bertahan 14 hari (cookie `httpOnly`, `sameSite: lax`,
   `secure` mengikuti protokol), tersimpan di MongoDB (bukan hanya memory).
8. **AC-8** — Halaman responsif: kartu login ≤440px, rapi di mobile & desktop.
9. **AC-9** — `prefers-reduced-motion` mematikan animasi.
10. **AC-10** — Bootstrap first-run membuat admin default saat collection kosong;
    `DISABLE_DEFAULT_ADMIN=1` mencegahnya.
11. **AC-11** — Semua security headers (NFR-1) ada di response login.
12. **AC-12** — Rate limit tidak menghalangi login yang benar: admin yang mengetik
    benar sebelum melewati 5 percobaan tetap bisa masuk.

---

## 13. Checklist Implementasi di Project Baru

**Setup:**
- [ ] `npm init` + install dependensi (bagian 3)
- [ ] Buat struktur folder `backend/`, `admin/login/`, `frontend/public/css/` (bagian 4)
- [ ] Salin `variables.css`, `base.css`, `components.css` (atau hanya bagian yang
      dipakai login — lihat 8.3) ke `frontend/public/css/`
- [ ] Salin `admin/login/admin-login.ejs` & `admin/login/login.css` (8.1, 8.2)
- [ ] Siapkan logo di `frontend/public/images/logo-placeholder.png` (56×56)
- [ ] Siapkan Font Awesome (self-host atau CDN) & arahkan `/vendor/font-awesome/`
- [ ] Map static routes: `/css`, `/admin-assets`, `/images`, `/vendor`

**Backend:**
- [ ] Salin `rateLimit.js`; **ganti** `res.render("login", ...)` → `res.render("login/admin-login", ...)`
- [ ] Salin route login + `ensureAuth` + session setup (bagian 9)
- [ ] Implementasikan metode DB `getAdmins`, `addAdmin`, `setAdminOnline/Offline`, `touchAdminActivity`
- [ ] Atur `app.set("views", [..., adminDir])` agar `login/admin-login` ter-resolve
- [ ] Set env vars (bagian 11); set `SESSION_SECRET` di produksi

**Verifikasi:**
- [ ] Test AC-1 s.d. AC-12 (bagian 12)
- [ ] Cek response headers login (NFR-1)
- [ ] Test rate limit: 5x gagal → blokir 429
- [ ] Test `prefers-reduced-motion` & tampilan mobile
- [ ] Set `DISABLE_DEFAULT_ADMIN=1` & ganti password admin default di produksi

---

## 14. Catatan & Known Quirks (penting saat replikasi)

1. **`--accent-2` tidak terdefinisi** — inline style di `<p class="error">`
   (`color: var(--accent-2)`) mengacu token yang tidak ada; CSS yang berlaku adalah
   dari class `.error`. Untuk "sama persis", salin markup apa adanya — hasil akhir
   tetap benar karena `var(--accent-2)` jatuh ke warna inherit.
2. **Rate limiter render view `"login"`** — pastikan resolusi view benar (lihat catatan di 9.4).
3. **`secure: "auto"`** — cookie `secure` aktif otomatis saat HTTPS. Di development
   lokal (HTTP) session tetap jalan; di produksi (HTTPS) cookie terkirim aman.
4. **MemoryStore tidak persisten di serverless** — tanpa `MONGO_URI`/`SESSION_SECRET`,
   session bisa hilang antar-request di platform serverless (mis. Vercel). Gunakan
   MongoStore + `SESSION_SECRET` di produksi.
5. **Trust proxy wajib** — tanpa `app.set("trust proxy", 1)`, `req.ip` salah di
   belakang proxy → rate limiting per-IP tidak akurat dan bisa salah blokir banyak
   pengguna sekaligus.
6. **Cache admin CSS 1 hari** — jangan ubah jadi immutable, agar update CSS admin
   tidak basi lama di browser.
7. **Pageview metric** — di project asal, route `/admin/*` tidak dihitung sebagai
   pageview publik (dikecualikan via `isApi`), jadi login admin tidak mengotori
   analytics publik.

---

*PRD ini disusun berdasarkan implementasi produksi yang berjalan. Semua kode di
bagian 8–9 dapat disalin langsung; penyesuaian hanya diperlukan untuk nama view
yang di-render rate limiter (lihat catatan 2) dan metode DB sesuai driver project baru.*
