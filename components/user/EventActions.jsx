'use client';

import Link from 'next/link';
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
  const hasFormLink = Boolean(item.formLink && item.formLink.trim());

  // Pendaftaran masih terbuka → tombol "Daftar".
  if (!closed) {
    // Form internal aktif → langsung daftar.
    if (item.formActive) {
      return (
        <Link href={`/registration/${item.id}`} className={`btn btn-eluzai ${cls}`}>
          Daftar <Icon name="arrow-right" size={15} className="hover-arrow" />
        </Link>
      );
    }
    // Link Google Form tersedia → arahkan ke Google Form.
    if (hasFormLink) {
      return (
        <a href={item.formLink} target="_blank" rel="noreferrer" className={`btn btn-eluzai ${cls}`}>
          Daftar <Icon name="external" size={13} className="ms-1" />
        </a>
      );
    }
    // Kedua cara tidak aktif → tampilkan "Foto Kegiatan".
    if (item.photoLink) {
      return (
        <a href={item.photoLink} target="_blank" rel="noreferrer" className={`btn btn-eluzai-green ${cls}`}>
          <Icon name="folder" size={15} className="me-1" /> Foto Kegiatan
          <Icon name="external" size={13} className="ms-1" />
        </a>
      );
    }
    return (
      <button
        type="button"
        className={`btn btn-eluzai-red ${cls}`}
        disabled
        aria-disabled="true"
        title="Link foto kegiatan belum tersedia"
      >
        <Icon name="folder" size={15} className="me-1" /> Foto Kegiatan
      </button>
    );
  }

  // Pendaftaran ditutup (H-2) → tampilkan "Foto Kegiatan".
  if (item.photoLink) {
    return (
      <a href={item.photoLink} target="_blank" rel="noreferrer" className={`btn btn-eluzai-green ${cls}`}>
        <Icon name="folder" size={15} className="me-1" /> Foto Kegiatan
        <Icon name="external" size={13} className="ms-1" />
      </a>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-eluzai-red ${cls}`}
      disabled
      aria-disabled="true"
      title="Link foto kegiatan belum tersedia"
    >
      <Icon name="folder" size={15} className="me-1" /> Foto Kegiatan
    </button>
  );
}
