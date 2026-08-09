import Reveal from '@/components/ui/Reveal';
import Stagger from '@/components/ui/Stagger';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';
import { CHURCH } from '@/lib/data';

export default function LocationSection() {
  return (
    <section id="lokasi" className="section section-alt">
      <div className="container">
        <Reveal>
          <SectionHeading
            center
            title="Di Mana Kami Beribadah"
            sub="Temukan lokasi gereja kami melalui peta di bawah, atau buka langsung di Google Maps."
          />
        </Reveal>
        <Stagger baseDelay={120} className="row g-4 align-items-stretch">
          <div className="col-lg-7">
            <iframe
              src={CHURCH.mapsEmbed}
              className="map-frame"
              title="Lokasi gereja di peta"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="col-lg-5">
            <div className="card-lift p-4 p-md-5 h-100 d-flex flex-column">
              <span className="icon-chip mb-3">
                <Icon name="map-pin" size={26} />
              </span>
              <h5 className="mb-2">Alamat Lengkap</h5>
              <p className="text-secondary mb-4">{CHURCH.address}</p>
              <div className="d-flex gap-2 flex-wrap mt-auto">
                <a
                  href={CHURCH.mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-eluzai"
                >
                  <Icon name="external" size={17} className="me-1" /> Buka di Google Maps
                </a>
              </div>
            </div>
          </div>
        </Stagger>
      </div>
    </section>
  );
}
