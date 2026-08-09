'use client';

import ResourceManager from '@/components/admin/ResourceManager';
import Icon from '@/components/ui/Icons';

const FIELDS = [
  {
    name: 'date',
    label: 'Tanggal (wajib Hari Minggu)',
    type: 'date',
    sundayOnly: true,
    required: true,
    col: 'col-md-6',
  },
  {
    name: 'ibadahAda',
    label: 'Ibadah Sekolah Minggu',
    type: 'checkbox',
    default: true,
    col: 'col-md-6',
    switchLabel: 'Ada ibadah',
  },
  {
    name: 'ibadahTime',
    label: 'Waktu Mulai Ibadah',
    type: 'text',
    col: 'col-md-6',
    placeholder: 'contoh: 09.00 WIB',
    hint: 'Hanya waktu mulai, tanpa rentang selesai.',
  },
  {
    name: 'latihanAda',
    label: 'Latihan',
    type: 'checkbox',
    default: false,
    col: 'col-md-6',
    switchLabel: 'Ada latihan',
  },
  {
    name: 'latihanTime',
    label: 'Waktu Mulai Latihan',
    type: 'text',
    col: 'col-md-6',
    placeholder: 'contoh: 13.00 WIB',
    hint: 'Hanya waktu mulai, tanpa rentang selesai.',
  },
];

const COLUMNS = [
  {
    key: 'date',
    label: 'Tanggal',
    render: (i) => {
      const d = new Date(`${i.date}T00:00:00`);
      const label = Number.isNaN(d.getTime())
        ? i.date
        : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return <span className="text-sm fw-semibold">{label}</span>;
    },
  },
  {
    key: 'ibadah',
    label: 'Ibadah Sekolah Minggu',
    render: (i) => (
      <div className="d-flex align-items-center gap-2 text-sm">
        <span className={`schedule-status ${i.ibadahAda === false ? 'no' : 'ok'}`}>
          <Icon name={i.ibadahAda === false ? 'x' : 'check'} size={14} />
        </span>
        <span>
          {i.ibadahAda === false ? 'Tidak ada' : 'Ada'}
          {i.ibadahAda !== false && i.ibadahTime && <span className="text-secondary"> · {i.ibadahTime}</span>}
        </span>
      </div>
    ),
  },
  {
    key: 'latihan',
    label: 'Latihan',
    render: (i) => (
      <div className="d-flex align-items-center gap-2 text-sm">
        <span className={`schedule-status ${i.latihanAda === true ? 'ok' : 'no'}`}>
          <Icon name={i.latihanAda === true ? 'check' : 'x'} size={14} />
        </span>
        <span>
          {i.latihanAda === true ? 'Ada' : 'Tidak ada'}
          {i.latihanAda === true && i.latihanTime && <span className="text-secondary"> · {i.latihanTime}</span>}
        </span>
      </div>
    ),
  },
];

export default function AdminJadwalPage() {
  return (
    <ResourceManager
      endpoint="/api/schedules"
      title="Kelola Jadwal"
      subtitle="Atur jadwal ibadah & latihan setiap Hari Minggu."
      addLabel="Tambah Jadwal"
      fields={FIELDS}
      columns={COLUMNS}
    />
  );
}
