// ============================================================
// Client-side CSRF (double-submit cookie) — SECURITY.md § 3.6.
// Membungkus fetch() agar otomatis menambahkan header
// X-CSRF-Token (dibaca dari cookie eluzai_csrf) pada metode
// state-changing (POST/PUT/PATCH/DELETE).
//
// Hanya boleh diimpor dari komponen client.
// ============================================================

export const CSRF_COOKIE = 'eluzai_csrf';

export function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

const STATE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function csrfFetch(input, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  if (STATE_METHODS.includes(method)) {
    const token = getCsrfToken();
    if (token && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', token);
  }
  return fetch(input, { ...init, headers });
}
