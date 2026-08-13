'use client';

import ResourceManager from '@/components/admin/ResourceManager';
import Icon from '@/components/ui/Icons';

const IMAGE_HINT = 'PNG/JPG/WebP · maks 4MB · rasio 4:5 (dipotong otomatis)';

const FIELDS = [
  { name: 'title', label: 'Nama Event', type: 'text', required: true, col: 'col-md-8', placeholder: 'contoh: Ibadah Raya Kebangunan Rohani' },
  { name: 'theme', label: 'Tema', type: 'text', required: true, col: 'col-md-4', placeholder: 'contoh: Mengalami Kuasa Kebangkitan' },
  { name: 'image', label: 'Foto Event', type: 'file', ratio: '4:5', required: true, hint: IMAGE_HINT, col: 'col-12' },
  { name: 'date', label: 'Tanggal (hari-H)', type: 'date', required: true, col: 'col-md-4' },
  { name: 'openGate', label: 'Open Gate', type: 'text', required: true, col: 'col-md-4', placeholder: 'contoh: 07.30 WIB' },
  { name: 'time', label: 'Waktu Mulai', type: 'text', required: true, col: 'col-md-4', placeholder: 'contoh: 09.00 WIB' },
  { name: 'location', label: 'Lokasi / Tempat', type: 'text', required: true, col: 'col-md-8', placeholder: 'contoh: Gedung GPI Eluzai, Surabaya' },
  { name: 'mapsLink', label: 'Link Google Maps (detail)', type: 'url', required: true, col: 'col-md-8', placeholder: 'https://www.google.com/maps/search/?api=1&query=...' },
  { name: 'formLink', label: 'Link Google Form (pendaftaran)', type: 'url', required: true, col: 'col-md-8', placeholder: 'https://forms.gle/...' },
];

// Tampil/sembunyikan event dari halaman publik (retensi manual — data tidak dihapus).
const TOGGLE_ACTIVE = {
  name: 'active',
  showTitle: 'Tampilkan ke publik',
  hideTitle: 'Sembunyikan dari publik',
  showAriaLabel: 'Tampilkan event ke publik (saat ini tersembunyi)',
  hideAriaLabel: 'Sembunyikan event dari publik (saat ini tampil)',
  onLabel: 'Event ditampilkan di publik.',
  offLabel: 'Event disembunyikan dari publik.',
};

// Link Google Drive (foto kegiatan) dikelola TERPISAH dari form tambah event.
const QUICK_EDIT = {
  field: 'photoLink',
  icon: 'link',
  ariaLabel: 'Atur link foto Google Drive',
  modalTitle: 'Link Foto Kegiatan',
  label: 'Link Google Drive (foto kegiatan)',
  placeholder: 'https://drive.google.com/drive/folders/...',
  hint: 'Diisi setelah acara berlangsung — tombol pendaftaran publik berubah menjadi "Foto".',
};

const COLUMNS = [
  {
    key: 'title',
    label: 'Event',
    render: (i) => (
      <div className="d-flex align-items-center gap-3">
        <div className="admin-thumb" style={{ aspectRatio: '4 / 5' }}>
          {i.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.image} alt="" />
          ) : (
            <Icon name="cross" size={18} />
          )}
        </div>
        <div>
          <div className="fw-semibold text-dark">{i.title}</div>
          {i.theme && <span className="badge-soft badge-blue">{i.theme}</span>}
        </div>
      </div>
    ),
  },
  {
    key: 'date',
    label: 'Tanggal',
    render: (i) => <span className="text-sm text-nowrap fw-medium text-dark">{i.date}</span>,
  },
  {
    key: 'openGate',
    label: 'Open Gate',
    render: (i) => (
      <span className="text-sm text-nowrap">
        <span className="badge-soft badge-blue">{i.openGate || '–'}</span>
      </span>
    ),
  },
  {
    key: 'time',
    label: 'Waktu',
    render: (i) => <span className="text-sm text-nowrap">{i.time || '–'}</span>,
  },
  { key: 'location', label: 'Lokasi', render: (i) => <span className="text-sm">{i.location || '–'}</span> },
  {
    key: 'links',
    label: 'Tautan',
    render: (i) => (
      <div className="d-flex flex-column gap-1 text-sm">
        {i.formLink ? (
          <a href={i.formLink} target="_blank" rel="noreferrer" className="text-decoration-none d-inline-flex align-items-center gap-1">
            Form <Icon name="external" size={12} />
          </a>
        ) : (
          <span className="text-secondary">–</span>
        )}
        {i.photoLink && (
          <a href={i.photoLink} target="_blank" rel="noreferrer" className="text-decoration-none d-inline-flex align-items-center gap-1">
            Foto <Icon name="external" size={12} />
          </a>
        )}
      </div>
    ),
  },
  {
    key: 'active',
    label: 'Status',
    render: (i) => (
      <span className={`badge-soft ${i.active === false ? 'badge-rose' : 'badge-green'}`}>
        {i.active === false ? 'Tersembunyi' : 'Tampil'}
      </span>
    ),
  },
];

export default function AdminEventsPage() {
  return (
    <ResourceManager
      endpoint="/api/events"
      title="Kelola Event"
      subtitle="Atur event jemaat — semua field wajib diisi."
      addLabel="Tambah Event"
      fields={FIELDS}
      columns={COLUMNS}
      quickEdit={QUICK_EDIT}
      toggleActiveField={TOGGLE_ACTIVE}
    />
  );
}
