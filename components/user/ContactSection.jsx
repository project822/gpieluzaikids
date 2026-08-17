import Reveal from '@/components/ui/Reveal';
import Stagger from '@/components/ui/Stagger';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';
import { CHURCH } from '@/lib/data';

const CARDS = [
  {
    icon: 'whatsapp',
    title: 'WhatsApp',
    lines: ['Respons tercepat untuk informasi.'],
    href: `https://wa.me/${CHURCH.whatsapp}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang GPI Eluzai.')}`,
    hrefLabel: 'Chat WhatsApp',
    chip: 'icon-chip-green',
  },
  {
    icon: 'instagram',
    title: 'Instagram',
    lines: ['Kabar & momen kegiatan anak-anak.'],
    href: CHURCH.instagram,
    hrefLabel: 'Buka Instagram',
    chip: 'icon-chip-ig',
  },
  {
    icon: 'youtube',
    title: 'YouTube',
    lines: ['Rekaman ibadah & renungan singkat.'],
    href: CHURCH.youtube,
    hrefLabel: 'Buka YouTube',
    chip: 'icon-chip-yt',
  },
];

export default function ContactSection() {
  return (
    <section id="kontak" className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <Reveal>
          <SectionHeading
            center
            title="Kontak GPI Eluzai Kids"
            sub="Terhubung dengan kami - kami siap membantu"
          />
        </Reveal>

        <Stagger baseDelay={100} className="row g-4">
          {CARDS.map((c) => (
            <div className="col-md-6 col-lg-4" key={c.title}>
              <div className="card-lift p-4 h-100 d-flex flex-column gap-3 text-center">
                <span className={`icon-chip mx-auto ${c.chip}`}>
                  <Icon name={c.icon} size={26} />
                </span>
                <h5 className="mb-0">{c.title}</h5>
                <p className="text-sm mb-0">{c.lines[0]}</p>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-eluzai-outline btn-sm mt-auto"
                >
                  {c.hrefLabel} <Icon name="external" size={14} className="ms-1" />
                </a>
              </div>
            </div>
          ))}
        </Stagger>

      </div>
    </section>
  );
}
