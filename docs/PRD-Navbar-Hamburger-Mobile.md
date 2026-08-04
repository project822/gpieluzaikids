# PRD — Navbar + Hamburger Menu Mobile (Copy-Paste Ready)

| | |
|---|---|
| **Nama Fitur** | Navbar (Navigation Bar) + Hamburger Menu Mobile |
| **Versi** | 1.0 |
| **Tanggal** | 2026-08-02 |
| **Status** | Draft / Siap Implementasi |
| **Stack** | HTML + CSS (native) + Vanilla JS — tanpa library/framework |
| **Sumber Implementasi** | GPI Eluzai Kids (frontend) — di-generalisasi agar bebas dependency |

---

## 1. Ringkasan Eksekutif

PRD ini menspesifikasikan **navigation bar sticky bergaya glassmorphism** lengkap dengan
**hamburger menu mobile** yang bisa langsung di-copy-paste ke project lain.

Komponen ini mencakup:

- Navbar sticky di atas halaman dengan efek **shrink on scroll**.
- **Desktop (> 900px):** logo + link navigasi horizontal, rata kanan.
- **Mobile (≤ 900px):** logo + tombol hamburger; link muncul sebagai **panel dropdown
  glass** tepat di bawah navbar saat hamburger diklik.
- Interaksi lengkap: tutup saat klik link, klik di luar area, atau tekan `Escape`.
- Aksesibilitas: `aria-expanded`, `aria-label`, keyboard-friendly.
- **Tanpa dependency**: vanilla HTML/CSS/JS, cukup salin 3 blok kode di Lampiran.

---

## 2. Tujuan & Sasaran

### 2.1 Tujuan
1. Menyediakan navigasi yang **konsisten** di semua ukuran layar (desktop & mobile).
2. Memberi pengalaman mobile yang **intuitif** dengan hamburger menu yang mudah diakses.
3. Menjaga **performance**: tanpa library, animasi berbasis CSS transition, JS minimal (< 1 KB).
4. Memenuhi **aksesibilitas** (WCAG 2.1 AA) untuk navigasi keyboard & screen reader.

### 2.2 Non-Tujuan (Out of Scope)
- Dropdown multi-level / mega menu.
- Search bar di dalam navbar.
- Autentikasi / user menu (avatar, logout).
- Sidebar/drawer full-screen dengan overlay.
- Framework-specific wrapper (React/Vue) — PRD ini menyediakan vanilla sebagai dasar.

---

## 3. User Stories

| ID | Sebagai… | Saya ingin… | Agar… |
|----|----------|-------------|-------|
| US-1 | Pengunjung desktop | melihat semua link navigasi langsung di navbar | bisa berpindah halaman tanpa klik ekstra |
| US-2 | Pengunjung mobile | membuka menu lewat tombol hamburger | akses link navigasi di layar kecil |
| US-3 | Pengunjung mobile | menu tertutup otomatis setelah memilih link | tidak perlu menutup manual |
| US-4 | Pengguna keyboard | menutup menu dengan `Escape` dan tahu state menu dari `aria-expanded` | bisa bernavigasi tanpa mouse |
| US-5 | Pengguna screen reader | mendengar label tombol yang jelas ("Buka navigasi" / "Tutup navigasi") | memahami fungsi tombol hamburger |
| US-6 | Pengunjung mana pun | navbar tetap terlihat saat scroll (sticky) dan mengecil saat scroll jauh | konteks navigasi selalu tersedia |

---

## 4. Functional Requirements

### FR-01 — Navbar Sticky
- Navbar `position: sticky; top: 0;` dengan `z-index` di atas konten halaman (≥ 20).
- Navbar tetap terlihat saat halaman di-scroll.

**Acceptance Criteria**
- [ ] Navbar menempel di atas saat scroll ke bawah.
- [ ] Konten tidak menutupi navbar (z-index cukup tinggi).

### FR-02 — Glassmorphism
- Latar belakang navbar semi-transparan + `backdrop-filter: blur(16px)`.
- Border bawah tipis semi-transparan.

**Acceptance Criteria**
- [ ] Konten yang lewat di bawah navbar terlihat samar (blur).
- [ ] Ada fallback warna solid bila browser tidak mendukung `backdrop-filter` (gunakan `background` dengan alpha tinggi).

