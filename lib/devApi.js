// ============================================================
// Helper bersama endpoint /api/dev/* (project /dev).
// Autentikasi memakai kunci rahasia bersama DEV_API_KEY lewat
// header X-Dev-Key — BUKAN sesi admin biasa. CSRF tidak berlaku
// di sini (proxy.js mengecualikan /api/dev/*), karena pemanggil
// mesin-ke-mesin dengan kunci sendiri.
// ============================================================

import { safeCompare } from './auth';
import { logSecurityEvent } from './securityLog';
import { getClientIp } from './security';

export function devKeyValid(request) {
  // Fail-closed: di produksi, /api/dev/* HANYA aktif bila diset eksplisit
  // DEV_API_ENABLED=1 (endpoint pengembangan tidak boleh terbuka diam-diam
  // di deployment publik — improper exposure).
  if (process.env.NODE_ENV === 'production' && process.env.DEV_API_ENABLED !== '1') return false;
  const key = process.env.DEV_API_KEY;
  if (!key) return false;
  const provided = request.headers.get('x-dev-key');
  // Perbandingan konstan-waktu (anti timing attack).
  return Boolean(provided && safeCompare(provided, key));
}

// Mengembalikan respons 401 bila kunci tidak valid, atau null bila lolos.
export function requireDevKey(request, action = '') {
  if (devKeyValid(request)) return null;
  logSecurityEvent({
    type: 'dev_api',
    ip: getClientIp(request),
    path: request.nextUrl?.pathname || '/api/dev',
    detail: `kunci tidak valid (${action || 'permintaan'})`,
  });
  return Response.json(
    { error: 'Kunci X-Dev-Key tidak valid atau belum dikonfigurasi (DEV_API_KEY).' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}
