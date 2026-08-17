'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';

const GRADIENTS = [
  { label: 'Biru', value: '#dbeafe' },
  { label: 'Hijau', value: '#dcfce7' },
  { label: 'Ungu', value: '#ede9fe' },
  { label: 'Kuning', value: '#fef3c7' },
  { label: 'Merah', value: '#ffe4e6' },
  { label: 'Cyan', value: '#cffafe' },
];

// ---------- Upload gambar: validasi & kompresi di sisi klien ----------
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — batas file asli sesuai ketentuan
// Batas output kompresi sedikit lebih rendah dari 4MB agar payload base64
// tetap muat di batas body request platform serverless (mis. Vercel ~4.5MB).
const MAX_OUTPUT_BYTES = 3.5 * 1024 * 1024;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    img.src = src;
  });
}

// Memotong gambar (cover-crop) ke rasio target lalu mengekspor WebP
// dengan kualitas yang diturunkan otomatis agar tetap ≤ 4MB.
async function processImageFile(file, ratio) {
  const [aw, ah] = ratio.split(':').map(Number);
  const isImage = IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name || '');
  if (!isImage) {
    throw new Error('Format file harus PNG, JPG, atau WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Ukuran file melebihi 4MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const srcRatio = img.width / img.height;
    const targetRatio = aw / ah;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (srcRatio > targetRatio) {
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(Math.min(sw, 1200));
    canvas.height = Math.round(canvas.width / targetRatio);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    while (Math.ceil(dataUrl.length * 0.75) > MAX_OUTPUT_BYTES && quality > 0.25) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/webp', quality);
    }
    if (Math.ceil(dataUrl.length * 0.75) > MAX_OUTPUT_BYTES) {
      throw new Error('Gambar tetap terlalu besar setelah diproses (maks 4MB).');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Input tanggal yang HANYA menerima Hari Minggu (dipakai form jadwal).
// Tanggal selain Minggu ditolak saat dipilih + pesan kesalahan inline.
function SundayDateField({ value, onChange }) {
  const [error, setError] = useState('');
  const label = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
  return (
    <div>
      <input
        type="date"
        className="form-control"
        value={value || ''}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange('');
            setError('');
            return;
          }
          const d = new Date(`${v}T00:00:00`);
          if (Number.isNaN(d.getTime()) || d.getDay() !== 0) {
            setError('Tanggal harus jatuh pada Hari Minggu.');
            return;
          }
          setError('');
          onChange(v);
        }}
      />
      {error && <div className="text-danger text-sm mt-1">{error}</div>}
      {value && !error && <div className="text-sm text-secondary mt-1">{label}</div>}
    </div>
  );
}

function ImageField({ value, onChange, ratio = '16:9', hint }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await processImageFile(file, ratio);
      onChange(dataUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="d-flex align-items-start gap-3 flex-wrap">
        <div className="image-field-preview" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Pratinjau gambar" />
          ) : (
            <span>Belum ada gambar</span>
          )}
        </div>
        <div className="d-flex flex-column gap-2">
          <label className="btn btn-eluzai-outline btn-sm mb-0" style={{ cursor: 'pointer' }}>
            {busy ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                Memproses...
              </>
            ) : value ? (
              'Ganti Gambar'
            ) : (
              'Pilih Gambar'
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="d-none"
              disabled={busy}
              onChange={handleFile}
            />
          </label>
          {value && (
            <button
              type="button"
              className="btn btn-sm px-3 align-self-start"
              style={{ background: 'var(--eluzai-rose-soft)', color: 'var(--eluzai-rose)' }}
              onClick={() => onChange('')}
            >
              <Icon name="trash" size={14} className="me-1" /> Hapus Gambar
            </button>
          )}
          <span className="text-sm text-secondary" style={{ fontSize: '0.78rem', maxWidth: 260 }}>
            {hint}
          </span>
        </div>
      </div>
      {error && <div className="text-danger text-sm mt-2">{error}</div>}
    </div>
  );
}

