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
