'use client';

import { useMemo, useState } from 'react';
import EventCard from './EventCard';
import Icon from '@/components/ui/Icons';

const PER_PAGE = 9;

const MONTHS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export default function EventArchive({ events }) {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const set = new Set(events.map((e) => (e.date || '').slice(0, 4)).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [events]);

  // Urut: mendatang dulu (terdekat), lalu lampau (terbaru).
  const sorted = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events].sort((a, b) => {
      const aUp = a.date >= today;
      const bUp = b.date >= today;
      if (aUp !== bUp) return aUp ? -1 : 1;
      return aUp ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((e) => {
      if (year && (e.date || '').slice(0, 4) !== year) return false;
      if (month && (e.date || '').slice(5, 7) !== month) return false;
      if (q) {
        const hay = `${e.title} ${e.theme || ''} ${e.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, query, year, month]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const resetPage = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Filter & pencarian */}
      <div className="row g-3">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="position-relative">
            <Icon name="sparkle" size={16} className="text-secondary position-absolute" style={{ left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
            <input
              type="search"
              className="form-control ps-5"
              placeholder="Cari nama event, tema, lokasi..."
              value={query}
              onChange={(e) => resetPage(setQuery)(e.target.value)}
              aria-label="Cari event"
            />
          </div>
        </div>
        <div className="col-6 col-md-3 col-lg-2">
          <select className="form-select" value={year} onChange={(e) => resetPage(setYear)(e.target.value)} aria-label="Filter tahun">
            <option value="">Semua Tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3 col-lg-2">
          <select className="form-select" value={month} onChange={(e) => resetPage(setMonth)(e.target.value)} aria-label="Filter bulan">
            <option value="">Semua Bulan</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-auto d-flex align-items-center">
          <span className="badge-soft badge-ink">{filtered.length} event</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-5">
          <Icon name="calendar" size={40} className="text-secondary opacity-50 mb-3" />
          <p className="text-secondary mb-0">Tidak ada event yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className="row g-4">
          {pageItems.map((e) => (
            <div className="col-md-6 col-lg-4" key={e.id}>
              <EventCard item={e} />
            </div>
          ))}
        </div>
      )}

      {/* Paginasi */}
      {totalPages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-2" aria-label="Paginasi event">
          <button
            type="button"
            className="btn btn-eluzai-outline btn-sm px-3"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Icon name="chevron-left" size={15} /> Sebelumnya
          </button>
          <span className="text-sm text-secondary px-2">
            Halaman {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-eluzai-outline btn-sm px-3"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya <Icon name="chevron-right" size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
