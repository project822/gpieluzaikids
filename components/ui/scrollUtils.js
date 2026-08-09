// Utilitas bersama untuk animasi scroll (dipakai oleh Reveal & Stagger).
// Nilai default mengikuti template lib/scroll.min.js:
//   - threshold 0.08, rootMargin '0px 0px -60px 0px'

export const OBS_OPTIONS = { threshold: 0.08, rootMargin: '0px 0px -60px 0px' };

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
