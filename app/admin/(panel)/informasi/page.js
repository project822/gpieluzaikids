'use client';

import ResourceManager from '@/components/admin/ResourceManager';

const IMAGE_HINT = 'PNG/JPG/WebP · maks 4MB · rasio 16:9 landscape (dipotong otomatis)';

const FIELDS = [
  { name: 'image', label: 'Gambar Banner', type: 'file', ratio: '16:9', required: true, hint: IMAGE_HINT, col: 'col-12' },
  { name: 'title', label: 'Judul Banner', type: 'text', col: 'col-md-6', placeholder: 'contoh: Ibadah Raya Minggu' },
  { name: 'caption', label: 'Keterangan Singkat', type: 'textarea', rows: 3, col: 'col-12', placeholder: 'Teks pendamping di bawah banner (opsional)' },
];

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
];

export default function AdminInformasiPage() {
  return (
    <ResourceManager
      endpoint="/api/banners"
      title="Kelola Banner Informasi"
      subtitle="Hanya 1 banner yang tampil — PNG/JPG/WebP, rasio 16:9."
      addLabel="Unggah Banner"
      fields={FIELDS}
      columns={COLUMNS}
    />
  );
}
