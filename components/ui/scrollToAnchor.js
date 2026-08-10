// Scroll presisi ke section: posisi akhir dihitung dari tinggi header AKTUAL
// (bukan scroll-padding CSS yang bisa diabaikan browser bila body menjadi
// scroll container karena overflow-x:hidden).
//
// Target pendaratan = JUDUL section (heading pertama), bukan tepi atas
// section — sehingga setelah klik menu, judul langsung berada tepat di bawah
// navbar tanpa meninggalkan celah padding section yang besar di atasnya.
//
// Dua sumber geseran (drift) dikompensasi di sini:
//   1. Transform animasi Reveal — section di bawah viewport masih memiliki
//      `transform: translateY(24px)` (lihat .reveal di globals.css). Jika
//      diabaikan, posisi yang dihitung lebih rendah 24px dari posisi akhir,
//      sehingga judul mendarat terlalu tinggi (terlihat "kurang turun").
//      Offset transform dari ancestor .reveal yang belum terlihat dikurangkan.
//   2. Tinggi navbar yang menyusut saat scroll — `.navbar-eluzai.is-scrolled`
//      mengurangi padding vertikal (0.85rem → 0.6rem). Saat klik dilakukan
//      dari atas halaman, header masih "gemuk"; setelah scroll ia menyusut
//      dan konten ikut naik. Tinggi header dihitung dalam keadaan scrolled
//      (pengukuran instan dengan transition dimatikan).
export const ANCHOR_GAP = 14; // jarak napas di bawah navbar

// Offset translateY dari ancestor .reveal yang belum masuk viewport (masih
// tersembunyi). Mengembalikan 0 bila section sudah pernah terlihat (animasi
// selesai) atau bila tidak ada transform.
function hiddenRevealOffsetY(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    if (
      node.classList &&
      node.classList.contains('reveal') &&
      !node.classList.contains('reveal-visible')
    ) {
      const tf = window.getComputedStyle(node).transform;
      if (tf && tf !== 'none') {
        const m = tf.match(/matrix3d\(([^)]+)\)|matrix\(([^)]+)\)/);
        if (m) {
          const parts = (m[1] || m[2]).split(',').map(Number);
          const ty = m[1] ? parts[13] : parts[5];
          if (Number.isFinite(ty)) return ty || 0;
        }
      }
    }
    node = node.parentElement;
  }
  return 0;
}

// Tinggi navbar dalam keadaan tergulir (is-scrolled). Measured instan dengan
// transition dimatikan — tanpa ini, perubahan padding baru diterapkan selama
// 0.2s sehingga pengukuran saat itu masih memakai tinggi lama.
function scrolledHeaderHeight(header) {
  const prevTransition = header.style.transition;
  header.style.transition = 'none';
  header.classList.add('is-scrolled');
  const h = header.getBoundingClientRect().height;
  header.classList.remove('is-scrolled');
  header.style.transition = prevTransition;
  return h;
}

export function scrollToAnchor(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const header = document.querySelector('.navbar-eluzai');
  const headerH = header ? scrolledHeaderHeight(header) : 0;
  const heading =
    target.querySelector('.section-title') ||
    target.querySelector('h1, h2, h3');
  const anchor = heading || target;
  const revealOffset = hiddenRevealOffsetY(anchor);
  const y =
    anchor.getBoundingClientRect().top +
    window.scrollY -
    headerH -
    ANCHOR_GAP -
    revealOffset;
  window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
}
