// URL kanonik situs — dipakai sitemap, robots, dan metadata canonical.
// Set NEXT_PUBLIC_SITE_URL di environment produksi (mis. https://eluzai.example.com).
// Fallback lokal dipakai hanya agar development/build tidak gagal.
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