### FR-03 — Shrink on Scroll
- Saat scroll > 60px: border bawah muncul + latar belakang lebih pekat (mis. alpha 0.85).
- Saat kembali ke atas (< 60px): kembali ke kondisi awal.
- Throttle dengan `requestAnimationFrame` agar tidak boros CPU.

**Acceptance Criteria**
- [ ] Perubahan hanya terjadi satu kali per frame scroll (tidak ada lag).
- [ ] Transisi halus (`transition` ~260ms).

### FR-04 — Brand/Logo
- Logo berada paling kiri di desktop dan mobile.
- Logo adalah link ke halaman utama (`/` atau `#home`).

**Acceptance Criteria**
- [ ] Klik logo mengarah ke beranda.
- [ ] Logo tidak terpotong di layar kecil (ukuran ≤ 46px).

### FR-05 — Nav Links Desktop (Horizontal)
- Link desktop: `display: flex`, rata kanan (`margin-left: auto`), gap kecil antar link.
- State: **idle** (warna muted), **hover** (warna terang + bg lembut), **active** (warna terang + indikator garis bawah biru).

**Acceptance Criteria**
- [ ] Hover & focus terlihat jelas (focus-visible).
- [ ] Link active ditandai indikator (underline / pill).

### FR-06 — Breakpoint Mobile (≤ 900px)
- Link horizontal disembunyikan.
- Tombol hamburger (`display: none` di desktop → `display: inline-flex` di mobile).
- Menu mobile berupa **panel dropdown fixed** tepat di bawah navbar (bukan drawer full-screen).

**Acceptance Criteria**
- [ ] Pada ≤ 900px hanya hamburger yang terlihat (logo + hamburger + aksi lain).
- [ ] Pada > 900px hamburger tidak tampil.

### FR-07 — Hamburger Toggle & Dropdown Panel
- Klik hamburger → `documentElement` mendapat class `.nav-open`.
- Panel menu tampil (`.nav-links` berubah dari `display: none` → `flex`, `flex-direction: column`).
- Panel bergaya glass (blur 24px, border, shadow) dengan radius besar.
- Panel berisi: **logo + nama brand** (opsional, bagian atas) lalu **daftar link vertikal**.

**Acceptance Criteria**
- [ ] Klik hamburger membuka & menutup menu (toggle).
- [ ] Panel tampil di bawah navbar, tidak menutup seluruh layar.
- [ ] Tidak ada layout jump saat menu terbuka.

### FR-08 — Penutupan Menu
Menu tertutup oleh 4 kondisi:
1. Klik tombol hamburger lagi (toggle).
2. Klik salah satu link navigasi.
3. Klik di luar area navbar (`document` click listener + `e.target` check).
4. Tekan tombol `Escape`.

**Acceptance Criteria**
- [ ] Keempat kondisi berfungsi.
- [ ] Setelah tutup, `aria-expanded` kembali ke `false`.

### FR-09 — Aksesibilitas (ARIA)
- Tombol hamburger:
  - `aria-expanded="false"` saat tertutup, `"true"` saat terbuka.
  - `aria-label` dinamis: "Buka navigasi" ↔ "Tutup navigasi".
- Navbar punya `aria-label` deskriptif (mis. "Navigasi utama").
- Saat menu dibuka via keyboard, fokus pindah ke link pertama (rekomendasi).

**Acceptance Criteria**
- [ ] `aria-expanded` selalu sinkron dengan state visual.
- [ ] Screen reader mengumumkan state menu.
- [ ] `Escape` mengembalikan fokus ke tombol hamburger.

### FR-10 — Body Scroll Lock (Opsional)
- Saat menu terbuka, `body { overflow: hidden }` untuk mencegah scroll halaman di belakang panel.

**Acceptance Criteria**
- [ ] Halaman tidak scroll saat menu terbuka.
- [ ] Scroll kembali normal saat menu tertutup.

### FR-11 — Smooth Scroll ke Anchor (Opsional)
- Link `href="#..."` scroll halus ke target dengan offset tinggi navbar.

**Acceptance Criteria**
- [ ] Scroll berhenti tepat di atas section (tidak tertutup navbar).
- [ ] Offset membaca `--nav-height` agar konsisten dengan theme.

### FR-12 — Reduced Motion
- `@media (prefers-reduced-motion: reduce)` mematikan/ mempersingkat animasi hamburger & transisi panel.

**Acceptance Criteria**
- [ ] Tidak ada animasi berlebih untuk pengguna yang memilih reduced motion.

