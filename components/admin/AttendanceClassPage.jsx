'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import {
  classLabel,
  formatDateLabel,
  formatSundayLabel,
  localToday,
  nextSundayDate,
} from '@/lib/attendanceValidation';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import { SundayDateInput, Toast, hadirCount, ExportButtons } from './AttendanceShared';

export default function AttendanceClassPage({ className, initialDate = '' }) {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]); // SEMUA sesi kelas ini (riwayat lengkap)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Export per tanggal
  const [exporting, setExporting] = useState('');

  // Form absensi (inline di halaman)
  const [formDate, setFormDate] = useState(() =>
    isValidScheduleDate(initialDate) ? initialDate : nextSundayDate(localToday())
  );
  const formDateRef = useRef(formDate);
  useEffect(() => {
    formDateRef.current = formDate;
  }, [formDate]);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Default: kedua kotak tidak dipilih (present: null).
  const buildDefaultEntries = useCallback(
    (membersList) =>
      [...membersList]
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((m) => ({ memberId: m.id, name: m.name, present: null })),
    []
  );

  // Nomor urut pemuatan tanggal — respon yang basi (datang setelah permintaan
  // tanggal baru) diabaikan agar tanggal cepat tidak tertimpa data lama.
  const loadSeq = useRef(0);

  // Pindah tanggal → preload entri yang sudah ada (jika ada).
  async function loadDateEntries(targetDate, membersList) {
    const seq = ++loadSeq.current;
    if (!targetDate) {
      if (seq === loadSeq.current) setEntries([]);
      return;
    }
    setLoadingEntries(true);
    try {
      const res = await csrfFetch(`/api/attendance?class=${className}&date=${targetDate}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data');
      if (seq !== loadSeq.current) return; // respon basi → abaikan
      const saved = data.data?.[0]?.entries || [];
      setEntries(saved.length > 0 ? saved.slice().sort((a, b) => a.name.localeCompare(b.name, 'id')) : buildDefaultEntries(membersList || members));
    } catch (err) {
      if (seq === loadSeq.current) showToast(err.message, true);
    } finally {
      if (seq === loadSeq.current) setLoadingEntries(false);
    }
  }

  // Muat daftar anggota + riwayat lengkap kelas, lalu preload entri tanggal aktif.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mRes, hRes] = await Promise.all([
          csrfFetch(`/api/members?class=${className}`, { cache: 'no-store' }),
          // all=1 → riwayat TANPA batas waktu 1 bulan (data lama tetap aman di database).
          csrfFetch(`/api/attendance?class=${className}&all=1`, { cache: 'no-store' }),
        ]);
        const mData = await mRes.json();
        const hData = await hRes.json();
        if (cancelled) return;
        if (!mRes.ok) throw new Error(mData.error || 'Gagal memuat anggota');
        if (!hRes.ok) throw new Error(hData.error || 'Gagal memuat riwayat');
        const list = mData.data || [];
        setMembers(list);
        setHistory(hData.data || []);
        await loadDateEntries(formDateRef.current, list);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, reloadKey]);

  // ?date= baru saat navigasi antar-halaman yang sama: sinkronkan tanggal
  // form tanpa menunggu remount.
  useEffect(() => {
    if (isValidScheduleDate(initialDate) && initialDate !== formDateRef.current) {
      setFormDate(initialDate);
      loadDateEntries(initialDate, members);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  function handleDateChange(v) {
    setFormDate(v);
    loadDateEntries(v, members);
  }

  // Pilih 1 dari 2 kotak; klik kotak yang sama lagi → batalkan (kembali ke
  // keadaan belum dipilih).
  const setStatus = (idx, value) =>
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === idx ? { ...entry, present: entry.present === value ? null : value } : entry
      )
    );

  const setAll = (value) =>
    setEntries((prev) => prev.map((entry) => ({ ...entry, present: value })));

  async function saveAttendance(e) {
    e.preventDefault();
    if (!formDate) {
      showToast('Pilih tanggal (Hari Minggu) terlebih dahulu.', true);
      return;
    }
    if (!entries.length) {
      showToast('Kelas belum punya anggota — tambahkan anggota di menu Anggota.', true);
      return;
    }
    setSaving(true);
    try {
      const res = await csrfFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, date: formDate, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan absensi');
      showToast(`Absensi ${classLabel(className)} tersimpan.`);
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  // ---------- Export rekap satu tanggal (kelas ini saja) ----------
  async function downloadExport(type, date) {
    const key = `${type}-${date}`;
    setExporting(key);
    try {
      const res = await csrfFetch(
        `/api/attendance/export?type=${type}&date=${date}&class=${encodeURIComponent(className)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal membuat file export');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap Kehadiran ${classLabel(className)} ${formatDateLabel(date)}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Rekap kehadiran berhasil diunduh.');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setExporting('');
    }
  }

  // ---------- Riwayat kelas ini ----------
  async function removeSession(session) {
    if (!window.confirm(`Hapus absensi ${formatSundayLabel(session.date)}?`)) return;
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

  function editSession(session) {
    setFormDate(session.date);
    loadDateEntries(session.date, members);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const hadirNow = entries.filter((en) => en.present === true).length;
  const belumNow = entries.filter((en) => en.present === null).length;

  // Riwayat per tanggal (terbaru dulu) — setiap tanggal berisi list kehadiran.
  const sortedHistory = [...history].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header kelas */}
      <div className="d-flex flex-wrap align-items-center gap-3">
        <Link
          href="/admin/absensi"
          className="icon-btn"
          aria-label="Kembali ke Absensi"
          title="Kembali ke Absensi"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <span className={`class-avatar ${className}`}>{classLabel(className).slice(0, 1)}</span>
        <div>
          <h4 className="mb-0">{classLabel(className)}</h4>
          <p className="text-sm text-secondary mb-0">Isi absensi mingguan kelas ini.</p>
        </div>
        <span className="badge-soft badge-ink ms-auto">{members.length} anggota</span>
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

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-sm text-secondary mb-0">Memuat data...</p>
        </div>
      ) : (
        <>
          {/* ---- Form absensi (inline) ---- */}
          <form className="admin-card p-3 p-md-4" onSubmit={saveAttendance}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <h6 className="mb-0">Form Absensi Mingguan</h6>
              <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
                Hijau = Hadir · Merah = Tidak hadir
              </span>
            </div>

            <div className="row g-3 align-items-end mb-3">
              <div className="col-md-6">
                <label className="form-label">
                  Tanggal Ibadah (Hari Minggu) <span className="text-danger">*</span>
                </label>
                <SundayDateInput value={formDate} onChange={handleDateChange} compact />
              </div>
              <div className="col-md-6 d-flex gap-2 pb-1">
                <button
                  type="button"
                  className="btn btn-eluzai-outline btn-sm flex-grow-1"
                  onClick={() => setAll(true)}
                >
                  <Icon name="check" size={14} className="me-1" /> Semua Hadir
                </button>
                <button
                  type="button"
                  className="btn btn-eluzai-outline btn-sm flex-grow-1"
                  onClick={() => setAll(false)}
                >
                  <Icon name="x" size={14} className="me-1" /> Semua Tidak Hadir
                </button>
              </div>
            </div>

            {loadingEntries ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-5 border rounded-3" style={{ borderStyle: 'dashed' }}>
                <p className="text-sm text-secondary mb-2">
                  Kelas ini belum punya anggota untuk dicatat.
                </p>
                <Link href={`/admin/anggota/${className}`} className="btn btn-sm btn-eluzai">
                  <Icon name="users" size={14} className="me-1" /> Tambah Anggota
                </Link>
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center px-2 py-2 mb-1">
                  <span className="text-sm text-secondary">
                    Pilih <strong>Hadir</strong> (hijau) atau <strong>Tidak Hadir</strong> (merah)
                  </span>
                  <span className="text-sm fw-semibold">
                    <span className="text-success">{hadirNow}</span>
                    <span className="text-secondary"> hadir</span>
                    {belumNow > 0 && (
                      <>
                        <span className="text-secondary"> · </span>
                        <span>{belumNow} belum</span>
                      </>
                    )}
                  </span>
                </div>
                <ul className="attendance-form-list">
                  {entries.map((entry, idx) => (
                    <li key={entry.memberId || idx}>
                      <span className="text-truncate fw-medium">{entry.name}</span>
                      <span className="att-options">
                        <button
                          type="button"
                          className={`att-opt hadir ${entry.present === true ? 'on' : ''}`}
                          onClick={() => setStatus(idx, true)}
                          aria-pressed={entry.present === true}
                        >
                          <Icon name="check" size={13} /> Hadir
                        </button>
                        <button
                          type="button"
                          className={`att-opt tidak ${entry.present === false ? 'on' : ''}`}
                          onClick={() => setStatus(idx, false)}
                          aria-pressed={entry.present === false}
                        >
                          <Icon name="x" size={13} /> Tidak
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button
                    type="submit"
                    className="btn btn-eluzai-green"
                    disabled={saving || loadingEntries || entries.length === 0}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={16} className="me-1" /> Simpan Absensi
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* ---- Riwayat kelas ini — per tanggal (seluruh riwayat, tanpa batas 1 bulan) ---- */}
          <div className="admin-card p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h6 className="mb-0">Riwayat Absensi Kelas Ini</h6>
              <span className="badge-soft badge-ink">{sortedHistory.length} Minggu</span>
            </div>
            {sortedHistory.length === 0 ? (
              <div className="text-center py-4">
                <Icon name="clock" size={28} className="text-secondary opacity-50 mb-2" />
                <p className="text-sm text-secondary mb-0">
                  Belum ada absensi {classLabel(className)} yang diisi.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {sortedHistory.map((s) => {
                  const total = (s.entries || []).length;
                  const hadir = hadirCount(s);
                  const exportLabel = `Rekap Kehadiran ${classLabel(className)} — ${formatSundayLabel(s.date)}`;
                  return (
                    <div
                      key={s.id}
                      className="border rounded-3 p-3"
                      style={{ background: 'var(--eluzai-bg)', borderColor: 'var(--eluzai-border)' }}
                    >
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <Icon name="calendar" size={16} className="text-primary" />
                        <span className="fw-semibold text-dark">{formatSundayLabel(s.date)}</span>
                        <span className="text-sm text-secondary">
                          {hadir} hadir / {total} anak
                        </span>
                        <div className="ms-auto d-flex gap-1">
                          <ExportButtons
                            kind={{ date: s.date }}
                            title={exportLabel}
                            exporting={exporting}
                            onExport={(type) => downloadExport(type, s.date)}
                          />
                          <button
                            className="icon-btn"
                            onClick={() => editSession(s)}
                            aria-label="Ubah absensi"
                            title="Ubah absensi"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => removeSession(s)}
                            aria-label="Hapus absensi"
                            title="Hapus absensi"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </div>

                      {total === 0 ? (
                        <p className="text-sm text-secondary mb-0">Belum ada catatan anak.</p>
                      ) : (
                        <div className="d-flex flex-column gap-1">
                          {(s.entries || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'id')).map((e, i) => (
                            <div
                              key={i}
                              className="d-flex align-items-center justify-content-between gap-2 px-3 py-1"
                              style={{
                                background: 'var(--eluzai-surface)',
                                border: '1px solid var(--eluzai-border)',
                                borderRadius: 8,
                              }}
                            >
                              <span className="text-sm fw-medium">{e.name}</span>
                              <span
                                className={`badge-soft ${
                                  e.present === true ? 'badge-green' : e.present === false ? 'badge-rose' : 'badge-ink'
                                }`}
                              >
                                {e.present === true ? 'Hadir' : e.present === false ? 'Tidak' : 'Belum'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}
