'use client';

import { useEffect, useState } from 'react';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';
import { CHURCH } from '@/lib/data';

// Kelola kutipan ayat yang tampil di hero beranda.
// Data disimpan server-side (MongoDB + file) via /api/verse; bila kosong,
// beranda menampilkan ayat bawaan dari CHURCH (lib/data.js).
export default function VerseManager() {
  const [verse, setVerse] = useState('');
  const [verseRef, setVerseRef] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await csrfFetch('/api/verse', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat kutipan ayat');
        const d = data.data || {};
        // Nilai tersimpan; bila kosong tampilkan ayat bawaan agar admin
        // melihat apa yang sedang tampil di beranda.
        setVerse(d.verse || CHURCH.verse || '');
        setVerseRef(d.verseRef || CHURCH.verseRef || '');
      } catch (e) {
        if (!cancelled) showToast(e.message, true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await csrfFetch('/api/verse', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verse: verse.trim(), verseRef: verseRef.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kutipan ayat');
      showToast('Kutipan ayat tersimpan.');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card p-3 p-md-4">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div>
          <h6 className="mb-1">Kutipan Ayat (Hero Beranda)</h6>
          <p className="text-sm text-secondary mb-0" style={{ fontSize: '0.8rem' }}>
            Kosongkan untuk kembali ke ayat bawaan.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : (
        <form onSubmit={save}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Teks Ayat</label>
              <textarea
                className="form-control"
                rows={4}
                value={verse}
                onChange={(e) => setVerse(e.target.value)}
                placeholder="Tulis ayat di sini..."
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Referensi Ayat</label>
              <input
                className="form-control"
                type="text"
                value={verseRef}
                onChange={(e) => setVerseRef(e.target.value)}
                placeholder="contoh: Hebrews 10:25"
              />
            </div>
          </div>
          <div className="d-flex justify-content-end mt-3">
            <button type="submit" className="btn btn-eluzai" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Icon name="check" size={16} className="me-1" /> Simpan
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {toast && (
        <div className={`toast-eluzai ${toast.isError ? 'error' : ''}`} role="status">
          <Icon name={toast.isError ? 'x' : 'check'} size={19} className={toast.isError ? 'text-danger' : 'text-success'} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
