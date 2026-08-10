import { getEvents } from '@/lib/repo';
import { siteUrl } from '@/lib/siteUrl';

// Sitemap dinamis: beranda + halaman detail semua event (ISR).
// Halaman event yang disembunyikan admin (active: false) tetap di-index
// karena masih dapat diakses langsung lewat URL — konsisten dengan robots.
export default async function sitemap() {
  const base = siteUrl();
  const events = await getEvents();

  const entries = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...events.map((e) => ({
      url: `${base}/event/${e.id}`,
      lastModified: e.updatedAt ? new Date(e.updatedAt) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
  ];

  return entries;
}
