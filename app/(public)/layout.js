import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';
import { CHURCH } from '@/lib/data';
import { siteUrl } from '@/lib/siteUrl';

// Layout khusus halaman publik (route group (public)).
// Halaman /admin tidak memakai navbar & footer publik ini.
const BASE_URL = siteUrl();

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: CHURCH.name,
  alternateName: CHURCH.shortName,
  description: CHURCH.description,
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo-placeholder.webp`,
  image: `${BASE_URL}/images/logo-placeholder.webp`,
  sameAs: [CHURCH.instagram, CHURCH.youtube].filter(Boolean),
  address: {
    '@type': 'PostalAddress',
    streetAddress: CHURCH.address,
    addressCountry: 'ID',
  },
};

import { jsonLdHtml } from '@/lib/jsonLd';

export default function PublicLayout({ children }) {
  return (
    <>
      {/* Structured data (SEO): Organisasi — berlaku untuk seluruh halaman publik */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationJsonLd) }}
      />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
