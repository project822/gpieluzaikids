import { requireDevKey } from '@/lib/devApi';
import { getRateLimitedIps, unblockIp, resetAllRateLimits } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// IP yang sedang diblokir karena rate limit login (real-time).
//   GET    /api/dev/ip-ratelimit            → daftar IP terblokir
//   DELETE /api/dev/ip-ratelimit?ip=1.2.3.4 → buka blokir satu IP
//   DELETE /api/dev/ip-ratelimit            → reset SEMUA rate limit login

const IP_RE = /^[\d.a-fA-F:]+$/;

export async function GET(request) {
  const denied = requireDevKey(request, 'GET ip-ratelimit');
  if (denied) return denied;
  return Response.json({ ok: true, data: getRateLimitedIps() });
}

export async function DELETE(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'DELETE ip-ratelimit');
  if (denied) return denied;

  const target = String(request.nextUrl.searchParams.get('ip') || '').trim();

  // Tanpa ?ip= → reset semua (tombol "Reset Semua" di dashboard /dev).
  if (!target) {
    resetAllRateLimits();
    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: '/api/dev/ip-ratelimit',
      detail: 'semua rate limit login direset',
    });
    return Response.json({ ok: true, reset: 'all', data: getRateLimitedIps() });
  }

  if (!IP_RE.test(target)) {
    return Response.json({ error: 'Parameter ?ip= wajib diisi (format IP valid).' }, { status: 400 });
  }

  const removed = unblockIp(target);
  logSecurityEvent({
    type: 'dev_api',
    ip,
    path: '/api/dev/ip-ratelimit',
    detail: removed ? `rate limit dibuka untuk ${target}` : `tidak ada blokir untuk ${target}`,
  });
  return Response.json({ ok: true, removed, ip: target });
}
