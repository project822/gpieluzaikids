// ============================================================
// Sanitasi input (anti Stored XSS) — SECURITY.md § 3.3.
// Lapisan pertama: buang semua tag HTML dari string user
// sebelum disimpan. Lapisan kedua: React auto-escape saat
// render, jadi konten ditampilkan sebagai teks.
//
// Juga memuat validasi data-URL gambar (whitelist MIME) —
// adaptasi dari § 3.12 untuk pola upload data-URL proyek ini.
// ============================================================

const TAG_REGEX = /<[^>]*>/g;

export function sanitizeString(value) {
  return String(value ?? '').replace(TAG_REGEX, '').trim();
}

// Sanitasi rekursif seluruh payload. Field `image` (data-URL
// base64/encoded) dilewati agar tidak dirusak.
export function sanitizePayload(body) {
  if (!body || typeof body !== 'object') return body;
  // Sanitasi rekursif: string dalam array juga disetrilkan
  // (sanitizePayload() pada string mentah akan mengembalikannya apa adanya).
  if (Array.isArray(body)) {
    return body.map((v) => (typeof v === 'string' ? sanitizeString(v) : sanitizePayload(v)));
  }
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    // Tolak key prototipe berbahaya (anti prototype pollution).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (key === 'image') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = sanitizeString(value);
    } else if (value && typeof value === 'object') {
      out[key] = sanitizePayload(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Validasi tautan banner (opsional): kosong boleh, http(s):// atau jalur
// internal (diawali "/") saja yang diterima. Skema berbahaya (javascript:,
// data:, dll.) ditolak — anti stored XSS via atribut href.
export function isValidRedirectLink(value) {
  const v = String(value ?? '').trim();
  if (!v) return true; // kosong = banner tidak dapat diklik (diizinkan)
  if (v.length > 500) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true; // jalur internal (bukan protocol-relative "//host")
  return /^https?:\/\/[^\s<>"']+$/i.test(v);
}

// Validasi gambar: data-URL dengan MIME whitelist + batas ukuran.
// SVG TIDAK diizinkan untuk UPLOAD baru — SVG bisa memuat skrip yang
// tereksekusi saat file dibuka langsung di browser (stored XSS via
// /img/[id]). Data demo lama (SVG polos tanpa skrip) tetap disajikan
// dengan header CSP sandbox di route /img, jadi aman.
const IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp);/i;
export const MAX_IMAGE_CHARS = 7_000_000;

export function isValidImage(img) {
  return (
    typeof img === 'string' &&
    img.length > 0 &&
    img.length < MAX_IMAGE_CHARS &&
    IMAGE_PATTERN.test(img) &&
    // Tolak payload dengan HTML mentah (mis. data:image/svg+xml,<svg onload=…>)
    // — SVG yang di-encode (base64/percent-encoded) tidak memuat '<'.
    !img.includes('<') &&
    !img.includes('>')
  );
}
