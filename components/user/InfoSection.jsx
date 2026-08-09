import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';
import { CHURCH } from '@/lib/data';
import { imageUrl } from '@/lib/format';

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
            <figure className="banner-block" style={{ maxWidth: 960, marginInline: 'auto' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(banners[0])}
                alt={banners[0].title || 'Banner informasi'}
                loading="lazy"
                decoding="async"
              />
              {(banners[0].title || banners[0].caption) && (
                <figcaption>
                  {banners[0].title && <span className="banner-title">{banners[0].title}</span>}
                  {banners[0].caption && <span className="banner-caption">{banners[0].caption}</span>}
                </figcaption>
              )}
            </figure>
          </Reveal>
        )}
      </div>
    </section>
  );
}
