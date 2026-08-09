// ============================================================
// Helper keamanan edge-safe (dipakai proxy.js & route handler).
// TIDAK mengimpor modul Node murni (crypto, dll.) agar aman
// dijalankan di Edge Runtime (Vercel).
//
// Lapisan yang diimplementasikan di sini (dari SECURITY.md):
//  - CSRF Protection (double-submit cookie)        → § 3.6
//  - Maintenance Mode & Blocked IP (env)           → § 3.10
//  - Trust Proxy / IP asli klien                   → § 3.16
// ============================================================

export const CSRF_COOKIE = 'eluzai_csrf';

// Cookie double-submit: TIDAK httpOnly karena harus dibaca JavaScript
// dan dikirim ulang sebagai header X-CSRF-Token.
export function csrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  };
}

export function generateCsrfToken() {
  return crypto.randomUUID();
}

// Perbandingan konstan-waktu (anti timing attack) untuk token CSRF.
export async function csrfMatches(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  if (ua.length !== ub.length) return false;
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

// IP asli klien — trust proxy (Vercel/Edge menaruh x-forwarded-for).
// Catatan keamanan: header X-Forwarded-For bisa dipalsukan klien bila server
// diakses langsung tanpa proxy yang menimpa header (mis. self-hosted).
// Platform cloud (Vercel, Netlify, dll.) menimpa header → tepercaya.
// Self-hosted: konfigurasikan reverse proxy untuk menimpa X-Forwarded-For;
// bila tidak memungkinkan, set env TRUST_PROXY=0 agar header klien diabaikan.
export function getClientIp(request) {
  // IP socket asli bila runtime menyediakannya (NextRequest/edge).
  if (request?.ip) return request.ip;
  if (process.env.TRUST_PROXY !== '0') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return 'unknown';
}

// Daftar IP yang diblokir — env BLOCKED_IPS="1.2.3.4,5.6.7.8"
export function isIpBlocked(ip) {
  const raw = (process.env.BLOCKED_IPS || '').trim();
  if (!raw) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(ip);
}

// Mode maintenance — env MAINTENANCE_MODE=1
export function maintenanceEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.MAINTENANCE_MODE || '').toLowerCase()
  );
}
