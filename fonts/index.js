// Font lokal GPI Eluzai — tanpa Google Fonts (privasi & kecepatan).
//   Inter          → teks body & UI (400–700)
//   Hanken Grotesk → judul/heading & angka besar (600–800)
// Dipakai lewat CSS variable --font-inter & --font-hanken (lihat globals.css).
import localFont from 'next/font/local';

export const inter = localFont({
  src: [
    { path: './inter-400.woff2', weight: '400', style: 'normal' },
    { path: './inter-500.woff2', weight: '500', style: 'normal' },
    { path: './inter-600.woff2', weight: '600', style: 'normal' },
    { path: './inter-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const hankenGrotesk = localFont({
  src: [
    { path: './hanken-grotesk-600.woff2', weight: '600', style: 'normal' },
    { path: './hanken-grotesk-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-hanken',
  display: 'swap',
});
