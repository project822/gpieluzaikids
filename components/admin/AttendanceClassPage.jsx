'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import {
  classLabel,
  formatSundayLabel,
  localToday,
  nextSundayDate,
} from '@/lib/attendanceValidation';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import { SundayDateInput, Toast, hadirCount } from './AttendanceShared';

export default function AttendanceClassPage({ className, initialDate = '' }) {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]); // sesi kelas ini (5 hari terakhir)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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
    (membersList) => membersList.map((m) => ({ memberId: m.id, name: m.name, present: null })),
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
      setEntries(data.data?.[0]?.entries || buildDefaultEntries(membersList || members));
    } catch (err) {
      if (seq === loadSeq.current) showToast(err.message, true);
    } finally {
      if (seq === loadSeq.current) setLoadingEntries(false);
    }
  }

  // Muat daftar anggota + riwayat kelas, lalu preload entri tanggal aktif.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mRes, hRes] = await Promise.all([
          csrfFetch(`/api/members?class=${className}`, { cache: 'no-store' }),
          csrfFetch(`/api/attendance?class=${className}`, { cache: 'no-store' }),
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
                hijau = hadir · merah = tidak hadir · default belum dipilih
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
                  <Icon name="x" size={14} className="me-1" /> Semua Tidak
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

          {/* ---- Riwayat kelas ini (5 hari terakhir) ---- */}
          <div className="admin-card p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <h6 className="mb-0">Riwayat Absensi Kelas Ini</h6>
              <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
                Menampilkan 5 hari terakhir — data lama tetap aman di database
              </span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-4">
                <Icon name="clock" size={28} className="text-secondary opacity-50 mb-2" />
                <p className="text-sm text-secondary mb-0">
                  Belum ada absensi {classLabel(className)} yang diisi.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table admin-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kehadiran</th>
                      <th className="text-end">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s) => {
                      const total = (s.entries || []).length;
                      const hadir = hadirCount(s);
                      return (
                        <tr key={s.id}>
                          <td>
                            <span className="text-sm fw-semibold text-dark">{formatSundayLabel(s.date)}</span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="attendance-bar flex-grow-1" style={{ maxWidth: 180 }}>
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
