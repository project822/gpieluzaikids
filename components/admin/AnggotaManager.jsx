'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { csrfFetch } from '@/lib/csrfClient';
import { CLASSES } from '@/lib/attendanceValidation';
import ClassCards from './ClassCards';

export default function AnggotaManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h4 className="mb-1">Anggota</h4>
        <p className="text-sm text-secondary mb-0">
          Pilih kelas untuk menambah & mengelola anggota.
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

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-sm text-secondary mb-0">Memuat data...</p>
        </div>
      ) : (
        <ClassCards
          classes={membersByClass}
          hrefPrefix="/admin/anggota"
          buttonLabel="Kelola Anggota"
          buttonIcon="users"
        />
      )}
    </div>
  );
}