---

## 5. Non-Functional Requirements

| Kategori | Requirement |
|----------|-------------|
| **Performance** | Vanilla JS < 1 KB (gzip); tidak ada library eksternal; animasi hanya `transform`/`opacity` bila memungkinkan (compositor-friendly). |
| **Compatibility** | Browser modern: Chrome, Edge, Firefox, Safari (2 versi terakhir). Fallback solid bg bila `backdrop-filter` tidak didukung. |
| **Responsive** | Breakpoint utama: 900px. Tidak ada horizontal scroll di ≤ 360px. |
| **Accessibility** | WCAG 2.1 AA: kontras teks ≥ 4.5:1, target sentuh ≥ 44×44px (tombol hamburger 42–48px). |
| **SEO/UX** | Navbar tidak menghalangi konten (sticky + offset scroll). |
| **Theming** | Semua warna via CSS custom properties (`--nav-*`) agar mudah di-theme. |

---

## 6. UI / UX Specification

### 6.1 Layout Desktop (> 900px)

```
┌──────────────────────────────────────────────────────────┐
│ [Logo]   [Link1] [Link2] [Link3] [Link4]  (rata kanan)   │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Layout Mobile (≤ 900px) — Menu Tertutup

```
┌─────────────────────────────────────────────┐
│ [Logo]                    [☰ hamburger]     │
└─────────────────────────────────────────────┘
```

### 6.3 Layout Mobile — Menu Terbuka

```
┌─────────────────────────────────────────────┐
│ [Logo]                    [✕ hamburger]     │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ (logo + nama brand)                     │ │
│ │ [Link1]                                │ │
│ │ [Link2]                                │ │
│ │ [Link3]                                │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 6.4 Design Tokens (ganti sesuai brand)

```css
:root {
  --nav-height: 68px;                 /* 64px saat ≤ 620px (opsional) */
  --nav-bg: rgba(15, 23, 42, 0.75);        /* latar navbar (translucent) */
  --nav-bg-scrolled: rgba(15, 23, 42, 0.85);/* latar saat scroll */
  --nav-bg-solid: rgba(15, 23, 42, 0.95);  /* latar panel menu mobile */
  --nav-border: rgba(51, 65, 85, 0.5);     /* border glass */
  --nav-text: #FFFFFF;
  --nav-text-muted: #94A3B8;
  --nav-accent: #3B82F6;
  --nav-hover-bg: rgba(59, 130, 246, 0.08);
  --nav-radius: 10px;
  --nav-radius-lg: 18px;
  --nav-blur: 16px;
  --nav-blur-lg: 24px;
  --nav-shadow: 0 0 30px rgba(59, 130, 246, 0.08),
                0 0 0 1px rgba(51, 65, 85, 0.5);
}
```

### 6.5 Hamburger Icon (3 garis → X)

- 3 garis: `.hamburger` + `::before` (atas) + `::after` (bawah), ukuran ±20×2px, `border-radius: full`.
- Saat `.nav-open`: garis tengah memudar, garis atas & bawah berputar membentuk **X** (kiri-kanan -45°/+45°).
- Gunakan transform CSS, bukan animasi `top`, agar smooth & performant.

---

## 7. Behaviour Specification

| Event | Aksi |
|-------|------|
| Klik hamburger (tertutup) | Tambah `.nav-open` pada `<html>`, `aria-expanded="true"`, label → "Tutup navigasi". Ikon berubah jadi X. |
| Klik hamburger (terbuka) | Hapus `.nav-open`, `aria-expanded="false"`, label → "Buka navigasi". Ikon kembali 3 garis. |
| Klik link menu | Tutup menu (sama seperti toggle tutup), lalu lakukan navigasi/scroll. |
| Klik di luar navbar | Tutup menu. |
| Tekan `Escape` | Tutup menu + fokus kembali ke tombol hamburger. |
| Scroll > 60px (ke bawah) | Tambah class `.shrink` → bg pekat + border bawah. |
| Scroll < 60px (kembali atas) | Hapus class `.shrink`. |
| Resize: ≤ 900px ↔ > 900px | Menu otomatis tertutup bila lebar layar melewati breakpoint. |

---

## 8. Accessibility Requirements

