'use client';

import { useEffect, useState } from 'react';

// ── Hook tema per-area ──
// Situs publik memakai kunci 'eluzai-public-theme'; area admin memakai
// 'eluzai-admin-theme' — keduanya INDEPENDEN (tidak saling mengikuti)
// dan default-nya light. Mode gelap hanya aktif bila pengguna memilih
// 'dark' pada kunci area yang bersangkutan.
//
// Saat komponen area ter-mount, tema area tersebut langsung diterapkan
// ke <html> (data-bs-theme) — sehingga berpindah dari admin ke situs
// publik (atau sebaliknya) selalu memakai preferensi area yang benar.
const apply = (key) => {
  let dark = false;
  try {
    dark = localStorage.getItem(key) === 'dark';
  } catch {
    /* abaikan (mis. mode privat) */
  }
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  return dark;
};

export default function useSiteTheme(storageKey) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // setTimeout 0 → tunggu satu frame agar konsisten dengan skrip inline layout.
    const t = setTimeout(() => setDark(apply(storageKey)), 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-bs-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem(storageKey, next ? 'dark' : 'light');
    } catch {
      /* abaikan */
    }
  };

  return { dark, toggle };
}
