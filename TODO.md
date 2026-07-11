# TODO - Optimasi Performa & Smooth UI

## Step 1 — Analisis + target perubahan

- [x] Pahami smooth scroll, carousel, modal event landing.
- [x] Identifikasi duplikasi potensi: Swiper loader vs carousel native.
- [x] Identifikasi kebutuhan offset menu agar tidak terpotong.

## Step 2 — Refactor CSS

- [x] Tambahkan `scroll-margin-top` untuk section: #home, #events, #documentation, #address, #footer.
- [ ] (Opsional) Rapikan legacy CSS carousel/section agar tidak konflik.

## Step 3 — Refactor JS landing (main.js)

- [ ] Samakan smooth scrolling dengan offset navbar (hapus/ubah handler scrollIntoView).
- [ ] Pastikan carousel native perpindahan smooth dan tidak dobel handler.
- [ ] Pastikan event reminder dan anchor navigation konsisten.

## Step 4 — Hapus duplikasi Swiper init

- [ ] Edit load-swiper.js / swiper-init-window.js agar hanya inisialisasi jika elemen Swiper ada.

## Step 5 — Admin

- [ ] Samakan modal create-admin dengan behavior yang sama seperti landing (smooth/consistent).

## Step 6 — Testing manual

- [ ] Klik menu semua anchor (desktop & mobile) tanpa terpotong.
- [ ] Carousel prev/next halus.
- [ ] Modal (landing + admin) open/close smooth.
