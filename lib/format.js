// Utilitas format tanggal untuk event (Indonesia, lengkap).
export function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Format tanggal numerik #tanggal-#bulan-#tahun (dd-mm-yyyy) untuk panel admin.
export function formatAdminDate(dateStr) {
  if (!dateStr) return '–';
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(dateStr);
}

// Filter skema URL saat render (defense-in-depth): hanya http/https yang
// dirender sebagai href — menetralkan data lama yang mungkin tersimpan
// dengan skema berbahaya (mis. javascript:) sebelum validasi URL aktif.
export function safeExternalUrl(value) {
  const v = String(value || '').trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(v) ? v : null;
}

// ============================================================
// URL gambar untuk halaman PUBLIK.
//
// Gambar disimpan sebagai data-URL (base64) di database — jika
// langsung dirender, tiap foto menambah puluhan KB–MB ke HTML.
// Helper ini mengembalikan URL /img/[id]?v=<updatedAt> sehingga
// HTML tetap ringan dan gambar di-cache browser (immutable, lihat
// app/img/[id]/route.js).
//
// `v` adalah cache-buster: saat admin mengganti gambar, updatedAt
// berubah → URL baru → browser mengambil versi terbaru.
// ============================================================
export function imageUrl(item) {
  const hasImage = item?.hasImage ?? Boolean(item?.image);
  if (!hasImage) return null;
  // URL eksternal/berkas biasa (bukan data-URL) → pakai langsung.
  if (item.image && typeof item.image === 'string' && !item.image.startsWith('data:')) {
    return item.image;
  }
  const ts = item.updatedAt ? new Date(item.updatedAt).getTime() : 1;
  return `/img/${encodeURIComponent(item.id)}?v=${ts}`;
}

// Proyeksi ringan untuk dikirim ke komponen CLIENT (RSC payload).
// Field `image` (data-URL base64, bisa puluhan KB–MB) DIBUANG dan
// diganti flag `hasImage` — HTML/payload tetap ringan, gambar dimuat
// lewat /img/[id].
export function publicEvent(item) {
  if (!item) return item;
  const { image, ...rest } = item;
  return { ...rest, hasImage: Boolean(image) };
}
