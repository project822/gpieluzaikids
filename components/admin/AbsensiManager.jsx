'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import { CLASSES, localToday, nextSundayDate } from '@/lib/attendanceValidation';
import { SundayDateInput, Toast } from './AttendanceShared';
import ClassCards from './ClassCards';

export default function AbsensiManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Export
  const [exportDate, setExportDate] = useState(() => nextSundayDate(localToday()));
  const [exporting, setExporting] = useState(''); // '' | 'excel' | 'pdf'

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mRes = await csrfFetch('/api/members', { cache: 'no-store' });
        const mData = await mRes.json();
        if (cancelled) return;
        if (!mRes.ok) throw new Error(mData.error || 'Gagal memuat anggota');
        setMembers(mData.data || []);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const membersByClass = useMemo(() => {
    const map = {};
    CLASSES.forEach((c) => {
      map[c.value] = 0;
    });
    members.forEach((m) => {
      if (map[m.className] !== undefined) map[m.className] += 1;
    });
    return CLASSES.map((c) => ({ ...c, count: map[c.value] }));
  }, [members]);

  // ---------- Export Excel / PDF ----------
  async function handleExport(type) {
    if (!exportDate) {
      showToast('Pilih tanggal Minggu terlebih dahulu.', true);
      return;
    }
    setExporting(type);
    try {
      const res = await csrfFetch(`/api/attendance/export?type=${type}&date=${exportDate}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal membuat file export');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-kehadiran-${exportDate}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Rekap kehadiran berhasil diunduh.');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h4 className="mb-1">Absensi</h4>
        <p className="text-sm text-secondary mb-0">
          Pilih kelas untuk mengisi absensi mingguan.
        </p>
      </div>

      {error && (
        <div
          className="alert alert-warning py-2 px-3 d-flex justify-content-between align-items-center"
          role="alert"
          style={{ borderRadius: 12, fontSize: '0.9rem' }}
        >
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-eluzai-outline" onClick={refresh}>
            Muat ulang
          </button>
        </div>
      )}

      {/* ---- Toolbar export: tanggal + tombol sejajar di desktop ---- */}
      <div className="admin-card p-3 p-md-4">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label mb-1">Export Rekap Kehadiran</label>
            <SundayDateInput value={exportDate} onChange={setExportDate} />
          </div>
          <div className="col-12 col-lg-auto d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-eluzai-green"
              disabled={Boolean(exporting)}
              onClick={() => handleExport('excel')}
            >
              {exporting === 'excel' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                  Menyiapkan...
                </>
              ) : (
                <>
                  <Icon name="download" size={16} className="me-1" /> Export Excel
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-eluzai"
              disabled={Boolean(exporting)}
              onClick={() => handleExport('pdf')}
            >
              {exporting === 'pdf' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                  Menyiapkan...
                </>
              ) : (
                <>
                  <Icon name="file-text" size={16} className="me-1" /> Export PDF
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-eluzai-outline"
              title="Kembali ke Minggu terdekat"
              onClick={() => setExportDate(nextSundayDate(localToday()))}
            >
              <Icon name="calendar" size={15} className="me-1" /> Minggu terdekat
            </button>
          </div>
          <div className="col-12 col-lg text-sm text-secondary">
            Semua kelas digabung menjadi satu rekap per Minggu.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-sm text-secondary mb-0">Memuat data...</p>
        </div>
      ) : (
        <ClassCards
          classes={membersByClass}
          hrefPrefix="/admin/absensi"
          buttonLabel="Isi Absensi"
          buttonIcon="check"
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
