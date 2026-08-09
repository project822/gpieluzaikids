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

export default function ClassPage({ className, initialDate = '' }) {
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

  // Modal anggota
  const [memberModal, setMemberModal] = useState(null); // { editing|null, name }
  const [memberSaving, setMemberSaving] = useState(false);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const buildDefaultEntries = useCallback(
    (membersList) => membersList.map((m) => ({ memberId: m.id, name: m.name, present: true })),
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

  // ?date= baru saat navigasi antar-halaman yang sama (mis. /admin/baby →
  // /admin/baby?date=...): sinkronkan tanggal form tanpa menunggu remount.
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

  const setPresent = (idx, present) =>
    setEntries((prev) => prev.map((entry, i) => (i === idx ? { ...entry, present } : entry)));

  const setAllPresent = (present) =>
    setEntries((prev) => prev.map((entry) => ({ ...entry, present })));

  async function saveAttendance(e) {
    e.preventDefault();
    if (!formDate) {
      showToast('Pilih tanggal (Hari Minggu) terlebih dahulu.', true);
      return;
    }
    if (!entries.length) {
      showToast('Kelas belum punya anggota — tambahkan anggota dulu.', true);
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

  // ---------- Anggota: tambah / edit / hapus ----------
  const openMemberModal = (editing = null) => {
    setMemberModal({ editing, name: editing?.name || '' });
  };

  async function saveMember(e) {
    e.preventDefault();
    const name = (memberModal.name || '').trim();
    if (!name) {
      showToast('Nama anggota wajib diisi.', true);
      return;
    }
    setMemberSaving(true);
    try {
      const editing = memberModal.editing;
      const url = editing ? `/api/members/${editing.id}` : '/api/members';
      const res = await csrfFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan anggota');
      setMemberModal(null);
      showToast(editing ? 'Anggota diperbarui.' : 'Anggota ditambahkan.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setMemberSaving(false);
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Hapus anggota "${member.name}" dari kelas ${classLabel(className)}?`)) return;
    try {
      const res = await csrfFetch(`/api/members/${member.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus anggota');
      showToast('Anggota dihapus.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
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

  const hadirNow = entries.filter((en) => en.present).length;

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
          <p className="text-sm text-secondary mb-0">
            Kelola anggota & isi absensi mingguan kelas ini.
          </p>
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
          <div className="row g-4">
            {/* ---- Form absensi (inline) ---- */}
            <div className="col-lg-7">
              <form className="admin-card p-3 p-md-4 h-100" onSubmit={saveAttendance}>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <h6 className="mb-0">Form Absensi Mingguan</h6>
                  <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
                    hijau = hadir · merah = tidak hadir
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
                      onClick={() => setAllPresent(true)}
                    >
                      <Icon name="check" size={14} className="me-1" /> Semua Hadir
                    </button>
                    <button
                      type="button"
                      className="btn btn-eluzai-outline btn-sm flex-grow-1"
                      onClick={() => setAllPresent(false)}
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
                    <button
                      type="button"
                      className="btn btn-sm btn-eluzai"
                      onClick={() => openMemberModal()}
                    >
                      <Icon name="plus" size={14} className="me-1" /> Tambah Anggota
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-center px-2 py-2 mb-1">
                      <span className="text-sm text-secondary">
                        Centang <strong>Hadir</strong> (hijau) untuk yang hadir
                      </span>
                      <span className="text-sm fw-semibold">
                        <span className="text-success">{hadirNow}</span>
                        <span className="text-secondary"> / {entries.length} hadir</span>
                      </span>
                    </div>
                    <ul className="attendance-form-list">
                      {entries.map((entry, idx) => (
                        <li key={entry.memberId || idx}>
                          <span className="text-truncate fw-medium">{entry.name}</span>
                          <button
                            type="button"
                            className={`att-toggle ${entry.present ? 'hadir' : 'tidak'}`}
                            onClick={() => setPresent(idx, !entry.present)}
                            aria-pressed={entry.present}
                          >
                            <Icon name={entry.present ? 'check' : 'x'} size={14} />
                            {entry.present ? 'Hadir' : 'Tidak Hadir'}
                          </button>
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
            </div>

            {/* ---- Daftar anggota + CRUD ---- */}
            <div className="col-lg-5">
              <div className="admin-card p-3 p-md-4 h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                  <h6 className="mb-0">Anggota Kelas</h6>
                  <button type="button" className="btn btn-eluzai btn-sm" onClick={() => openMemberModal()}>
                    <Icon name="plus" size={15} className="me-1" /> Tambah
                  </button>
                </div>
                {members.length === 0 ? (
                  <div className="text-center py-5">
                    <Icon name="users" size={30} className="text-secondary opacity-50 mb-2" />
                    <p className="text-sm text-secondary mb-0">
                      Belum ada anggota. Tambahkan untuk mengisi absensi.
                    </p>
                  </div>
                ) : (
                  <ul className="class-member-list">
                    {members.map((m) => (
                      <li key={m.id}>
                        <span className="text-truncate">{m.name}</span>
                        <span className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 28, height: 28 }}
                            onClick={() => openMemberModal(m)}
                            aria-label={`Ubah ${m.name}`}
                            title="Ubah"
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            style={{ width: 28, height: 28 }}
                            onClick={() => removeMember(m)}
                            aria-label={`Hapus ${m.name}`}
                            title="Hapus"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

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

      {/* Modal tambah/ubah anggota */}
      {memberModal && (
        <div
          className="modal-backdrop-eluzai"
          onMouseDown={(e) => e.target === e.currentTarget && setMemberModal(null)}
        >
          <div className="modal-card-eluzai" style={{ maxWidth: 440 }}>
            <div className="d-flex justify-content-between align-items-center p-4 pb-0">
              <h5 className="mb-0">
                {memberModal.editing ? 'Ubah Anggota' : `Tambah Anggota — ${classLabel(className)}`}
              </h5>
              <button className="icon-btn" onClick={() => setMemberModal(null)} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveMember}>
              <div className="p-4">
                <label className="form-label">
                  Nama Anggota <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={memberModal.name}
                  onChange={(e) => setMemberModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="contoh: Nadia Putri"
                  autoFocus
                  maxLength={80}
                />
              </div>
              <div className="d-flex justify-content-end gap-2 p-4 pt-0">
                <button type="button" className="btn btn-eluzai-outline" onClick={() => setMemberModal(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-eluzai" disabled={memberSaving}>
                  {memberSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
