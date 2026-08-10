import Link from 'next/link';
import Icon from '../ui/Icons';
import EventActions from './EventActions';
import { formatEventDate, imageUrl } from '@/lib/format';

export default function EventCard({ item }) {
  const dateLabel = formatEventDate(item.date);

  return (
    <div className="card-lift event-card d-flex flex-column overflow-hidden">
      {/* Badge status arsip: hanya muncul untuk event yang disembunyikan admin */}
      {item.active === false && (
        <span className="event-hidden-badge" title="Event disembunyikan dari beranda oleh admin">
          <Icon name="x" size={12} /> Tersembunyi
        </span>
      )}
      <Link href={`/event/${item.id}`} className="event-cover" aria-label={`Detail ${item.title}`}>
        {(item.hasImage ?? Boolean(item.image)) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(item)} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="event-cover-fallback">
            <Icon name="cross" size={40} />
          </div>
        )}
      </Link>

      <div className="p-4 d-flex flex-column gap-3 flex-grow-1">
        <div>
          {item.theme && <span className="badge-soft badge-blue mb-2">{item.theme}</span>}
          <h5 className="mb-0 event-title">
            <Link href={`/event/${item.id}`} className="text-decoration-none text-dark">
              {item.title}
            </Link>
          </h5>
        </div>

        <div className="d-flex flex-column gap-2 text-sm text-secondary">
          <span className="d-flex align-items-center gap-2">
            <Icon name="calendar" size={16} className="text-primary flex-shrink-0" />
            <span className="text-dark fw-semibold">{dateLabel}</span>
          </span>
          {item.openGate && (
            <span className="d-flex align-items-center gap-2">
              <Icon name="door" size={16} className="text-primary flex-shrink-0" />
              Open gate <span className="text-dark fw-semibold">{item.openGate}</span>
            </span>
          )}
          <span className="d-flex align-items-center gap-2">
            <Icon name="clock" size={16} className="text-primary flex-shrink-0" />
            Mulai pukul <span className="text-dark fw-semibold">{item.time || '–'}</span>
          </span>
          <span className="d-flex align-items-start gap-2">
            <Icon name="map-pin" size={16} className="text-primary mt-1 flex-shrink-0" />
            <span>{item.location}</span>
          </span>
        </div>

        <div className="d-flex gap-2 flex-wrap mt-auto pt-2">
          <EventActions item={item} />
          <Link href={`/event/${item.id}`} className="btn btn-eluzai-outline btn-sm px-3">
            Detail <Icon name="arrow-right" size={15} className="hover-arrow" />
          </Link>
        </div>
      </div>
    </div>
  );
}
