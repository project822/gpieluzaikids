'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icons';
import { isRegistrationClosed } from '@/components/user/EventActions';

export default function RegistrationForm() {
  const { id } = useParams();
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '' });
  const [customFields, setCustomFields] = useState({});
  const [eventData, setEventData] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[0-9]{8,15}$/;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.data) {
          const ev = data.data.find((e) => e.id === id);
          if (ev) setEventData(ev);
        }
      } catch {
        // silently fail — form tetap jalan tanpa custom fields
      } finally {
        if (!cancelled) setEventLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const eventFields = Array.isArray(eventData?.customFormFields) ? eventData.customFormFields : [];
  const formTitle = eventData?.formTitle || 'Form Pendaftaran';

  function validate() {
    const { fullName, email, whatsapp } = form;
    if (!fullName.trim() || fullName.trim().length < 2) return 'Nama lengkap wajib diisi (minimal 2 karakter).';
    if (fullName.trim().length > 100) return 'Nama lengkap maksimal 100 karakter.';
    if (!email.trim() || !EMAIL_RE.test(email.trim())) return 'Alamat email tidak valid.';
    if (!whatsapp.trim() || !PHONE_RE.test(whatsapp.trim())) return 'Nomor WhatsApp tidak valid (8-15 digit angka).';
    // Validasi custom fields
    for (const field of eventFields) {
      const val = customFields[field.label] || '';
      const strVal = typeof val === 'string' ? val.trim() : String(val || '').trim();
      if (field.required && !strVal) return `Field "${field.label}" wajib diisi.`;
      if (strVal && field.type === 'email' && !EMAIL_RE.test(strVal)) return `Field "${field.label}" harus berupa email yang valid.`;
      if (strVal && field.type === 'tel' && !/^[0-9]{6,15}$/.test(strVal)) return `Field "${field.label}" harus berupa nomor telepon yang valid.`;
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: id,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          whatsapp: form.whatsapp.trim(),
          customFields: Object.fromEntries(
            Object.entries(customFields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : String(v || '').trim()])
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftar.');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderCustomField(field) {
    const value = customFields[field.label] || '';
    const baseClass = 'form-control';
    const placeholder = field.placeholder || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            className="form-select"
            value={value}
            onChange={(e) => setCustomFields((p) => ({ ...p, [field.label]: e.target.value }))}
            required={field.required}
          >
            <option value="">{placeholder || '-- Pilih --'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <div className="form-check form-switch mt-1">
            <input
              className="form-check-input"
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setCustomFields((p) => ({ ...p, [field.label]: e.target.checked ? 'true' : '' }))}
              id={`cf-${field.label}`}
            />
            <label className="form-check-label" htmlFor={`cf-${field.label}`}>
              {field.label}
            </label>
          </div>
        );
      case 'textarea':
        return (
          <textarea
            className={baseClass}
            rows={3}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setCustomFields((p) => ({ ...p, [field.label]: e.target.value }))}
            required={field.required}
          />
        );
      default:
        return (
          <input
            className={baseClass}
            type={field.type || 'text'}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setCustomFields((p) => ({ ...p, [field.label]: e.target.value }))}
            required={field.required}
            maxLength={500}
          />
        );
    }
  }

  return (
    <>
      <PageHeader title={eventLoading ? 'Form Pendaftaran' : formTitle} sub={eventData ? `Event: ${eventData.title}` : 'Isi data diri Anda untuk mendaftar'} />
      <section className="section pt-4">
        <div className="container" style={{ maxWidth: 560 }}>
          {success ? (
            <div className="card-lift p-5 text-center">
              <div className="mb-3">
                <span className="icon-chip" style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--eluzai-green-soft)', color: 'var(--eluzai-green)' }}>
                  <Icon name="check" size={32} />
                </span>
              </div>
              <h5 className="fw-bold mb-2">Pendaftaran Berhasil!</h5>
              <p className="text-secondary mb-4">
                Terima kasih telah mendaftar. Data Anda telah kami terima.
              </p>
              <Link href="/" className="btn btn-eluzai">
                <Icon name="chevron-left" size={16} className="me-1" /> Kembali ke Beranda
              </Link>
            </div>
          ) : (
            <div className="card-lift p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Nama Lengkap <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Masukkan nama lengkap"
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Alamat Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="contoh: nama@email.com"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Nomor WhatsApp Aktif <span className="text-danger">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="contoh: 081234567890"
                    value={form.whatsapp}
                    onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                    pattern="[0-9]{8,15}"
                    required
                  />
                  <div className="text-secondary mt-1" style={{ fontSize: '0.82rem' }}>
                    8-15 digit angka, tanpa spasi atau simbol
                  </div>
                </div>

                {eventFields.map((field, i) => (
                  <div className="mb-3" key={field.label || i}>
                    {field.type !== 'checkbox' ? (
                      <label className="form-label fw-semibold">
                        {field.label} {field.required && <span className="text-danger">*</span>}
                      </label>
                    ) : null}
                    {renderCustomField(field)}
                  </div>
                ))}

                {error && (
                  <div className="alert alert-danger py-2 px-3 mb-3" style={{ borderRadius: 10, fontSize: '0.9rem' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn btn-eluzai btn-lg w-100" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      Kirim Pendaftaran <Icon name="arrow-right" size={16} className="ms-1" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link href="/" className="btn btn-eluzai-outline btn-sm">
              <Icon name="chevron-left" size={14} className="me-1" /> Kembali ke Beranda
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