1. **Tombol**: elemen `<button>` asli (bukan `<div>`) → gratis keyboard & screen reader.
2. **`aria-expanded`**: wajib, sinkron dengan state.
3. **`aria-label`**: dinamis, berubah sesuai state ("Buka/Tutup navigasi").
4. **`aria-label` pada `<nav>`**: "Navigasi utama".
5. **Focus trap** (rekomendasi): saat menu terbuka, `Tab` berputar di dalam menu; `Escape` menutup & mengembalikan fokus.
6. **Kontras**: teks idle ≥ 4.5:1 terhadap latar navbar; teks active lebih terang.
7. **Target sentuh**: tombol hamburger minimal 44×44px.
8. **`prefers-reduced-motion`**: matikan animasi hamburger & panel.
9. **`focus-visible`**: outline/indikator fokus keyboard jelas.

---

## 9. Acceptance Criteria (Ringkasan UAT)

| # | Kriteria | Status |
|---|----------|--------|
| AC-1 | Desktop > 900px menampilkan link horizontal, hamburger tersembunyi. | ☐ |
| AC-2 | Mobile ≤ 900px menampilkan hamburger, link horizontal tersembunyi. | ☐ |
| AC-3 | Klik hamburger membuka panel menu di bawah navbar dengan animasi halus. | ☐ |
| AC-4 | Menu tertutup via: toggle, klik link, klik luar, `Escape`. | ☐ |
| AC-5 | `aria-expanded` & `aria-label` sinkron di semua kondisi. | ☐ |
| AC-6 | Navbar sticky + shrink saat scroll. | ☐ |
| AC-7 | Link active punya indikator visual. | ☐ |
| AC-8 | Tanpa JS, menu mobile tampil sebagai list statis di bawah navbar (hamburger disembunyikan); navigasi tetap bisa dipakai. | ☐ |
| AC-9 | Tidak ada horizontal scroll di ≤ 360px. | ☐ |
| AC-10 | Reduced motion mematikan animasi. | ☐ |
| AC-11 | Semua warna via CSS variable (mudah di-theme). | ☐ |

> **Catatan AC-8**: kode di Lampiran sudah menyediakan fallback — `<html class="no-js">` + blok `html.no-js .nav-links` di CSS (12.2) menampilkan menu mobile sebagai list statis saat JS nonaktif. JS menghapus class `no-js` saat halaman dimuat sehingga fallback otomatis nonaktif. Ganti `no-js` dengan `js` + inline script pemindah class bila project sudah memakai pola tersebut.

---

## 10. Edge Cases

| Kasus | Perilaku yang diharapkan |
|-------|--------------------------|
| Buka menu lalu rotate ke desktop | Menu tertutup otomatis; hamburger hilang. |
| Scroll saat menu terbuka | Panel tetap di posisinya (fixed di bawah navbar). |
| Banyak link (≥ 8) | Panel bisa scroll internal (`max-height` + `overflow-y: auto`) agar tidak keluar layar. |
| Layar sangat sempit (≤ 360px) | Link membungkus rapi, padding tetap nyaman. |
| `backdrop-filter` tidak didukung | Latar fallback solid (alpha tinggi) — teks tetap terbaca. |
| Link aktif dihalaman lain | Indikator active mengikuti halaman/URL aktif. |
| Navbar `hideNavbar` (mis. halaman khusus) | Navbar tidak dirender sama sekali (flag di server/renderer). |

---

## 11. Implementation Notes

- **Class vs JS**: state menu disimpan sebagai class `nav-open` pada `<html>` (bukan inline style) agar mudah di-override via CSS dan di-debug.
- **Throttle scroll** dengan `requestAnimationFrame` — hindari listener scroll langsung yang mahal.
- **Pasif listener**: `window.addEventListener("scroll", fn, { passive: true })`.
- **CSS custom properties** untuk seluruh token — mengganti tema cukup di satu tempat.
- **Progressive enhancement**: struktur HTML & CSS desktop bekerja tanpa JS; JS hanya menambah interaksi mobile.

---

## 12. Lampiran — Kode Copy-Paste

> **Cara pakai**: salin **HTML** ke tempat render navbar (halaman server-side / komponen), **CSS** ke stylesheet (pastikan token `--nav-*` didefinisikan), dan **JS** di akhir body atau file script. Tidak ada dependency lain.
>
> **Penting**: tambahkan class `no-js` ke tag `<html>` yang *sudah ada* di project kamu (bukan membuat tag `<html>` baru) supaya fallback noscript di 12.2 berfungsi. Jika project sudah memakai pola `<html class="js">` + script pemindah class, gunakan itu dan hapus baris `<html>` dari blok di bawah.

