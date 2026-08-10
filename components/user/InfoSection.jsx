import Link from 'next/link';
import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';
import { CHURCH } from '@/lib/data';
import { imageUrl, safeExternalUrl } from '@/lib/format';

// Banner menjadi LINK hanya bila admin mengisi field "Tautan Banner":
//   - jalur internal (/event/...)  → navigasi halaman yang sama (next/link)
//   - URL eksternal (https://...)  → dibuka di tab baru (rel=noreferrer)
// Jika tautan kosong, banner tampil sebagai gambar biasa (tidak bisa diklik).
function BannerFigure({ banner }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(banner)}
      alt={banner.title || 'Banner informasi'}
      loading="lazy"
      decoding="async"
    />
  );
  const caption = (banner.title || banner.caption) && (
    <figcaption>
      {banner.title && <span className="banner-title">{banner.title}</span>}
      {banner.caption && <span className="banner-caption">{banner.caption}</span>}
    </figcaption>
  );
  const figure = (
    <figure className="banner-block" style={{ maxWidth: 960, marginInline: 'auto' }}>
      {img}
      {caption}
    </figure>
  );

  const link = String(banner.link || '').trim();
  if (!link) return figure;

  // Jalur internal: navigasi antar-halaman (tab yang sama).
  if (link.startsWith('/') && !link.startsWith('//')) {
    return (
      <Link href={link} className="banner-link" aria-label={`${banner.title || 'Banner informasi'} — buka tautan`}>
        {figure}
      </Link>
    );
  }
  // URL eksternal: hanya http/https yang dirender (defense-in-depth —
  // menetralkan skema berbahaya bila data tersimpan rusak/dari sumber lain).
  const external = safeExternalUrl(link);
  if (!external) return figure;
  return (
    <a
      href={external}
      target="_blank"
      rel="noreferrer"
      className="banner-link"
      aria-label={`${banner.title || 'Banner informasi'} — buka tautan eksternal`}
    >
      {figure}
    </a>
  );
}

export default function InfoSection({ banners }) {
  return (
    <section id="informasi" className="section section-alt">
      <div className="container" style={{ maxWidth: 980 }}>
        <Reveal>
          <SectionHeading
            center
            title="Kabar Terbaru Gereja"
            sub={`Pengumuman dan berita terbaru ${CHURCH.shortName}.`}
          />
        </Reveal>

        {banners.length === 0 ? (
          <Reveal>
            <div className="text-center py-5">
              <Icon name="info" size={38} className="text-secondary opacity-50 mb-3" />
              <p className="text-secondary mb-0">
                Belum ada banner informasi. Admin dapat mengunggah banner dari panel admin.
              </p>
            </div>
          </Reveal>
        ) : (
          // Hanya 1 banner yang boleh tampil (fokus penyampaian) —
          // unggah banner baru di /admin akan menggantikan banner lama.
          <Reveal>
            <BannerFigure banner={banners[0]} />
          </Reveal>
        )}
      </div>
    </section>
  );
}
