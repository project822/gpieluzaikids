// Scroll presisi ke section: posisi akhir dihitung dari tinggi header AKTUAL
// (bukan scroll-padding CSS yang bisa diabaikan browser bila body menjadi
// scroll container karena overflow-x:hidden).
//
// Target pendaratan = JUDUL section (heading pertama), bukan tepi atas
// section — sehingga setelah klik menu, judul langsung berada tepat di bawah
// navbar tanpa meninggalkan celah padding section yang besar di atasnya.
export const ANCHOR_GAP = 14; // jarak napas di bawah navbar

export function scrollToAnchor(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const header = document.querySelector('.navbar-eluzai');
  const headerH = header ? header.offsetHeight : 0;
  const heading =
    target.querySelector('.section-title') ||
    target.querySelector('h1, h2, h3');
  const anchor = heading || target;
  const y = anchor.getBoundingClientRect().top + window.scrollY - headerH - ANCHOR_GAP;
  window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
}