### 12.1 HTML

```html
<!-- ================= NAVBAR + HAMBURGER MOBILE ================= -->
<!-- TERAPKAN class `no-js` ke tag <html> yang SUDAH ADA di project kamu:
     <html lang="id" class="no-js">  → memberi fallback CSS saat JS nonaktif
     (lihat 12.2 & AC-8). JS akan menghapus class no-js saat halaman dimuat.
     JANGAN buat tag <html> baru — gunakan tag <html> yang sudah ada. -->

<nav class="nav" aria-label="Navigasi utama">
  <div class="nav-inner">

    <!-- Brand / Logo -->
    <a class="brand" href="#home" aria-label="Halaman utama">
      <img src="logo.png" alt="Logo" class="logo-img" width="46" height="46">
    </a>

    <!-- Hamburger Toggle -->
    <button
      class="nav-toggle"
      type="button"
      aria-label="Buka navigasi"
      aria-expanded="false"
      aria-controls="nav-links"
      data-nav-toggle
    >
      <span class="hamburger" aria-hidden="true"></span>
    </button>

    <!-- Nav Links -->
    <ul class="nav-links" id="nav-links" data-nav-menu>
      <!-- Logo + nama brand (hanya tampil di mobile) -->
      <li class="nav-links-logo">
        <a href="#home">
          <img src="logo.png" alt="" class="logo-img" width="40" height="40">
          <span>Nama Brand</span>
        </a>
      </li>

      <li><a href="#home" class="active">Home</a></li>
      <li><a href="#about">Tentang</a></li>
      <li><a href="#services">Layanan</a></li>
      <li><a href="#contact">Kontak</a></li>
    </ul>

  </div>
</nav>
```

### 12.2 CSS

