import Link from 'next/link';
import Reveal from '@/components/ui/Reveal';
import Stagger from '@/components/ui/Stagger';
import EventCard from '@/components/user/EventCard';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';

// Batas kartu di beranda agar tidak menumpuk — semua event tetap bisa
// dijelajahi di halaman arsip /events (filter + pencarian + paginasi).
const UPCOMING_LIMIT = 3;

function EventGrid({ events, emptyText }) {
  if (events.length === 0) {
    return (
      <Reveal>
        <div className="text-center py-4">
          <p className="text-secondary mb-0">{emptyText}</p>
        </div>
      </Reveal>
    );
  }
  // Stagger: kartu muncul berurutan (i × 90ms) saat masuk viewport,
  // dan fade-out berurutan terbalik saat keluar (diadaptasi dari template).
  return (
    <Stagger baseDelay={90} className="row g-4">
      {events.map((e) => (
        <div className="col-md-6 col-lg-4" key={e.id}>
          <EventCard item={e} />
        </div>
      ))}
    </Stagger>
  );
}

export default function EventsSection({ events }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = events.filter((e) => e.active !== false);
  const upcoming = active
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, UPCOMING_LIMIT);

  return (
    <section id="event" className="section">
      <div className="container">
        <Reveal>
          <SectionHeading
            center
            title="Event Jemaat"
            sub="Ikut serta dalam ibadah dan kegiatan jemaat — pendaftaran ditutup otomatis pada H-2, setelah itu foto kegiatan tersedia di Google Drive."
          />
        </Reveal>

        {upcoming.length > 0 && (
          <Reveal>
            <div className="d-flex align-items-center gap-2 mb-4">
              <Icon name="calendar" size={20} className="text-primary" />
              <h3 className="mb-0" style={{ fontSize: '1.35rem' }}>Akan Datang</h3>
              <span className="badge-soft badge-green">{upcoming.length} event</span>
            </div>
          </Reveal>
        )}
        <EventGrid
          events={upcoming}
          emptyText="Belum ada event mendatang. Pantau terus halaman ini!"
        />

        {upcoming.length > 0 && (
          <Reveal>
            <div className="text-center mt-5">
              <Link href="/events" className="btn btn-eluzai px-4">
                Lihat Semua Event <Icon name="arrow-right" size={17} className="hover-arrow ms-1" />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
