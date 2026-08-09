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
  'formLink',
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
  formLink: 'Link Google Form',
};

export function missingRequiredFields(body) {
  return EVENT_REQUIRED_FIELDS.filter((k) => !String(body?.[k] ?? '').trim());
}

export function requiredFieldsError(body) {
  const missing = missingRequiredFields(body);
  if (!missing.length) return null;
  return `Field wajib belum diisi: ${missing.map((k) => EVENT_FIELD_LABELS[k] || k).join(', ')}`;
}
