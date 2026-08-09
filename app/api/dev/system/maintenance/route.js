import { requireDevKey } from '@/lib/devApi';
import {
  maintenanceEnabled,
  getMaintenanceSource,
  getMaintenanceText,
  setMaintenanceMode,
  setMaintenanceText,
} from '@/lib/runtimeState';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// Kontrol maintenance mode & teks halaman maintenance (real-time,
// tanpa restart server).
//   GET  /api/dev/system/maintenance → { maintenance: { enabled, source, title, message, footer } }
//   POST /api/dev/system/maintenance
//        body: { "maintenance": true|false, "title": "...",
//                "message": "...", "footer": "..." }
//        Semua field opsional — hanya yang dikirim yang diubah.
// Bentuk respons konsisten dengan /api/dev/status (teks di dalam
// objek "maintenance").

function maintenancePayload() {
  return {
    enabled: maintenanceEnabled(),
    source: getMaintenanceSource(),
    ...getMaintenanceText(),
  };
}

export async function GET(request) {
  const denied = requireDevKey(request, 'GET maintenance');
  if (denied) return denied;
  return Response.json({ ok: true, maintenance: maintenancePayload() });
}

export async function POST(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'POST maintenance');
  if (denied) return denied;

  try {
    const body = await request.json();
    if (body && typeof body !== 'object') {
      return Response.json({ error: 'Body harus berupa JSON object.' }, { status: 400 });
    }

    const changed = [];

    if (body.maintenance !== undefined) {
      if (typeof body.maintenance !== 'boolean') {
        return Response.json({ error: '"maintenance" harus boolean.' }, { status: 400 });
      }
      setMaintenanceMode(body.maintenance);
      changed.push(`mode ${body.maintenance ? 'DIAKTIFKAN' : 'dinonaktifkan'}`);
    }

    const textPatch = {};
    for (const key of ['title', 'message', 'footer']) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string') {
          return Response.json({ error: `"${key}" harus string.` }, { status: 400 });
        }
        textPatch[key] = body[key];
      }
    }
    if (Object.keys(textPatch).length > 0) {
      setMaintenanceText(textPatch);
      changed.push('teks diperbarui');
    }

    if (changed.length === 0) {
      return Response.json(
        { error: 'Tidak ada field yang diubah (maintenance/title/message/footer).' },
        { status: 400 }
      );
    }

    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: '/api/dev/system/maintenance',
      detail: changed.join('; '),
    });
    return Response.json({ ok: true, maintenance: maintenancePayload() });
  } catch (error) {
    console.error('[api/dev/system/maintenance POST]', error);
    return Response.json({ error: 'Gagal mengubah maintenance mode.' }, { status: 500 });
  }
}
