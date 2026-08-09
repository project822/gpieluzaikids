import Reveal from '@/components/ui/Reveal';
import HomeSlider from '@/components/user/HomeSlider';
import AnchorLink from '@/components/ui/AnchorLink';
import Icon from '@/components/ui/Icons';
import { CHURCH, HOME_SLIDES } from '@/lib/data';

export default function HeroSection() {
  const words = CHURCH.tagline.split(' ');
  return (
    <section id="beranda" className="hero">
      <div className="container">
        <div className="row align-items-center g-5">
          {/* Teks hero (tanpa statistik) */}
          <div className="col-lg-6">
            <Reveal>
              <div className="hero-badge mb-4">
                <Icon name="sparkle" size={16} className="text-success" />
                {CHURCH.fullName}
              </div>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="hero-title mb-3">
                {words.slice(0, -2).join(' ')}{' '}
                <span style={{ color: 'var(--eluzai-blue)' }}>{words.slice(-2).join(' ')}</span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="hero-lead text-secondary mb-4">{CHURCH.description}</p>
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
