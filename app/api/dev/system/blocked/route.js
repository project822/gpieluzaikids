import { requireDevKey } from '@/lib/devApi';
import { getBlockedIps, setBlockedIps, unblockBlockedIp } from '@/lib/runtimeState';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// Kelola blocklist IP runtime (di luar env BLOCKED_IPS).
//   GET    /api/dev/system/blocked          → daftar IP runtime
//   POST   /api/dev/system/blocked          → set daftar penuh { "ips": [...] }
//   DELETE /api/dev/system/blocked?ip=1.2.3.4 → hapus satu IP dari blocklist runtime

const IP_RE = /^[\d.a-fA-F:]+$/;

export async function GET(request) {
  const denied = requireDevKey(request, 'GET blocked');
  if (denied) return denied;
  return Response.json({ ok: true, data: getBlockedIps() });
}

export async function POST(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'POST blocked');
  if (denied) return denied;

  try {
    const body = await request.json();
    const ips = (Array.isArray(body?.ips) ? body.ips : [])
      .map((s) => String(s).trim())
      .filter((s) => s && IP_RE.test(s));
    setBlockedIps(ips);
    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: '/api/dev/system/blocked',
      detail: `blocklist diatur: ${ips.join(', ') || '(kosong)'}`,
    });
    return Response.json({ ok: true, data: getBlockedIps() });
  } catch (error) {
    console.error('[api/dev/system/blocked POST]', error);
    return Response.json({ error: 'Gagal mengatur blocklist.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'DELETE blocked');
  if (denied) return denied;

  const target = String(request.nextUrl.searchParams.get('ip') || '').trim();
  if (!target) {
    return Response.json({ error: 'Parameter ?ip= wajib diisi.' }, { status: 400 });
  }
  const removed = unblockBlockedIp(target);
  logSecurityEvent({
    type: 'dev_api',
    ip,
    path: '/api/dev/system/blocked',
    detail: removed ? `IP dihapus dari blocklist: ${target}` : `tidak ada di blocklist: ${target}`,
  });
  return Response.json({ ok: true, removed, ip: target });
}
