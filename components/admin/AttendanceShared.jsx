'use client';

import { useState } from 'react';
import Icon from '../ui/Icons';
import { formatSundayLabel } from '@/lib/attendanceValidation';

// ---------- Dibagi oleh halaman Absensi (hub) & halaman kelas ----------

// Input tanggal yang HANYA menerima Hari Minggu (toolbar export & form absensi).
export function SundayDateInput({ value, onChange, className = '', compact = false }) {
  const [error, setError] = useState('');
  const label = value ? formatSundayLabel(value) : '';
  return (
    <div>
      <input
        type="date"
        className={`form-control ${compact ? 'form-control-sm ' : ''}${className}`}
        value={value || ''}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange('');
            setError('');
            return;
          }
          const d = new Date(`${v}T00:00:00`);
          if (Number.isNaN(d.getTime()) || d.getDay() !== 0) {
            setError('Tanggal harus jatuh pada Hari Minggu.');
            return;
          }
          setError('');
          onChange(v);
        }}
      />
      {error && <div className="text-danger text-sm mt-1">{error}</div>}
      {value && !error && !compact && (
        <div className="text-sm text-secondary mt-1">{label}</div>
      )}
    </div>
  );
}

// Tombol export Excel/PDF — dipakai AbsensiManager (hub) & AttendanceClassPage
// (riwayat kelas) dengan markup yang SAMA (satu sumber, tanpa duplikasi).
// Argumen kind = { date: 'YYYY-MM-DD' } atau { month: 'YYYY-MM' };
// onExport(type, kind) disediakan pemanggil (label file & endpoint bisa beda).
export function ExportButtons({ kind, title, exporting, onExport }) {
  const key = kind?.date || kind?.month || '';
  return (
    <div className="d-flex gap-1">
      <button
        type="button"
        className="btn btn-sm btn-eluzai-green px-2 py-1"
        style={{ fontSize: '0.76rem', borderRadius: 8 }}
        title={`${title} — Excel`}
        aria-label={`${title} — unduh Excel`}
        disabled={Boolean(exporting)}
        onClick={() => onExport('excel', kind)}
      >
        {exporting === `excel-${key}` ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
        ) : (
          <Icon name="download" size={13} />
        )}
        <span className="d-none d-sm-inline ms-1">Excel</span>
      </button>
      <button
        type="button"
        className="btn btn-sm btn-eluzai px-2 py-1"
        style={{ fontSize: '0.76rem', borderRadius: 8 }}
        title={`${title} — PDF`}
        aria-label={`${title} — unduh PDF`}
        disabled={Boolean(exporting)}
        onClick={() => onExport('pdf', kind)}
      >
        {exporting === `pdf-${key}` ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
        ) : (
          <Icon name="file-text" size={13} />
        )}
        <span className="d-none d-sm-inline ms-1">PDF</span>
      </button>
    </div>
  );
}

export function hadirCount(session) {
  return (session?.entries || []).filter((e) => e.present).length;
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast-eluzai ${toast.isError ? 'error' : ''}`} role="status">
      <Icon name={toast.isError ? 'x' : 'check'} size={19} className={toast.isError ? 'text-danger' : 'text-success'} />
      {toast.msg}
    </div>
  );
}
