'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icons';
import { formatAdminDate } from '@/lib/format';
import { csrfFetch } from '@/lib/csrfClient';

export default function AdminRegistrationsPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  }

  // Load events list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await csrfFetch('/api/events', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data event.');
        setEvents(data.data || []);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load registrations when event selected
  const regReq = useRef(0);
  useEffect(() => {
    if (!selectedEvent) {
      setRegistrations([]);
      return;
    }
    const req = ++regReq.current;
    (async () => {
      setLoadingRegistrations(true);
      try {
        const res = await csrfFetch(`/api/registrations?eventId=${encodeURIComponent(selectedEvent)}`, { cache: 'no-store' });
        const data = await res.json();
        if (req !== regReq.current) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data pendaftaran.');
        setRegistrations(data.data || []);
      } catch (e) {
        if (req === regReq.current) {
          setRegistrations([]);
          flash('error', e.message);
        }
      } finally {
        if (req === regReq.current) setLoadingRegistrations(false);
      }
    })();
    return () => { regReq.current += 1; };
  }, [selectedEvent]);

  async function handleExport(type) {
    if (!selectedEvent) return;
    try {
      const res = await csrfFetch(`/api/registrations/export?type=${type}&eventId=${encodeURIComponent(selectedEvent)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal membuat file export.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const selectedEventObj = events.find((e) => e.id === selectedEvent);
      const eventName = selectedEventObj?.title || 'Event';
      a.download = `Rekap Pendaftaran ${eventName}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('error', e.message);
    }
  }

  const selectedEventObj = events.find((e) => e.id === selectedEvent);

  return (
    <div className="d-flex flex-column gap-4">
      {msg && (
        <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2 px-3`} role="alert" style={{ borderRadius: 12, fontSize: '0.9rem' }}>
          {msg.text}
        </div>
      )}

      <div>
        <h4 className="mb-1">Registration</h4>
        <p className="text-sm text-secondary mb-0">Kelola data pendaftaran event.</p>
      </div>

      {error && (
        <div className="alert alert-warning py-2 px-3" role="alert" style={{ borderRadius: 12, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-sm text-secondary mb-0">Memuat data event...</p>
        </div>
      ) : (
        <div className="admin-card p-3 p-md-4">
          <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
            <div className="flex-grow-1" style={{ minWidth: 260 }}>
              <label className="form-label text-sm fw-semibold">Pilih Event</label>
              <select
                className="form-select"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                <option value="">— Pilih Event —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({formatAdminDate(ev.date)})
                  </option>
                ))}
              </select>
            </div>
            {selectedEvent && (
              <div className="d-flex gap-2 align-items-end">
                <button
                  className="btn btn-eluzai-outline btn-sm"
                  onClick={() => handleExport('excel')}
                  disabled={registrations.length === 0}
                  title="Export Excel"
                >
                  <Icon name="file-text" size={14} className="me-1" /> Excel
                </button>
                <button
                  className="btn btn-eluzai-outline btn-sm"
                  onClick={() => handleExport('pdf')}
                  disabled={registrations.length === 0}
                  title="Export PDF"
                >
                  <Icon name="download" size={14} className="me-1" /> PDF
                </button>
              </div>
            )}
          </div>

          {selectedEvent && selectedEventObj && (
            <div className="d-flex flex-wrap gap-3 mb-3">
              <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: 'var(--eluzai-blue-soft)', borderRadius: 10 }}>
                <Icon name="users" size={16} style={{ color: 'var(--eluzai-blue)' }} />
                <span className="fw-semibold text-dark">{registrations.length}</span>
                <span className="text-sm text-secondary">Pendaftar</span>
              </div>
              <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: selectedEventObj.formActive ? 'var(--eluzai-green-soft)' : 'var(--eluzai-rose-soft)', borderRadius: 10 }}>
                <Icon name={selectedEventObj.formActive ? 'check' : 'x'} size={16} style={{ color: selectedEventObj.formActive ? 'var(--eluzai-green)' : 'var(--eluzai-rose)' }} />
                <span className="text-sm fw-semibold">{selectedEventObj.formActive ? 'Form Aktif' : 'Form Nonaktif'}</span>
              </div>
            </div>
          )}

          {!selectedEvent ? (
            <div className="text-center py-5">
              <Icon name="calendar" size={34} className="text-secondary opacity-50 mb-2" />
              <p className="text-sm text-secondary mb-0">Pilih event untuk melihat data pendaftaran.</p>
            </div>
          ) : loadingRegistrations ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status" />
              <p className="text-sm text-secondary mb-0">Memuat data pendaftaran...</p>
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-5">
              <Icon name="users" size={34} className="text-secondary opacity-50 mb-2" />
              <p className="text-sm text-secondary mb-0">Belum ada pendaftar untuk event ini.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table admin-table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>No</th>
                    <th>Nama Lengkap</th>
                    <th>Email</th>
                    <th>No. WhatsApp</th>
                    <th>Tanggal Daftar</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-sm">{i + 1}</td>
                      <td className="fw-semibold text-dark text-sm">{r.fullName}</td>
                      <td className="text-sm">{r.email}</td>
                      <td className="text-sm">{r.whatsapp}</td>
                      <td className="text-sm text-nowrap">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
