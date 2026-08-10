import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icons';
import EventActions from '@/components/user/EventActions';
import { formatEventDate, imageUrl, publicEvent } from '@/lib/format';
import { getEventById, getEvents } from '@/lib/repo';
import { siteUrl } from '@/lib/siteUrl';

export const revalidate = 60;

// Metadata dinamis per event (SEO): judul, deskripsi, canonical, og:image.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await getEventById(id);
  if (!item) return { title: 'Event Tidak Ditemukan' };
  const description = item.theme
    ? `Tema: ${item.theme} — ${item.date} di ${item.location || 'GPI Eluzai Kids'}.`
    : `${item.title} — ${item.date} di ${item.location || 'GPI Eluzai Kids'}.`;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/event/${item.id}` },
    openGraph: {
      type: 'article',
      title: item.title,
      description,
      url: `${siteUrl()}/event/${item.id}`,
      images: item.image
        ? [{ url: `${siteUrl()}/img/${encodeURIComponent(item.id)}`, alt: item.title }]
        : [{ url: `${siteUrl()}/images/logo-placeholder.webp`, alt: 'GPI Eluzai Kids' }],
    },
  };
}

// Pre-render halaman detail semua event yang diketahui (ISR) —
// event baru dirender on-demand lalu ikut di-cache 60 detik.
export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ id: e.id }));
}

// Ubah tautan Google Maps biasa menjadi URL embed untuk iframe.
// HANYA host Google yang diizinkan — tautan lain (termasuk yang memuat
// 'output=embed') tidak dirender sebagai iframe di halaman publik.
const EMBED_ALLOW_HOSTS = new Set(['www.google.com', 'maps.google.com', 'google.com']);

function mapsEmbedUrl(link) {
  if (!link) return null;
  let host;
  try {
    host = new URL(link).host;
  } catch {
    return null;
  }
  if (!EMBED_ALLOW_HOSTS.has(host)) return null;
  if (link.includes('output=embed')) return link;
  const m = link.match(/[?&]query=([^&]+)/);
  if (m) {
    try {
      return `https://www.google.com/maps?q=${encodeURIComponent(decodeURIComponent(m[1]))}&output=embed`;
    } catch {
      return null;
    }
  }
  return null;
}

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  const item = await getEventById(id);
  if (!item) notFound();

  // EventActions adalah komponen client — kirim objek ringan tanpa
  // data-URL base64 (RSC payload tetap kecil). Gambar lewat /img/[id].
  const actionsItem = publicEvent(item);

  const dateLabel = formatEventDate(item.date);
  const embed = mapsEmbedUrl(item.mapsLink);

  const info = [
    { icon: 'calendar', label: 'Tanggal', value: dateLabel },
    { icon: 'door', label: 'Open Gate', value: item.openGate || '–' },
    { icon: 'clock', label: 'Waktu Mulai', value: item.time || '–' },
    { icon: 'map-pin', label: 'Lokasi / Tempat', value: item.location || '–' },
  ];

  // Structured data (SEO): halaman event → skema Event (rich results).
  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: item.title,
    description: item.theme || item.title,
    startDate: item.date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: item.location || 'GPI Eluzai Kids',
    },
    image: item.image ? `${siteUrl()}/img/${encodeURIComponent(item.id)}` : `${siteUrl()}/images/logo-placeholder.webp`,
    organizer: {
      '@type': 'Organization',
      name: 'GPI Eluzai Kids',
      url: siteUrl(),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
      <PageHeader title={item.title} sub={item.theme ? `Tema: ${item.theme}` : undefined} />

      <section className="section pt-4">
        <div className="container">
          <div className="row g-4 align-items-stretch">
            {/* Foto event (rasio 4:5) */}
            <div className="col-lg-5">
              <div className="detail-photo h-100">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(item)} alt={item.title} loading="lazy" decoding="async" />
                ) : (
                  <div className="event-cover-fallback h-100" style={{ borderRadius: 'var(--eluzai-radius)' }}>
                    <Icon name="cross" size={48} />
                  </div>
                )}
              </div>
            </div>

            {/* Info & aksi */}
            <div className="col-lg-7">
              <div className="card-lift p-4 p-md-5 h-100 d-flex flex-column">
                <div className="d-flex flex-column gap-3 mb-4">
                  {info.map((r) => (
                    <div className="d-flex align-items-start gap-3" key={r.label}>
                      <span className="icon-chip flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 10 }}>
                        <Icon name={r.icon} size={18} />
                      </span>
                      <div>
                        <div className="text-sm text-secondary">{r.label}</div>
                        <div className="fw-semibold text-dark">{r.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="d-flex gap-2 flex-wrap mt-auto pt-3">
                  <EventActions item={actionsItem} large block={false} />
                  {item.mapsLink && (
                    <a
                      href={item.mapsLink}
                      target="_blank"
                      rel="noreferrer"
                      className={`btn btn-eluzai-outline ${item.mapsLink ? 'btn-lg' : ''}`}
                    >
                      <Icon name="external" size={17} className="me-1" /> Buka di Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Peta lokasi */}
          {embed && (
            <div className="mt-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Icon name="map-pin" size={20} className="text-primary" />
                <h3 className="mb-0" style={{ fontSize: '1.35rem' }}>Peta Lokasi</h3>
              </div>
              <iframe
                src={embed}
                className="map-frame"
                title={`Peta lokasi ${item.title}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}

          <div className="mt-5 text-center">
            <Link href="/#event" className="btn btn-eluzai-outline">
              <Icon name="chevron-left" size={16} className="me-1" /> Kembali ke Semua Event
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
