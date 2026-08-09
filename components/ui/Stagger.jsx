'use client';

import { Children, cloneElement, useEffect, useRef } from 'react';
import { OBS_OPTIONS, prefersReducedMotion } from './scrollUtils';

// ── Staggered Reveal (diadaptasi dari `[data-stagger]` lib/scroll.min.js) ──
// Grup item muncul BERURUTAN: delay item ke-i = i × baseDelay saat masuk
// viewport, dan berurutan TERBALIK saat keluar (fade-out natural dari bawah).
//
// Bekerja langsung di atas children (mis. kolom grid Bootstrap) — setiap
// child diberi atribut `data-reveal` + class `reveal` sehingga struktur
// grid tetap utuh (tanpa wrapper tambahan di antara .row dan kolom).
//
// Props:
//   baseDelay → jeda antar item (ms). Default 80 (sama dengan template)
//   once      → true: animasi hanya sekali per item
//   className → diteruskan ke container (mis. "row g-4")
//
// Fallback: prefers-reduced-motion / tanpa IntersectionObserver → tampil semua.

export default function Stagger({ children, baseDelay = 80, once = false, className = '', ...rest }) {
  const containerRef = useRef(null);

  // Signature kunci children: saat daftar item berubah, observer dijalankan
  // ulang agar item baru ikut diamati (tidak tertinggal dalam keadaan tersembunyi).
  const childrenKeys =
    Children.map(children, (c) => (c != null && typeof c === 'object' ? c.key : null))?.join('|') ?? '';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      items.forEach((el) => el.classList.add('reveal-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Ambil ulang daftar item tiap callback (sama seperti template)
        // agar item baru yang dirender belakangan ikut terhitung.
        const currentItems = Array.from(container.querySelectorAll('[data-reveal]'));
        entries.forEach((entry) => {
          const el = entry.target;
          const index = currentItems.indexOf(el);
          const delayMs = entry.isIntersecting
            ? index * baseDelay
            : (currentItems.length - 1 - index) * baseDelay;
          el.style.transitionDelay = `${delayMs}ms`;
          el.classList.toggle('reveal-visible', entry.isIntersecting);
          if (once && entry.isIntersecting) observer.unobserve(el);
        });
      },
      OBS_OPTIONS
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [baseDelay, once, childrenKeys]);

  return (
    <div ref={containerRef} className={className} {...rest}>
      {Children.map(children, (child, i) =>
        child == null || typeof child !== 'object'
          ? child
          : cloneElement(child, {
              key: child.key ?? i,
              'data-reveal': '',
              className: `${child.props?.className ?? ''} reveal`.trim(),
            })
      )}
    </div>
  );
}
