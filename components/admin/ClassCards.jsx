import Link from 'next/link';
import Icon from '../ui/Icons';

// Kartu 4 kelas (Baby, Samuel, Yosua, Musa) — dipakai halaman Absensi &
// Anggota. Setiap kartu menaut ke halaman kelas sesuai prefix masing-masing.
export default function ClassCards({ classes, hrefPrefix, buttonLabel, buttonIcon = 'check' }) {
  return (
    <div className="row g-3">
      {classes.map((c) => (
        <div key={c.value} className="col-md-6 col-xxl-3">
          <Link
            href={`${hrefPrefix}/${c.value}`}
            className="class-card h-100 d-flex flex-column text-decoration-none"
          >
            <div className="d-flex align-items-center gap-3 p-3 pb-2">
              <span className={`class-avatar ${c.value}`}>{c.label.slice(0, 1)}</span>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-bold text-dark">{c.label}</div>
                <div className="text-sm text-secondary">{c.count} anggota</div>
              </div>
              <Icon name="chevron-right" size={18} className="text-secondary" />
            </div>
            <div className="flex-grow-1 px-3 pb-3 d-flex align-items-end">
              <span className="btn btn-eluzai btn-sm w-100">
                <Icon name={buttonIcon} size={15} className="me-1" /> {buttonLabel}
              </span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