```css
/* ============ NAVBAR + HAMBURGER MOBILE (copy-paste ready) ============ */

/* ── Design Tokens ── */
:root {
  --nav-height: 68px;
  --nav-bg: rgba(15, 23, 42, 0.75);
  --nav-bg-scrolled: rgba(15, 23, 42, 0.85);
  --nav-bg-solid: rgba(15, 23, 42, 0.95);
  --nav-border: rgba(51, 65, 85, 0.5);
  --nav-text: #ffffff;
  --nav-text-muted: #94a3b8;
  --nav-accent: #3b82f6;
  --nav-hover-bg: rgba(59, 130, 246, 0.08);
  --nav-radius: 10px;
  --nav-radius-lg: 18px;
  --nav-blur: 16px;
  --nav-blur-lg: 24px;
  --nav-shadow: 0 0 30px rgba(59, 130, 246, 0.08),
                0 0 0 1px rgba(51, 65, 85, 0.5);
}

/* ── Navbar ── */
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid transparent;
  background: var(--nav-bg);
  -webkit-backdrop-filter: blur(var(--nav-blur));
  backdrop-filter: blur(var(--nav-blur));
  transform: translateZ(0);          /* compositing layer */
  transition: background 260ms ease, border-color 260ms ease;
}

.nav.shrink {
  border-bottom-color: var(--nav-border);
  background: var(--nav-bg-scrolled);
}

.nav-inner {
  width: min(100% - 28px, 1280px);
  min-height: var(--nav-height);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

/* ── Brand ── */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--nav-text);
  text-decoration: none;
  flex-shrink: 0;
}

.logo-img {
  width: 46px;
  height: 46px;
  display: block;
  object-fit: contain;
  border-radius: 50%;
}

/* ── Nav Links (Desktop) ── */
.nav-links {
  margin: 0 0 0 auto;               /* rata kanan */
  padding: 0;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: var(--nav-radius);
  color: var(--nav-text-muted);
  font-weight: 500;
  font-size: 0.92rem;
  white-space: nowrap;
  text-decoration: none;
  position: relative;
  transition: background 200ms ease, color 200ms ease;
}

.nav-links a:hover,
.nav-links a:focus-visible {
  color: var(--nav-text);
  background: var(--nav-hover-bg);
}

/* Active indicator (garis bawah) */
.nav-links a.active {
  color: var(--nav-text);
  background: var(--nav-hover-bg);
}

.nav-links a.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 12px;
  right: 12px;
  height: 2px;
  border-radius: 9999px;
  background: var(--nav-accent);
  box-shadow: 0 0 10px var(--nav-accent);
}

/* Logo di dalam menu (mobile only) */
.nav-links-logo { display: none; }

/* ── Hamburger Toggle (hidden di desktop) ── */
.nav-toggle {
  display: none;
  width: 44px;                      /* target sentuh >= 44px */
  height: 44px;
  align-items: center;
  justify-content: center;
  margin-left: auto;                /* dorong ke kanan */
  border: 1px solid var(--nav-border);
  border-radius: var(--nav-radius);
  color: var(--nav-text);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 200ms ease, border-color 200ms ease;
}

.nav-toggle:hover,
.nav-toggle:focus-visible {
  background: var(--nav-hover-bg);
  border-color: var(--nav-accent);
}

/* Ikon 3 garis */
.hamburger,
.hamburger::before,
.hamburger::after {
  width: 20px;
  height: 2px;
  display: block;
  border-radius: 9999px;
  background: currentColor;
  /* background ikut di-transition supaya garis tengah ikut memudar
     halus saat berubah jadi X (bukan hilang mendadak). */
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
              opacity 200ms ease,
              background 200ms ease;
}

.hamburger { position: relative; }
.hamburger::before,
.hamburger::after {
  content: "";
  position: absolute;
  left: 0;
}
.hamburger::before { top: -7px; }
.hamburger::after  { top: 7px; }

/* Ikon berubah jadi X saat menu terbuka */
html.nav-open .hamburger::before {
  transform: translateY(7px) rotate(45deg);
}
html.nav-open .hamburger {
  background: transparent;          /* garis tengah menghilang */
}
html.nav-open .hamburger::after {
  transform: translateY(-7px) rotate(-45deg);
}

/* ── Mobile Responsive ──
   Catatan: breakpoint CSS `max-width: 900px` HARUS sinkron dengan
   `min-width: 901px` di JS (matchMedia). Jangan ubah salah satunya saja. */
@media (max-width: 900px) {
  .nav-toggle {
    display: inline-flex;
  }

  /* Panel menu: dropdown glass di bawah navbar */
  /* Panel `position: fixed` ini adalah anak dari `.nav` yang punya
     `transform: translateZ(0)` — jadi containing block-nya adalah `.nav`,
     bukan viewport. Ini sengaja: panel selalu menempel tepat di bawah
     navbar (sticky). Jika navbar direstrukturisasi (mis. kontennya lebih
     tinggi dari --nav-height), posisi panel ikut bergeser — sesuaikan
     `top` atau pindahkan panel keluar dari `.nav`. */
  .nav-links {
    position: fixed;
    top: calc(var(--nav-height) + 8px);
    left: 12px;
    right: 12px;
    display: none;                  /* hidden sampai .nav-open */
    margin: 0;
    padding: 12px;
    flex-direction: column;
    align-items: stretch;
    border: 1px solid var(--nav-border);
    border-radius: var(--nav-radius-lg);
    background: var(--nav-bg-solid);
    -webkit-backdrop-filter: blur(var(--nav-blur-lg));
    backdrop-filter: blur(var(--nav-blur-lg));
    box-shadow: var(--nav-shadow);
    z-index: 30;
    max-height: calc(100vh - var(--nav-height) - 32px); /* aman di layar kecil */
    overflow-y: auto;
  }

  html.nav-open .nav-links {
    display: flex;
  }

  /* Fallback tanpa JS: tampilkan menu sebagai list statis di bawah
     navbar supaya navigasi mobile tetap bisa dipakai (lihat AC-8),
     dan sembunyikan hamburger yang tidak berfungsi. */
  html.no-js .nav-links {
    display: flex;
    position: static;
    margin-top: 10px;
    max-height: none;
    overflow: visible;
  }

  html.no-js .nav-toggle {
    display: none;
  }

  .nav-links a {
    justify-content: center;
    padding: 12px;
  }

  .nav-links-logo {
    display: block;
    border-bottom: 1px solid var(--nav-border);
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  .nav-links-logo a {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
    font-weight: 800;
    color: var(--nav-text);
    pointer-events: none;           /* hanya dekorasi */
  }

  .nav-links-logo .logo-img {
    width: 40px;
    height: 40px;
  }
}

@media (max-width: 620px) {
  :root { --nav-height: 64px; }
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .nav,
  .nav-toggle,
  .hamburger,
  .hamburger::before,
  .hamburger::after {
    transition: none !important;
  }
}

/* ── Light theme override (opsional) ── */
html.theme-light {
  --nav-bg: rgba(255, 255, 255, 0.8);
  --nav-bg-scrolled: rgba(255, 255, 255, 0.9);
  --nav-bg-solid: rgba(255, 255, 255, 0.97);
  --nav-border: rgba(15, 23, 42, 0.12);
  --nav-text: #0f172a;
  --nav-text-muted: #475569;
  --nav-hover-bg: rgba(59, 130, 246, 0.08);
}
```

