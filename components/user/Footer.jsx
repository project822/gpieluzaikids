import Icon from '../ui/Icons';
import AnchorLink from '@/components/ui/AnchorLink';
import { CHURCH } from '@/lib/data';

const MENU = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'informasi', label: 'Informasi' },
  { id: 'event', label: 'Event' },
  { id: 'lokasi', label: 'Lokasi' },
  { id: 'kontak', label: 'Kontak' },
];

export default function Footer() {
  return (
    <footer className="footer-eluzai">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="brand-logo">
                <Icon name="cross" size={20} />
              </span>
              <span className="fw-bold fs-5 text-white">Eluzai Kids</span>
            </div>
            <p className="text-sm mb-3" style={{ maxWidth: 460 }}>
              {CHURCH.fullName}. Melayani jemaat dengan kasih Kristus sejak {CHURCH.established} —
              ibadah, pengajaran Firman, dan persekutuan yang hangat.
            </p>
            <div className="d-flex gap-2">
              <a href={`https://wa.me/${CHURCH.whatsapp}`} target="_blank" rel="noreferrer" className="social-btn wa" aria-label="WhatsApp">
                <Icon name="whatsapp" size={18} />
              </a>
              <a href={CHURCH.instagram} target="_blank" rel="noreferrer" className="social-btn ig" aria-label="Instagram">
                <Icon name="instagram" size={18} />
              </a>
              <a href={CHURCH.youtube} target="_blank" rel="noreferrer" className="social-btn yt" aria-label="YouTube">
                <Icon name="youtube" size={18} />
              </a>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <h6>Menu</h6>
            {MENU.map((m) => (
              <AnchorLink key={m.id} id={m.id} className="footer-link">
                {m.label}
              </AnchorLink>
            ))}
          </div>

          <div className="col-6 col-lg-3">
            <h6>Lokasi</h6>
            <p className="text-sm d-flex align-items-start gap-2 mb-3" style={{ color: '#cbd5e1' }}>
              <Icon name="map-pin" size={16} className="mt-1 flex-shrink-0" style={{ color: '#60a5fa' }} /> {CHURCH.address}
            </p>
            <a
              href={CHURCH.mapsLink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm px-3"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#e2e8f0',
                borderRadius: 10,
              }}
            >
              <Icon name="external" size={15} className="me-1" /> Buka di Google Maps
            </a>
          </div>
        </div>

        <div className="footer-bottom text-center">
          © {new Date().getFullYear()} {CHURCH.name}. All right reserved.
        </div>
      </div>
    </footer>
  );
}
