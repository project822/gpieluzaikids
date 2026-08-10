import { requireDevKey } from '@/lib/devApi';
import {
  getBlockedDevices,
  setBlockedDevices,
  unblockBlockedDevice,
} from '@/lib/runtimeState';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// Kelola blocklist device runtime (device fingerprint / "MAC").
//   GET    /api/dev/system/blocked-devices          → daftar device runtime
//   POST   /api/dev/system/blocked-devices          → set daftar penuh { "devices": [...] }
//   DELETE /api/dev/system/blocked-devices?device=… → hapus satu device dari blocklist

// ID device: UUID (randomUUID) atau token alfanumerik pendek — huruf/angka/_-.
const DEVICE_RE = /^[A-Za-z0-9_-]{8,128}$/;

export async function GET(request) {
  const denied = requireDevKey(request, 'GET blocked-devices');
  if (denied) return denied;
  return Response.json({ ok: true, data: await getBlockedDevices() });
}

export async function POST(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'POST blocked-devices');
  if (denied) return denied;

  try {
    const body = await request.json();
    const devices = (Array.isArray(body?.devices) ? body.devices : [])
      .map((s) => String(s).trim())
      .filter((s) => s && DEVICE_RE.test(s));
    await setBlockedDevices(devices);
    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: '/api/dev/system/blocked-devices',
      detail: `blocklist device diatur: ${devices.length} perangkat`,
    });
    return Response.json({ ok: true, data: await getBlockedDevices() });
  } catch (error) {
    console.error('[api/dev/system/blocked-devices POST]', error);
    return Response.json({ error: 'Gagal mengatur blocklist device.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'DELETE blocked-devices');
  if (denied) return denied;

  const target = String(request.nextUrl.searchParams.get('device') || '').trim();
  if (!target || !DEVICE_RE.test(target)) {
    return Response.json(
      { error: 'Parameter ?device= wajib diisi (format ID device valid).' },
      { status: 400 }
    );
  }
  const removed = await unblockBlockedDevice(target);
  logSecurityEvent({
    type: 'dev_api',
    ip,
    path: '/api/dev/system/blocked-devices',
    detail: removed
      ? `device dihapus dari blocklist: ${target.slice(0, 16)}…`
      : `tidak ada di blocklist: ${target.slice(0, 16)}…`,
  });
  return Response.json({ ok: true, removed, device: target });
}
