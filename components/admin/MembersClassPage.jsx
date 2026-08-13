'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import { classLabel } from '@/lib/attendanceValidation';
import { Toast } from './AttendanceShared';

export default function MembersClassPage({ className }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Form tambah anggota (inline)
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  // Modal edit
  const [editing, setEditing] = useState(null); // { id, name }
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await csrfFetch(`/api/members?class=${className}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat anggota');
        // Urut abjad (Indonesia) — nama anggota di setiap kelas tampil berurutan.
        setMembers((data.data || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'id')));
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
  }, [className, reloadKey]);

  // ---------- Tambah ----------
  async function addMember(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      showToast('Nama anggota wajib diisi.', true);
      return;
    }
    setAdding(true);
    try {
      const res = await csrfFetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan anggota');
      setNewName('');
      showToast('Anggota ditambahkan.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setAdding(false);
    }
  }

  // ---------- Edit ----------
  const openEdit = (member) => {
    setEditing(member);
    setEditName(member.name);
  };

  async function saveEdit(e) {
    e.preventDefault();
    const name = editName.trim();
    if (!name) {
      showToast('Nama anggota wajib diisi.', true);
      return;
    }
    setSaving(true);
    try {
      const res = await csrfFetch(`/api/members/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan anggota');
      setEditing(null);
      showToast('Anggota diperbarui.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  // ---------- Hapus ----------
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

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header kelas */}
      <div className="d-flex flex-wrap align-items-center gap-3">
        <Link
          href="/admin/anggota"
          className="icon-btn"
          aria-label="Kembali ke Anggota"
          title="Kembali ke Anggota"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <span className={`class-avatar ${className}`}>{classLabel(className).slice(0, 1)}</span>
        <div>
          <h4 className="mb-0">{classLabel(className)}</h4>
          <p className="text-sm text-secondary mb-0">Tambah & kelola anggota kelas ini.</p>
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
          {/* ---- Form tambah anggota (data dipakai untuk absensi) ---- */}
          <form className="admin-card p-3 p-md-4" onSubmit={addMember}>
            <h6 className="mb-3">Tambah Anggota</h6>
            <div className="d-flex flex-column flex-md-row gap-2">
              <input
                type="text"
                className="form-control flex-grow-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama anggota baru..."
                maxLength={80}
                aria-label="Nama anggota baru"
              />
              <button type="submit" className="btn btn-eluzai" disabled={adding}>
                {adding ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} className="me-1" /> Tambah
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-secondary mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
              Data anggota ini yang dipakai saat mengisi absensi di menu Absensi.
            </p>
          </form>

          {/* ---- Daftar anggota + aksi ---- */}
          <div className="admin-card p-3 p-md-4">
            <h6 className="mb-2">Daftar Anggota</h6>
            {members.length === 0 ? (
              <div className="text-center py-5">
                <Icon name="users" size={30} className="text-secondary opacity-50 mb-2" />
                <p className="text-sm text-secondary mb-0">
                  Belum ada anggota. Gunakan form di atas untuk menambahkan.
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
                        onClick={() => openEdit(m)}
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
        </>
      )}

      {/* Modal ubah anggota */}
      {editing && (
        <div
          className="modal-backdrop-eluzai"
          onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="modal-card-eluzai" style={{ maxWidth: 440 }}>
            <div className="d-flex justify-content-between align-items-center p-4 pb-0">
              <h5 className="mb-0">Ubah Anggota</h5>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="p-4">
                <label className="form-label">
                  Nama Anggota <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="contoh: Nadia Putri"
                  autoFocus
                  maxLength={80}
                />
              </div>
              <div className="d-flex justify-content-end gap-2 p-4 pt-0">
                <button type="button" className="btn btn-eluzai-outline" onClick={() => setEditing(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-eluzai" disabled={saving}>
                  {saving ? (
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
