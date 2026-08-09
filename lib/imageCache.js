// ============================================================
// Cache in-memory hasil parse gambar publik (id → { mime, buf }).
//
// Dipakai route /img/[id] (baca) dan repo.js (invalidasi saat
// item di-update/dihapus). Karena URL /img/[id]?v=<updatedAt>
// membuat tiap versi gambar immutable, hasil decode base64
// (sampai ~5MB) aman di-cache sampai item berubah — menghemat
// CPU & query DB di tiap request gambar berulang.
//
// Catatan: cache ini per-instance serverless (bukan shared),
// namun tetap berguna untuk pengunjung yang sama / CDN hit.
// ============================================================

const imageCache = new Map();
const IMAGE_CACHE_MAX = 200;

export function cacheParsedImage(id, parsed) {
  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
  imageCache.set(id, parsed);
}

export function invalidateImageCache(id) {
  imageCache.delete(id);
}

export function getCachedImage(id) {
  return imageCache.get(id) || null;
}
