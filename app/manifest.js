import { siteUrl } from '@/lib/siteUrl';

// Web App Manifest — membuat situs dapat di-install sebagai aplikasi
// (Android/Chrome) dan memperkuat branding di hasil pencarian.
export default function manifest() {
  return {
    name: 'GPI Eluzai Kids',
    short_name: 'Eluzai Kids',
    description: 'Situs resmi GPI Eluzai Kids — informasi ibadah, jadwal, event, dan kontak.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#1d4ed8',
    lang: 'id',
    icons: [
      {
        src: `${siteUrl()}/images/logo-placeholder.webp`,
        sizes: 'any',
        type: 'image/webp',
        purpose: 'any maskable',
      },
    ],
  };
}
