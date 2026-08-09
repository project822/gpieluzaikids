// Scroll presisi ke section: offset dihitung dari tinggi header AKTUAL
// (bukan scroll-padding CSS yang bisa diabaikan browser bila body menjadi
// scroll container karena overflow-x:hidden).
export const ANCHOR_GAP = 14; // jarak napas di bawah navbar

export function scrollToAnchor(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const header = document.querySelector('.navbar-eluzai');
  const headerH = header ? header.offsetHeight : 0;
  const y = target.getBoundingClientRect().top + window.scrollY - headerH - ANCHOR_GAP;
  window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
}
