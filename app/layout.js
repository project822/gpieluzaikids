import Script from 'next/script';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { inter, hankenGrotesk } from '@/fonts';

export const metadata = {
  title: {
    default: 'GPI Eluzai Kids — Tempat Anak Bertumbuh dalam Iman & Sukacita',
    template: '%s · GPI Eluzai Kids',
  },
  description:
    'Situs resmi GPI Eluzai: informasi, jadwal event, lokasi, dan kontak. Ibadah, pengajaran Firman, dan persekutuan yang hangat bagi seluruh keluarga.',
  keywords: ['GPI Eluzai', 'Eluzai Kids', 'Gereja', 'Ibadah', 'Event', 'Depok'],
};

// Variabel tema: 'eluzai-public-theme' untuk situs publik,
// 'eluzai-admin-theme' untuk area admin (independen — tidak saling
// mengikuti). Default SELALU light; mode gelap hanya aktif bila pengguna
// menyimpan pilihan 'dark' pada kunci area yang bersangkutan (tanpa
// fallback prefers-color-scheme). Kunci publik SEGAR ('public') agar
// preferensi gelap dari versi situs lama tidak membatalkan default light.
export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${hankenGrotesk.variable}`}>
        {/* Deteksi JavaScript + inisialisasi tema sebelum paint (anti-flash):
            - .js → konten [data-reveal]/.reveal tetap terlihat tanpa JS
            - data-bs-theme="dark" → mode gelap Bootstrap + variabel kustom
            Area admin memakai kunci tema sendiri (eluzai-admin-theme). */}
        <Script id="js-detector" strategy="beforeInteractive">
          {`(function () {
  document.documentElement.classList.add('js');
  try {
    var isAdmin = location.pathname.indexOf('/admin') === 0;
    var t = localStorage.getItem(isAdmin ? 'eluzai-admin-theme' : 'eluzai-public-theme');
    if (t === 'dark') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  } catch (e) {}
})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
