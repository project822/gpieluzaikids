// ============================================================
// Client-side CSRF (double-submit cookie) — SECURITY.md § 3.6.
// Membungkus fetch() agar otomatis menambahkan header
// X-CSRF-Token (dibaca dari cookie eluzai_csrf) pada metode
// state-changing (POST/PUT/PATCH/DELETE).
//
// Sekaligus mengirim identitas perangkat stabil (X-Device-Id) pada
// SETIAP request admin. Server tidak bisa melihat MAC fisik lewat
// HTTPS — ID ini adalah fingerprint perangkat (disimpan di
// localStorage) yang dipakai dashboard /dev untuk memblokir
// perangkat mencurigakan secara real-time.
//
// Hanya boleh diimpor dari komponen client.
// ============================================================

export const CSRF_COOKIE = 'eluzai_csrf';
export const DEVICE_STORAGE_KEY = 'eluzai_device_id';

export function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// ID perangkat stabil: dibuat sekali, disimpan di localStorage, diingat
// dalam memori proses (window.__eluzaiDeviceId) agar tidak baca ulang.
export function getDeviceId() {
  if (typeof window === 'undefined') return '';
  if (window.__eluzaiDeviceId) return window.__eluzaiDeviceId;
  let id = '';
  try {
    id = localStorage.getItem(DEVICE_STORAGE_KEY) || '';
  } catch {
    id = '';
  }
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    );
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    } catch {
      // Storage tidak tersedia (mis. private mode) — ID tetap dipakai
      // untuk sesi ini walau tidak persisten.
    }
  }
  window.__eluzaiDeviceId = id;
  return id;
}

const STATE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function csrfFetch(input, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  const deviceId = getDeviceId();
  if (deviceId && !headers.has('X-Device-Id')) headers.set('X-Device-Id', deviceId);
  if (STATE_METHODS.includes(method)) {
    const token = getCsrfToken();
    if (token && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', token);
  }
  return fetch(input, { ...init, headers });
}
