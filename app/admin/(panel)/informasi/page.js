'use client';

import ResourceManager from '@/components/admin/ResourceManager';
import VerseManager from '@/components/admin/VerseManager';

const IMAGE_HINT = 'PNG/JPG/WebP · maks 4MB · rasio 16:9 landscape (dipotong otomatis)';

const FIELDS = [
  { name: 'image', label: 'Gambar Banner', type: 'file', ratio: '16:9', required: true, hint: IMAGE_HINT, col: 'col-12' },
  { name: 'title', label: 'Judul Banner', type: 'text', col: 'col-md-6', placeholder: 'contoh: Ibadah Raya Minggu' },
  { name: 'caption', label: 'Keterangan Singkat', type: 'textarea', rows: 3, col: 'col-12', placeholder: 'Teks pendamping di bawah banner (opsional)' },
  {
    name: 'link',
    label: 'Tautan Banner (opsional)',
    type: 'text',
    col: 'col-md-6',
    placeholder: 'contoh: /event/evt-kkr atau https://...',
  },
];

const LINK_HINT =
  'Isi untuk membuat banner dapat diklik (arahkan ke halaman event /event/... atau situs eksternal https://...). Kosongkan bila banner hanya tampil.';

const COLUMNS = [
  {
    key: 'image',
    label: 'Banner',
    render: (i) => (
      <div className="d-flex align-items-center gap-3">
        <div className="admin-thumb admin-thumb-wide" style={{ aspectRatio: '16 / 9' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.image} alt="" />
        </div>
        <div>
          <div className="fw-semibold text-dark">{i.title || '(Tanpa judul)'}</div>
          {i.caption && <div className="text-sm text-secondary" style={{ maxWidth: 260 }}>{i.caption}</div>}
        </div>
      </div>
    ),
  },
  {
    key: 'link',
    label: 'Tautan',
    render: (i) =>
      i.link ? (
        <span className="badge-soft badge-blue" title={i.link}>Bisa diklik</span>
      ) : (
        <span className="text-sm text-secondary">—</span>
      ),
  },
];

export default function AdminInformasiPage() {
  return (
    <div className="d-flex flex-column gap-4">
      <ResourceManager
        endpoint="/api/banners"
        title="Kelola Banner Informasi"
        subtitle={`Hanya 1 banner yang tampil — PNG/JPG/WebP, rasio 16:9. ${LINK_HINT}`}
        addLabel="Unggah Banner"
        fields={FIELDS}
        columns={COLUMNS}
      />
      <VerseManager />
    </div>
  );
}
