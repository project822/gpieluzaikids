import Script from 'next/script';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { inter, hankenGrotesk } from '@/fonts';
import { siteUrl } from '@/lib/siteUrl';

const BASE_URL = siteUrl();

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'GPI Eluzai Kids — Tempat Anak Bertumbuh dalam Iman & Sukacita',
    template: '%s · GPI Eluzai Kids',
  },
  description: 'Situs resmi GPI Eluzai Kids — informasi ibadah, jadwal, event, dan kontak.',
  keywords: ['GPI Eluzai', 'Eluzai Kids', 'Gereja', 'Ibadah', 'Event', 'Surabaya'],
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/image/logo-placeholder.webp',
    apple: '/image/logo-placeholder.webp',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'GPI Eluzai Kids',
    url: BASE_URL,
    title: 'GPI Eluzai Kids — Tempat Anak Bertumbuh dalam Iman & Sukacita',
    description: 'Informasi ibadah, jadwal, event, dan kontak GPI Eluzai Kids.',
    images: [{ url: `${BASE_URL}/images/logo-placeholder.webp`, width: 512, height: 512, alt: 'Logo GPI Eluzai' }],
  },
  twitter: {
    card: 'summary',
    title: 'GPI Eluzai Kids',
    description: 'Informasi ibadah, jadwal, event, dan kontak GPI Eluzai Kids.',
    images: [`${BASE_URL}/images/logo-placeholder.webp`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: '#1d4ed8',
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
