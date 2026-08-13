'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import {
  CLASSES,
  classLabel,
  formatDateLabel,
  formatMonthLabel,
  formatSundayLabel,
  localToday,
  nextSundayDate,
} from '@/lib/attendanceValidation';
import { SundayDateInput, Toast, hadirCount, ExportButtons } from './AttendanceShared';
import ClassCards from './ClassCards';

const classOrder = (value) => CLASSES.findIndex((c) => c.value === value);

export default function AbsensiManager() {
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]); // SEMUA sesi (riwayat lengkap)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Export
  const [exportDate, setExportDate] = useState(() => nextSundayDate(localToday()));
  const [exportMonth, setExportMonth] = useState(() => localToday().slice(0, 7));
  const [exporting, setExporting] = useState(''); // kunci tombol yang sedang jalan

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          csrfFetch('/api/members', { cache: 'no-store' }),
          csrfFetch('/api/attendance?all=1', { cache: 'no-store' }),
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        if (cancelled) return;
        if (!mRes.ok) throw new Error(mData.error || 'Gagal memuat anggota');
        if (!sRes.ok) throw new Error(sData.error || 'Gagal memuat riwayat absensi');
        setMembers(mData.data || []);
        setSessions(sData.data || []);
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

  // Kelompokkan sesi: Bulan → Tanggal (terbaru dulu) → daftar kelas.
  const groups = useMemo(() => {
    const monthsMap = new Map();
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sorted) {
      const mk = String(s.date || '').slice(0, 7);
      let m = monthsMap.get(mk);
      if (!m) {
        m = { monthKey: mk, dates: new Map() };
        monthsMap.set(mk, m);
      }
      let d = m.dates.get(s.date);
      if (!d) {
        d = { date: s.date, sessions: [] };
        m.dates.set(s.date, d);
      }
      d.sessions.push(s);
    }
    for (const m of monthsMap.values()) {
      for (const d of m.dates.values()) {
        d.sessions.sort((a, b) => classOrder(a.className) - classOrder(b.className));
      }
      m.dates = [...m.dates.values()];
    }
    return [...monthsMap.values()];
  }, [sessions]);

  // ---------- Export Excel / PDF (per tanggal atau per bulan) ----------
  async function downloadExport(type, { date = '', month = '' }, label) {
    if (!date && !month) {
      showToast('Pilih tanggal atau bulan terlebih dahulu.', true);
      return;
    }
    const query = date ? `date=${date}` : `month=${month}`;
    const key = `${type}-${date || month}`;
    setExporting(key);
    try {
      const res = await csrfFetch(`/api/attendance/export?type=${type}&${query}`, {
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
      a.download = `Rekap Kehadiran ${label}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
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

  // ---------- Hapus satu sesi (langsung update database) ----------
  async function removeSession(session) {
    if (
      !window.confirm(
        `Hapus absensi ${formatSundayLabel(session.date)} — kelas ${classLabel(session.className)}? Tindakan tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    try {
      const res = await csrfFetch(`/api/attendance/${session.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus absensi');
      showToast('Absensi dihapus — database diperbarui.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h4 className="mb-1">Absensi</h4>
        <p className="text-sm text-secondary mb-0">Pilih kelas untuk mengisi absensi mingguan.</p>
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

      {/* ---- Toolbar export: per Minggu & per Bulan (tombol sejajar dengan input) ---- */}
      <div className="admin-card p-3 p-md-4 d-flex flex-column gap-4">
        <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-end">
          <div className="d-flex flex-column gap-1" style={{ width: 'min(100%, 240px)' }}>
            <label className="form-label mb-0">Export Rekap Mingguan</label>
            <SundayDateInput value={exportDate} onChange={setExportDate} compact />
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-eluzai-green"
              style={{ minWidth: 150 }}
              disabled={Boolean(exporting)}
              onClick={() => downloadExport('excel', { date: exportDate }, formatDateLabel(exportDate))}
            >
              {exporting === `excel-${exportDate}` ? (
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
              style={{ minWidth: 150 }}
              disabled={Boolean(exporting)}
              onClick={() => downloadExport('pdf', { date: exportDate }, formatDateLabel(exportDate))}
            >
              {exporting === `pdf-${exportDate}` ? (
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
        </div>

        <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-end">
          <div className="d-flex flex-column gap-1" style={{ width: 'min(100%, 240px)' }}>
            <label className="form-label mb-0">Export Rekap Bulanan</label>
            <input
              type="month"
              className="form-control"
              value={exportMonth || ''}
              onChange={(e) => setExportMonth(e.target.value)}
            />
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-eluzai-green"
              style={{ minWidth: 150 }}
              disabled={Boolean(exporting)}
              onClick={() => downloadExport('excel', { month: exportMonth }, formatMonthLabel(exportMonth))}
            >
              {exporting === `excel-${exportMonth}` ? (
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
              style={{ minWidth: 150 }}
              disabled={Boolean(exporting)}
              onClick={() => downloadExport('pdf', { month: exportMonth }, formatMonthLabel(exportMonth))}
            >
              {exporting === `pdf-${exportMonth}` ? (
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
              title="Kembali ke bulan berjalan"
              onClick={() => setExportMonth(localToday().slice(0, 7))}
            >
              <Icon name="calendar" size={15} className="me-1" /> Bulan ini
            </button>
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
          <ClassCards
            classes={membersByClass}
            hrefPrefix="/admin/absensi"
            buttonLabel="Isi Absensi"
            buttonIcon="check"
          />

          {/* ---- Riwayat Absensi: dikelompokkan per bulan & tanggal ---- */}
          <div className="admin-card p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h6 className="mb-0">Riwayat Absensi</h6>
              <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
                Ubah/hapus langsung memperbarui database.
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-4">
                <Icon name="clock" size={28} className="text-secondary opacity-50 mb-2" />
                <p className="text-sm text-secondary mb-0">Belum ada absensi yang diisi.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-4">
                {groups.map((m) => (
                  <div key={m.monthKey}>
                    {/* Header bulan + export bulanan */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                        {formatMonthLabel(m.monthKey)}
                      </span>
                      <span className="badge-soft badge-ink">
                        {m.dates.length} Minggu
                      </span>
                      <div className="ms-auto">
                        <ExportButtons
                          kind={{ month: m.monthKey }}
                          title={`Rekap Kehadiran ${formatMonthLabel(m.monthKey)}`}
                          exporting={exporting}
                          onExport={(type, k) => downloadExport(type, k, formatMonthLabel(m.monthKey))}
                        />
                      </div>
                    </div>

                    {/* Grup per tanggal */}
                    <div className="d-flex flex-column gap-3">
                      {m.dates.map((d) => {
                        const totalSessions = d.sessions.length;
                        const totalEntries = d.sessions.reduce((n, s) => n + (s.entries || []).length, 0);
                        const totalHadir = d.sessions.reduce((n, s) => n + hadirCount(s), 0);
                        return (
                          <div
                            key={d.date}
                            className="border rounded-3 p-3"
                            style={{ background: 'var(--eluzai-bg)', borderColor: 'var(--eluzai-border)' }}
                          >
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <Icon name="calendar" size={16} className="text-primary" />
                              <span className="fw-semibold text-dark">{formatSundayLabel(d.date)}</span>
                              <span className="text-sm text-secondary">
                                {totalHadir} hadir / {totalEntries} anak
                              </span>
                              <div className="ms-auto">
                                <ExportButtons
                                  kind={{ date: d.date }}
                                  title={`Rekap Kehadiran ${formatSundayLabel(d.date)}`}
                                  exporting={exporting}
                                  onExport={(type, k) => downloadExport(type, k, formatDateLabel(d.date))}
                                />
                              </div>
                            </div>

                            {totalSessions === 0 ? (
                              <p className="text-sm text-secondary mb-0">Belum ada kelas terisi.</p>
                            ) : (
                              <div className="table-responsive">
                                <table className="table admin-table align-middle mb-0">
                                  <thead>
                                    <tr>
                                      <th>Kelas</th>
                                      <th>Kehadiran</th>
                                      <th className="text-end">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.sessions.map((s) => {
                                      const total = (s.entries || []).length;
                                      const hadir = hadirCount(s);
                                      return (
                                        <tr key={s.id}>
                                          <td>
                                            <span className="fw-semibold text-dark">{classLabel(s.className)}</span>
                                          </td>
                                          <td>
                                            <div className="d-flex align-items-center gap-2">
                                              <div className="attendance-bar flex-grow-1" style={{ maxWidth: 140 }}>
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
                                                href={`/admin/absensi/${s.className}?date=${s.date}`}
                                                className="icon-btn"
                                                aria-label={`Ubah absensi ${classLabel(s.className)}`}
                                                title="Ubah absensi"
                                              >
                                                <Icon name="edit" size={16} />
                                              </Link>
                                              <button
                                                className="icon-btn danger"
                                                onClick={() => removeSession(s)}
                                                aria-label={`Hapus absensi ${classLabel(s.className)}`}
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
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