export default function ResourceManager({ endpoint, title, subtitle, addLabel, fields, columns, quickEdit, toggleActiveField }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  // Quick edit: modal kecil khusus satu field per baris (mis. link Google Drive).
  const [quickItem, setQuickItem] = useState(null);
  const [quickValue, setQuickValue] = useState('');
  // Toggle tampil/sembunyikan cepat per baris (mis. field `active`).
  const [togglingId, setTogglingId] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await csrfFetch(endpoint, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data');
        setItems(data.data || []);
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
  }, [endpoint, reloadKey]);

  const openCreate = () => {
    const init = {};
    fields.forEach((f) => {
      init[f.name] = f.default !== undefined ? f.default : '';
    });
    setEditing(null);
    setForm(init);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setModalOpen(true);
  };

  const openQuick = (item) => {
    setQuickItem(item);
    setQuickValue(item?.[quickEdit.field] || '');
  };

  async function saveQuick(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await csrfFetch(`${endpoint}/${quickItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [quickEdit.field]: quickValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data');
      setQuickItem(null);
      showToast(quickValue.trim() ? 'Link tersimpan.' : 'Link dihapus.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    // Validasi field wajib (termasuk upload gambar) sebelum dikirim.
    const missing = fields.filter((f) => f.required && !String(form[f.name] ?? '').trim());
    if (missing.length) {
      showToast(`Lengkapi field wajib: ${missing.map((f) => f.label).join(', ')}`, true);
      return;
    }
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${endpoint}/${editing.id}` : endpoint;
      const res = await csrfFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data');
      setModalOpen(false);
      showToast(
        data.replaced
          ? 'Banner lama digantikan dengan banner baru.'
          : editing
            ? 'Data berhasil diperbarui.'
            : 'Data berhasil ditambahkan.'
      );
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  // Toggle cepat (mis. tampil/sembunyikan event) — PUT hanya satu field,
  // tanpa menimpa field lain (jalan pintas quick-edit).
  async function toggleActive(item) {
    if (!toggleActiveField || togglingId) return;
    const next = !(item[toggleActiveField.name] !== false);
    setTogglingId(item.id);
    try {
      const res = await csrfFetch(`${endpoint}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [toggleActiveField.name]: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data');
      showToast(next ? toggleActiveField.onLabel || 'Item ditampilkan.' : toggleActiveField.offLabel || 'Item disembunyikan.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(item) {
    if (!window.confirm('Yakin ingin menghapus data ini? Tindakan tidak dapat dibatalkan.')) return;
    try {
      const res = await csrfFetch(`${endpoint}/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data');
      showToast('Data berhasil dihapus.');
      refresh();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function renderField(f, value, setValue) {
    switch (f.type) {
      case 'textarea':
        return (
          <textarea
            className="form-control"
            rows={f.rows || 3}
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder={f.placeholder}
            required={f.required}
          />
        );
      case 'select':
        return (
          <select
            className="form-select"
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            required={f.required}
          >
            {(f.options || []).map((o) =>
              typeof o === 'string' ? (
                <option key={o} value={o}>
                  {o}
                </option>
              ) : (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )
            )}
          </select>
        );
      case 'gradient':
        const hasCustom = value && !GRADIENTS.some((g) => g.value === value);
        return (
          <select
            className="form-select"
            value={value || GRADIENTS[0].value}
            onChange={(e) => setValue(e.target.value)}
          >
            {hasCustom && <option value={value}>Kustom</option>}
            {GRADIENTS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        );
      case 'file':
        return (
          <ImageField value={value} onChange={setValue} ratio={f.ratio || '16:9'} hint={f.hint} />
        );
      case 'checkbox': {
        // Mutual exclusion: formActive ↔ formLink
        const isFormActive = f.name === 'formActive';
        const isFormLink = f.name === 'formLink';
        const formLinkVal = isFormActive ? (form.formLink || '') : '';
        const formActiveVal = isFormLink ? Boolean(form.formActive) : false;
        const disabledByExclusion = isFormActive && formLinkVal.trim().length > 0;

        return (
          <div>
            <div className="form-check form-switch mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                checked={Boolean(value)}
                disabled={disabledByExclusion}
                onChange={(e) => {
                  if (isFormActive && e.target.checked) {
                    setForm((prev) => ({ ...prev, formLink: '' }));
                  }
                  setValue(e.target.checked);
                }}
                id={`f-${f.name}`}
              />
              <label className="form-check-label text-sm" htmlFor={`f-${f.name}`}>
                {f.switchLabel || 'Aktif'}
              </label>
            </div>
            {isFormActive && disabledByExclusion && (
              <div className="text-sm text-secondary mt-1" style={{ fontSize: '0.78rem' }}>
                Nonaktifkan Link Google Form terlebih dahulu untuk mengaktifkan form internal.
              </div>
            )}
          </div>
        );
      }
      case 'url': {
        // Mutual exclusion: formLink ↔ formActive
        const isFormLink = f.name === 'formLink';
        const formActiveVal = isFormLink ? Boolean(form.formActive) : false;
        const disabledByExclusion = isFormLink && formActiveVal;

        return (
          <div>
            <input
              className="form-control"
              type="url"
              value={value || ''}
              disabled={disabledByExclusion}
              onChange={(e) => {
                if (isFormLink && e.target.value.trim()) {
                  setForm((prev) => ({ ...prev, formActive: false }));
                }
                setValue(e.target.value);
              }}
              placeholder={f.placeholder}
              required={f.required}
            />
            {isFormLink && disabledByExclusion && (
              <div className="text-sm text-secondary mt-1" style={{ fontSize: '0.78rem' }}>
                Nonaktifkan Form Internal terlebih dahulu untuk mengisi Link Google Form.
              </div>
            )}
          </div>
        );
      }
      case 'date':
        // Tanggal dengan pembatasan hari (mis. jadwal wajib hari Minggu).
        if (f.sundayOnly) {
          return <SundayDateField value={value} onChange={setValue} />;
        }
        return (
          <input
            className="form-control"
            type="date"
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            required={f.required}
          />
        );
      default:
        return (
          <input
            className="form-control"
            type={f.type || 'text'}
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder={f.placeholder}
            required={f.required}
            min={f.type === 'number' ? 0 : undefined}
          />
        );
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h4 className="mb-1">{title}</h4>
          {subtitle && <p className="text-sm text-secondary mb-0">{subtitle}</p>}
        </div>
        <button className="btn btn-eluzai" onClick={openCreate}>
          <Icon name="plus" size={17} className="me-1" /> {addLabel || 'Tambah Baru'}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning py-2 px-3" role="alert" style={{ borderRadius: 12, fontSize: '0.9rem' }}>
          {error} — klik “Tambah Baru” atau muat ulang halaman.
        </div>
      )}

      <div className="admin-card p-3 p-md-4">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status" />
            <p className="text-sm text-secondary mb-0">Memuat data...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5">
            <Icon name="plus" size={34} className="text-secondary opacity-50 mb-2" />
            <p className="text-sm text-secondary mb-3">Belum ada data.</p>
            <button className="btn btn-eluzai-outline" onClick={openCreate}>
              <Icon name="plus" size={16} className="me-1" /> Tambah data pertama
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table admin-table align-middle mb-0">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th className="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {columns.map((c) => (
                      <td key={c.key}>{c.render ? c.render(item) : item[c.key]}</td>
                    ))}
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        {quickEdit && (
                          <button
                            className="icon-btn"
                            onClick={() => openQuick(item)}
                            aria-label={quickEdit.ariaLabel || `Atur ${quickEdit.label}`}
                            title={quickEdit.ariaLabel || `Atur ${quickEdit.label}`}
                          >
                            <Icon name={quickEdit.icon || 'link'} size={16} />
                          </button>
                        )}
                        {toggleActiveField && (
                          <button
                            className={`icon-btn ${item[toggleActiveField.name] === false ? 'muted' : ''}`}
                            onClick={() => toggleActive(item)}
                            disabled={togglingId === item.id}
                            aria-label={
                              item[toggleActiveField.name] === false
                                ? toggleActiveField.showAriaLabel || toggleActiveField.showTitle || 'Tampilkan ke publik'
                                : toggleActiveField.hideAriaLabel || toggleActiveField.hideTitle || 'Sembunyikan dari publik'
                            }
                            title={
                              item[toggleActiveField.name] === false
                                ? toggleActiveField.showTitle || 'Tampilkan ke publik'
                                : toggleActiveField.hideTitle || 'Sembunyikan dari publik'
                            }
                          >
                            <Icon name={item[toggleActiveField.name] === false ? 'eye-off' : 'eye'} size={16} />
                          </button>
                        )}
                        <button className="icon-btn" onClick={() => openEdit(item)} aria-label="Ubah">
                          <Icon name="edit" size={16} />
                        </button>
                        <button className="icon-btn danger" onClick={() => remove(item)} aria-label="Hapus">
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop-eluzai" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-card-eluzai">
            <div className="d-flex justify-content-between align-items-center p-4 pb-0">
              <h5 className="mb-0">{editing ? 'Ubah Data' : addLabel || 'Tambah Baru'}</h5>
              <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="p-4 row g-3">
                {fields.map((f) => (
                  <div key={f.name} className={f.col || 'col-md-6'}>
                    <label className="form-label">
                      {f.label} {f.required && <span className="text-danger">*</span>}
                    </label>
                    {renderField(f, form[f.name], (v) => setForm((prev) => ({ ...prev, [f.name]: v })))}
                  </div>
                ))}
              </div>
              <div className="d-flex justify-content-end gap-2 p-4 pt-0">
                <button type="button" className="btn btn-eluzai-outline" onClick={() => setModalOpen(false)}>
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

      {quickEdit && quickItem && (
        <div className="modal-backdrop-eluzai" onMouseDown={(e) => e.target === e.currentTarget && setQuickItem(null)}>
          <div className="modal-card-eluzai" style={{ maxWidth: 480 }}>
            <div className="d-flex justify-content-between align-items-center p-4 pb-0">
              <h5 className="mb-0">{quickEdit.modalTitle || quickEdit.label}</h5>
              <button className="icon-btn" onClick={() => setQuickItem(null)} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveQuick}>
              <div className="p-4">
                <label className="form-label">{quickEdit.label}</label>
                <input
                  type="url"
                  className="form-control"
                  value={quickValue}
                  onChange={(e) => setQuickValue(e.target.value)}
                  placeholder={quickEdit.placeholder}
                />
                {quickEdit.hint && <div className="text-sm text-secondary mt-2">{quickEdit.hint}</div>}
              </div>
              <div className="d-flex justify-content-end gap-2 p-4 pt-0">
                <button type="button" className="btn btn-eluzai-outline" onClick={() => setQuickItem(null)}>
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

      {toast && (
        <div className={`toast-eluzai ${toast.isError ? 'error' : ''}`} role="status">
          <Icon name={toast.isError ? 'x' : 'check'} size={19} className={toast.isError ? 'text-danger' : 'text-success'} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
