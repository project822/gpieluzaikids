'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import {
  CLASSES,
  classLabel,
  formatSundayLabel,
  localToday,
  nextSundayDate,
} from '@/lib/attendanceValidation';
import { SundayDateInput, Toast, hadirCount } from './AttendanceShared';

export default function AbsensiManager() {
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
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
        const [mRes, aRes] = await Promise.all([
          csrfFetch('/api/members', { cache: 'no-store' }),
          csrfFetch('/api/attendance', { cache: 'no-store' }),
        ]);
        const mData = await mRes.json();
        const aData = await aRes.json();
        if (cancelled) return;
        if (!mRes.ok) throw new Error(mData.error || 'Gagal memuat anggota');
        if (!aRes.ok) throw new Error(aData.error || 'Gagal memuat absensi');
        setMembers(mData.data || []);
        setSessions(aData.data || []);
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

  async function removeAttendance(session) {
    if (
      !window.confirm(
        `Hapus absensi ${classLabel(session.className)} — ${formatSundayLabel(session.date)}?`
      )
    ) {
      return;
    }
    try {
      const res = await csrfFetch(`/api/attendance/${session.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus absensi');
      showToast('Absensi dihapus.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    }
  }

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
      showToast(
        `Rekap minggu ${formatSundayLabel(exportDate)} diunduh (${type === 'excel' ? 'Excel' : 'PDF'}).`
      );
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
          Pilih kelas untuk mengelola anggota & mengisi absensi mingguan. Export menggabungkan
          semua kelas menjadi satu rekap per Minggu.
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

      {/* ---- Toolbar export ---- */}
      <div className="admin-card p-3 p-md-4">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div style={{ minWidth: 220 }}>
            <label className="form-label mb-1">Export Rekap Kehadiran</label>
            <SundayDateInput value={exportDate} onChange={setExportDate} />
          </div>
          <div className="d-flex flex-wrap gap-2 pb-1">
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
              className="btn btn-eluzai-outline btn-sm align-self-center"
              title="Kembali ke Minggu terdekat"
              onClick={() => setExportDate(nextSundayDate(localToday()))}
            >
              <Icon name="calendar" size={15} className="me-1" /> Minggu terdekat
            </button>
          </div>
          <div className="text-sm text-secondary ms-auto pb-1" style={{ maxWidth: 340 }}>
            Judul file: <strong>Rekap Kehadiran Minggu, {'#tanggal'}</strong> — semua kelas
            digabung jadi satu. Minggu lama tetap bisa diexport kapan saja.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-sm text-secondary mb-0">Memuat data...</p>
        </div>
      ) : (
        <>
          {/* ---- Kartu 4 kelas → halaman kelas masing-masing ---- */}
          <div className="row g-3">
            {membersByClass.map((c) => (
              <div key={c.value} className="col-md-6 col-xxl-3">
                <Link
                  href={`/admin/${c.value}`}
                  className="class-card h-100 d-flex flex-column text-decoration-none"
                >
                  <div className="d-flex align-items-center gap-3 p-3 pb-2">
                    <span className={`class-avatar ${c.value}`}>{c.label.slice(0, 1)}</span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-bold text-dark">{c.label}</div>
                      <div className="text-sm text-secondary">{c.count} anggota</div>
                    </div>
                    <Icon name="chevron-right" size={18} className="text-secondary" />
                  </div>

                  <div className="flex-grow-1 px-3 pb-3 d-flex align-items-end">
                    <span className="btn btn-eluzai btn-sm w-100">
                      <Icon name="check" size={15} className="me-1" /> Kelola & Absensi
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* ---- Riwayat absensi (5 hari terakhir, semua kelas) ---- */}
          <div className="admin-card p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <h6 className="mb-0">Riwayat Absensi</h6>
              <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
                Menampilkan 5 hari terakhir — data lama tetap aman di database
              </span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-4">
                <Icon name="users" size={30} className="text-secondary opacity-50 mb-2" />
                <p className="text-sm text-secondary mb-0">
                  Belum ada absensi yang diisi. Buka salah satu kelas untuk mulai mengisi.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table admin-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kelas</th>
                      <th>Kehadiran</th>
                      <th className="text-end">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const total = (s.entries || []).length;
                      const hadir = hadirCount(s);
                      return (
                        <tr key={s.id}>
                          <td>
                            <span className="text-sm fw-semibold text-dark">
                              {formatSundayLabel(s.date)}
                            </span>
                          </td>
                          <td>
                            <span className="badge-soft badge-blue">{classLabel(s.className)}</span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="attendance-bar flex-grow-1" style={{ maxWidth: 200 }}>
                                <div
                                  className="attendance-bar-fill"
                                  style={{ width: `${total ? (hadir / total) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-sm text-secondary">
                                <span className="text-success fw-semibold">{hadir}</span> / {total} hadir
                              </span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <Link
                                className="icon-btn"
                                href={`/admin/${s.className}?date=${s.date}`}
                                aria-label="Ubah absensi"
                                title="Ubah absensi"
                              >
                                <Icon name="edit" size={16} />
                              </Link>
                              <button
                                className="icon-btn danger"
                                onClick={() => removeAttendance(s)}
                                aria-label="Hapus absensi"
                                title="Hapus absensi"
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
