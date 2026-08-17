'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icons';
import { isRegistrationClosed } from '@/components/user/EventActions';

export default function RegistrationForm() {
  const { id } = useParams();
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[0-9]{8,15}$/;

  function validate() {
    const { fullName, email, whatsapp } = form;
    if (!fullName.trim() || fullName.trim().length < 2) return 'Nama lengkap wajib diisi (minimal 2 karakter).';
    if (fullName.trim().length > 100) return 'Nama lengkap maksimal 100 karakter.';
    if (!email.trim() || !EMAIL_RE.test(email.trim())) return 'Alamat email tidak valid.';
    if (!whatsapp.trim() || !PHONE_RE.test(whatsapp.trim())) return 'Nomor WhatsApp tidak valid (8-15 digit angka).';
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

  return (
    <>
      <PageHeader title="Form Pendaftaran" sub="Isi data diri Anda untuk mendaftar" />
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
                <div className="mb-4">
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
