// ============================================================
// Data contoh (demo) untuk GPI Eluzai.
// Data ini dipakai saat MONGODB_URI belum diisi, dan juga
// menjadi data awal yang di-seed ke MongoDB saat koneksi aktif.
// ============================================================

// ---------- Identitas gereja ----------
export const CHURCH = {
  name: 'GPI Eluzai Kids',
  shortName: 'Eluzai Kids',
  fullName: 'Gereja Pantekosta di Indonesia — Pelayanan Anak Eluzai',
  tagline: 'Tempat Anak Bertumbuh dalam Iman & Sukacita',
  description: 'Rumah ibadah yang hangat untuk bertumbuh bersama dalam kasih Kristus.',
  address: 'Jl. Kebangkitan Raya No. 21, Sukamaju, Tapos, Kota Depok, Jawa Barat 16455',
  whatsapp: '6281234567890',
  instagram: 'https://www.instagram.com/elusaikids',
  youtube: 'https://www.youtube.com/@elusaikids',
  mapsEmbed: 'https://www.google.com/maps?q=Tapos%2C%20Depok%2C%20Jawa%20Barat&output=embed',
  mapsLink: 'https://www.google.com/maps/search/?api=1&query=Tapos+Depok+Jawa+Barat',
  established: 2015,
};

// ---------- Utilitas gambar demo (SVG data URI, tanpa file eksternal) ----------
function svgCover({ w, h, from, to, emoji, label = '' }) {
  const circles = [
    `<circle cx="${Math.round(w * 0.82)}" cy="${Math.round(h * 0.18)}" r="${Math.round(w * 0.14)}" fill="#ffffff" opacity="0.12"/>`,
    `<circle cx="${Math.round(w * 0.12)}" cy="${Math.round(h * 0.85)}" r="${Math.round(w * 0.18)}" fill="#ffffff" opacity="0.10"/>`,
    `<circle cx="${Math.round(w * 0.55)}" cy="${Math.round(h * 0.08)}" r="${Math.round(w * 0.07)}" fill="#ffffff" opacity="0.14"/>`,
  ].join('');
  const text = label
    ? `<text x="50%" y="${Math.round(h * 0.86)}" font-family="'Hanken Grotesk', Inter, Arial, sans-serif" font-size="${Math.round(h * 0.07)}" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.95">${label}</text>`
    : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>${circles}` +
    `<text x="50%" y="${Math.round(h * 0.48)}" font-size="${Math.round(h * 0.3)}" text-anchor="middle" dominant-baseline="central">${emoji}</text>${text}` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------- Slider beranda (adegan digambar sebagai SVG ringan) ----------
// Untuk memakai foto asli, ganti properti `scene` dengan `src`:
//   { id, src: '/gereja-1.jpg', title, caption }
export const HOME_SLIDES = [
  {
    id: 'slide-gereja',
    scene: 'church',
    title: 'Rumah Ibadah Kami',
    caption: 'Tempat jemaat beribadah & bersekutu.',
  },
  {
    id: 'slide-ibadah',
    scene: 'worship',
    title: 'Suasana Ibadah',
    caption: 'Pujian yang membawa hadirat Tuhan.',
  },
  {
    id: 'slide-persekutuan',
    scene: 'fellowship',
    title: 'Persekutuan Jemaat',
    caption: 'Kebersamaan yang saling menguatkan.',
  },
];

// ---------- Jadwal mingguan (ibadah & latihan) ----------
// Tanggal dihitung relatif "hari ini" agar selalu relevan (Minggu terdekat).
function fmtLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildDemoSchedules(today = new Date()) {
  const out = [];
  const d = new Date(`${fmtLocal(today)}T00:00:00`);
  // Dua Minggu terdekat (termasuk hari ini bila hari ini Minggu).
  for (let i = 0; i < 2; i++) {
    const diff = (7 - d.getDay()) % 7;
    d.setDate(d.getDate() + diff);
    const date = fmtLocal(d);
    out.push({
      id: `sched-${date}`,
      date,
      ibadahAda: true,
      ibadahTime: '09.00 WIB',
      latihanAda: i === 0,
      latihanTime: '13.00 WIB',
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------- Banner informasi (rasio 16:9) ----------
// HANYA 1 banner yang boleh tampil agar penyampaian fokus — mengunggah
// banner baru (lewat /admin) akan menggantikan banner yang ada.
export const DEMO_BANNERS = [
  {
    id: 'banner-1',
    slug: 'banner-ibadah-raya',
    title: 'Ibadah Raya Minggu',
    caption: 'Ibadah Raya Minggu bersama keluarga.',
    image: svgCover({ w: 800, h: 450, from: '#0d6efd', to: '#6f42c1', emoji: '⛪', label: 'Ibadah Raya Minggu' }),
    order: 1,
  },
];

// ---------- Event (rasio gambar 4:5) ----------
export const DEMO_EVENTS = [
  {
    id: 'evt-kkr',
    slug: 'ibadah-raya-kebangunan-rohani',
    title: 'Ibadah Raya Kebangunan Rohani',
    theme: 'Mengalami Kuasa Kebangkitan',
    date: '2026-09-20',
    openGate: '07.30 WIB',
    time: '09.00 WIB',
    location: 'Gedung Utama GPI Eluzai, Depok',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Tapos+Depok+Jawa+Barat',
    formLink: 'https://forms.gle/contoh-pendaftaran-kkr',
    photoLink: '',
    image: svgCover({ w: 400, h: 500, from: '#0d6efd', to: '#6f42c1', emoji: '🕊️', label: 'KKR' }),
    active: true,
  },
  {
    id: 'evt-festival',
    slug: 'festival-pujian-penyembahan',
    title: 'Festival Pujian & Penyembahan',
    theme: 'Menaikkan Pujian di Hadapan-Nya',
    date: '2026-08-09',
    openGate: '15.30 WIB',
    time: '16.00 WIB',
    location: 'Aula Ibadah GPI Eluzai',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Tapos+Depok+Jawa+Barat',
    formLink: 'https://forms.gle/contoh-pendaftaran-festival',
    photoLink: 'https://drive.google.com/drive/folders/contoh-foto-festival',
    image: svgCover({ w: 400, h: 500, from: '#6f42c1', to: '#0d6efd', emoji: '🎵', label: 'Festival' }),
    active: true,
  },
  {
    id: 'evt-retret',
    slug: 'retret-jemaat',
    title: 'Retret Jemaat',
    theme: 'Pulih, Sembuh, dan Dipulihkan',
    date: '2026-11-12',
    openGate: '15.00 WIB',
    time: '18.00 WIB',
    location: 'Rumah Retret Cisarua, Bogor',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Cisarua+Bogor',
    formLink: 'https://forms.gle/contoh-pendaftaran-retret',
    photoLink: '',
    image: svgCover({ w: 400, h: 500, from: '#198754', to: '#0d6efd', emoji: '🏔️', label: 'Retret' }),
    active: true,
  },
  {
    id: 'evt-natal',
    slug: 'kebaktian-natal-bersama',
    title: 'Kebaktian Natal Bersama',
    theme: 'Sukacita Natal Bagi Semua',
    date: '2026-05-10',
    openGate: '08.30 WIB',
    time: '10.00 WIB',
    location: 'Gedung Utama GPI Eluzai, Depok',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Tapos+Depok+Jawa+Barat',
    formLink: '',
    photoLink: 'https://drive.google.com/drive/folders/contoh-foto-natal',
    image: svgCover({ w: 400, h: 500, from: '#dc3545', to: '#d97706', emoji: '🎄', label: 'Natal' }),
    active: true,
  },
];