### 12.3 JavaScript

```js
/* ============ NAVBAR + HAMBURGER MOBILE (vanilla JS) ============ */
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var html = document.documentElement;
    var nav = document.querySelector(".nav");
    var menu = document.querySelector("[data-nav-menu]");
    var toggle = document.querySelector("[data-nav-toggle]");

    // JS aktif → hapus class no-js (fallback CSS noscript tidak lagi dipakai)
    html.classList.remove("no-js");

    function isOpen() {
      return html.classList.contains("nav-open");
    }

    function setMenu(open) {
      html.classList.toggle("nav-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
      }
    }

    /* 1) Toggle saat hamburger diklik */
    if (toggle) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        setMenu(!isOpen());
      });
    }

    /* 2) Tutup saat link menu diklik */
    var links = (menu ? menu : document).querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    /* 3) Tutup saat klik di luar navbar */
    document.addEventListener("click", function (e) {
      if (isOpen() && nav && !nav.contains(e.target)) setMenu(false);
    });

    /* 4) Tutup saat Escape (+ kembalikan fokus ke tombol) */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        setMenu(false);
        if (toggle) toggle.focus();
      }
    });

    /* 5) Tutup otomatis saat resize melewati breakpoint desktop.
       Harus sinkron dengan `max-width: 900px` di CSS — jangan ubah
       salah satunya saja. */
    var mq = window.matchMedia("(min-width: 901px)");
    var onDesktopChange = function (e) {
      if (e.matches) setMenu(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onDesktopChange);
    else if (mq.addListener) mq.addListener(onDesktopChange); // Safari < 14

    /* 6) Shrink on scroll (throttled dengan rAF) */
    var lastScroll = 0;
    var raf = null;

    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var sc = window.scrollY || 0;
        if (nav) {
          if (sc > 60 && sc > lastScroll) nav.classList.add("shrink");
          else if (sc < 60) nav.classList.remove("shrink");
        }
        lastScroll = sc;
      });
    }, { passive: true });

    /* 7) (Opsional) Body scroll lock saat menu terbuka */
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        document.body.style.overflow = isOpen() ? "hidden" : "";
      });
      observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    }

    /* 8) (Opsional) Smooth scroll ke anchor dengan offset navbar.
       Hormati prefers-reduced-motion: scroll instan bila pengguna
       memilih reduce motion (FR-12). */    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        var navH = parseFloat(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--nav-height")
        );
        if (!isFinite(navH)) navH = 68;
        var top = target.getBoundingClientRect().top + window.scrollY - navH - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  });
})();
```

### 12.4 Checklist Integrasi

- [ ] Token `--nav-*` sudah disesuaikan dengan brand project.
- [ ] Path logo (`src`) diganti.
- [ ] Daftar link & href disesuaikan.
- [ ] Link yang sedang aktif diberi class `active` (atau di-set via JS sesuai URL).
- [ ] Jika ada theme light/dark, pastikan override `--nav-*` disediakan.
- [ ] Test di breakpoint 900px & 620px (Chrome DevTools).
- [ ] Test keyboard: `Tab`, `Enter`, `Escape`.
- [ ] Test screen reader (VoiceOver / NVDA) untuk `aria-expanded`.

---

## 13. Metric Keberhasilan (Opsional)

- **CLS ≤ 0.1** — panel menu tidak menyebabkan layout shift (menggunakan `position: fixed`).
- **JS bundle navbar ≤ 1 KB (gzip)**.
- **Waktu buka menu ≤ 100ms** (CSS transition, tanpa JS blocking).
- **0 error console** saat interaksi menu.

---

*Dokumen ini siap di-copy-paste. Semua kode di Lampiran bersifat self-contained dan tidak bergantung pada framework atau design system lain.*
