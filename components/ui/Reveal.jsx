'use client';

import { useEffect, useRef, useState } from 'react';
import { OBS_OPTIONS, prefersReducedMotion } from './scrollUtils';

// ── Scroll-Triggered Fade (diadaptasi dari template lib/scroll.min.js) ──
// Template memakai atribut [data-reveal] + toggle class `.active`; di sini
// diadaptasi menjadi komponen React dengan class `.reveal`/`.reveal-visible`.
//
// Perilaku DUA ARAH sesuai template:
//   - fade-in halus saat elemen masuk viewport
//   - fade-out halus saat elemen keluar viewport (observer TETAP aktif,
//     tidak di-unobserve — konten bisa muncul & hilang lagi)
//
// Props:
//   delay    → transition-delay (ms), untuk efek stagger manual antar elemen
//   duration → transition-duration (ms)
//   once     → true: animasi hanya sekali (tidak fade-out saat keluar)
//
// Fallback (progressive enhancement, sesuai template):
//   - prefers-reduced-motion aktif  → langsung tampil, tanpa animasi
//   - IntersectionObserver tidak ada → langsung tampil

export default function Reveal({ children, delay = 0, duration, once = false, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }

    if (delay) el.style.transitionDelay = `${delay}ms`;
    if (duration) el.style.transitionDuration = `${duration}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (once && entry.isIntersecting) observer.disconnect();
      },
      OBS_OPTIONS
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, duration, once]);

  return (
    <div ref={ref} className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}
