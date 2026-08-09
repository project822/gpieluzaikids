'use client';

import Icon from '../ui/Icons';

// Pendaftaran ditutup otomatis pada H-2 (2 hari sebelum hari-H).
export function isRegistrationClosed(dateStr) {
  if (!dateStr) return true;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diffDays <= 2;
}

export default function EventActions({ item, large = false, block = false }) {
  const closed = isRegistrationClosed(item.date);
  const cls = `${large ? 'btn-lg' : 'btn-sm px-3'} ${block ? 'w-100' : ''}`;

  // Pendaftaran masih terbuka → tombol "Daftar" (Google Form).
  if (!closed) {
    if (!item.formLink) {
      return (
        <span
          className={`btn btn-eluzai-outline ${cls}`}
          // Tanpa class .disabled Bootstrap (yang memakai pointer-events:none,
          // membuat kursor tidak sempat tampil) — span tidak interaktif,
          // kursor not-allowed benar-benar terlihat.
          style={{ cursor: 'not-allowed', opacity: 0.65 }}
          title="Tautan pendaftaran belum tersedia"
        >
          Pendaftaran Segera
        </span>
      );
    }
    return (
      <a href={item.formLink} target="_blank" rel="noreferrer" className={`btn btn-eluzai ${cls}`}>
        Daftar <Icon name="arrow-right" size={15} className="hover-arrow" />
      </a>
    );
  }

  // Pendaftaran ditutup (H-2) → butuh link foto Google Drive terlebih dahulu.
  if (item.photoLink) {
    return (
      <a href={item.photoLink} target="_blank" rel="noreferrer" className={`btn btn-eluzai-green ${cls}`}>
        <Icon name="folder" size={15} className="me-1" /> Foto Kegiatan
        <Icon name="external" size={13} className="ms-1" />
      </a>
    );
  }

  // Belum ada link foto → tombol terkunci (kursor terblokir) sampai admin
  // mengisi link Google Drive.
  return (
    <span
      className={`btn btn-eluzai-outline ${cls}`}
      style={{ cursor: 'not-allowed', opacity: 0.65 }}
      title="Pendaftaran telah ditutup — link foto belum tersedia"
    >
      Pendaftaran Ditutup
    </span>
  );
}
