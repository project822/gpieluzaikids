'use client';

import { useEffect, useState } from 'react';
import Icon from './Icons';

// Tombol "kembali ke atas" — muncul setelah halaman di-scroll ke bawah.
// (Div scroll-progress dihapus atas permintaan; hanya tombol ini yang tersisa.)
export default function BackToTop() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setShowTop(document.documentElement.scrollTop > 600);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (!showTop) return null;

  return (
    <button
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
    >
      <Icon name="chevron-up" size={18} />
    </button>
  );
}
