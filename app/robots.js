import { siteUrl } from '@/lib/siteUrl';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Area admin & API tidak boleh di-index.
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
