import Reveal from '@/components/ui/Reveal';
import HomeSlider from '@/components/user/HomeSlider';
import AnchorLink from '@/components/ui/AnchorLink';
import Icon from '@/components/ui/Icons';
import { CHURCH, HOME_SLIDES } from '@/lib/data';

export default function HeroSection({ verse: verseProp = '', verseRef: verseRefProp = '' }) {
  // Kutipan ayat bisa diatur dari panel admin (Informasi); bila kosong,
  // tampilkan ayat bawaan dari data gereja.
  const verse = verseProp || CHURCH.verse;
  const verseRef = verseRefProp || CHURCH.verseRef;
  return (
    <section id="beranda" className="hero">
      <div className="container">
        <div className="row align-items-center g-5">
          {/* Teks hero */}
          <div className="col-lg-6">
            <Reveal>
              {/* Judul tampil satu warna (ink) — tanpa aksen biru pada bagian akhir */}
              <h1 className="hero-title mb-3">{CHURCH.tagline}</h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="hero-lead text-secondary mb-2">
                “{verse}”
              </p>
              <p className="hero-verse-ref mb-4">{verseRef}</p>
            </Reveal>

            <Reveal delay={270}>
              <div className="d-flex flex-wrap gap-3">
                <AnchorLink id="event" className="btn btn-eluzai btn-lg">
                  Lihat Event Terdekat <Icon name="arrow-right" size={18} className="ms-1" />
                </AnchorLink>
                <AnchorLink id="kontak" className="btn btn-eluzai-outline btn-lg">
                  <Icon name="whatsapp" size={18} className="me-1" /> Hubungi Kami
                </AnchorLink>
              </div>
            </Reveal>
          </div>

          {/* Foto suasana gereja (slider) */}
          <div className="col-lg-6">
            <Reveal delay={150}>
              <HomeSlider slides={HOME_SLIDES} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
