// Validasi field wajib event — dipakai bersama oleh POST & PUT
// (app/api/events) agar definisi tidak terduplikasi/drifting.

export const EVENT_REQUIRED_FIELDS = [
  'title',
  'theme',
  'image',
  'date',
  'openGate',
  'time',
  'location',
  'mapsLink',
];

export const EVENT_FIELD_LABELS = {
  title: 'Nama event',
  theme: 'Tema',
  image: 'Foto event',
  date: 'Tanggal',
  openGate: 'Open gate',
  time: 'Waktu mulai',
  location: 'Lokasi/tempat',
  mapsLink: 'Link Google Maps',
};

export function missingRequiredFields(body) {
  return EVENT_REQUIRED_FIELDS.filter((k) => !String(body?.[k] ?? '').trim());
}

export function requiredFieldsError(body) {
  const missing = missingRequiredFields(body);
  if (!missing.length) return null;
  return `Field wajib belum diisi: ${missing.map((k) => EVENT_FIELD_LABELS[k] || k).join(', ')}`;
}

// ---------- Validasi URL eksternal ----------
// Hanya http/https yang diizinkan (tolak javascript:, data:, vbscript:, dll.)
// untuk field link yang dirender sebagai href/iframe di halaman publik.
const SAFE_URL_RE = /^https?:\/\/[^\s<>"'`]+$/i;

export function isValidExternalUrl(value) {
  const v = String(value ?? '').trim();
  return v === '' || SAFE_URL_RE.test(v);
}

// Kembalikan daftar field link yang tidak valid (field kosong dianggap valid).
// Hanya memeriksa field yang benar-benar ada di body (penting untuk PUT parsial).
export function invalidUrlFields(body, fields = ['mapsLink', 'formLink', 'photoLink']) {
  return fields.filter((k) => k in body && body[k] != null && !isValidExternalUrl(body[k]));
}

export function invalidUrlsError(body) {
  const bad = invalidUrlFields(body);
  if (!bad.length) return null;
  return `Tautan harus berupa URL http/https yang valid: ${bad.join(', ')}.`;
}
