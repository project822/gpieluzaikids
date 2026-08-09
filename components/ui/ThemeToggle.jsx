'use client';

import Icon from './Icons';
import useSiteTheme from './useSiteTheme';

// Tombol mode gelap/terang SITUS PUBLIK. Tema diterapkan lewat atribut
// `data-bs-theme` pada <html> (Bootstrap 5.3) + variabel kustom situs.
// Default: LIGHT — mode gelap hanya aktif bila pengunjung memilihnya
// (kunci 'eluzai-public-theme'). Area admin memakai kunci terpisah
// ('eluzai-admin-theme') sehingga tidak saling mengikuti.
export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useSiteTheme('eluzai-public-theme');

  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={toggle}
      aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      title={dark ? 'Mode terang' : 'Mode gelap'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
