import { getActivities, deleteActivity, clearActivities } from '@/lib/repo';
import { requireDevKey } from '@/lib/devApi';

// ============================================================
// Log aktivitas admin untuk Dev Console (menu Aktivitas).
// GET    /api/dev/activities?module=...&limit=... → daftar log terbaru
// DELETE /api/dev/activities?id=...               → hapus satu log
// DELETE /api/dev/activities                      → hapus SEMUA log
// Diotentikasi dengan kunci X-Dev-Key (bukan sesi admin).
// ============================================================

export async function GET(request) {
  const denied = requireDevKey(request, 'GET aktivitas');
  if (denied) return denied;
  try {
    const sp = request.nextUrl.searchParams;
    const moduleFilter = sp.get('module') || '';
    const limit = Math.min(500, Math.max(1, Number(sp.get('limit')) || 200));
    const list = await getActivities({ limit, module: moduleFilter });
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/dev/activities GET]', error);
    return Response.json({ error: 'Gagal memuat log aktivitas.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = requireDevKey(request, 'DELETE aktivitas');
  if (denied) return denied;
  try {
    const sp = request.nextUrl.searchParams;
    const id = sp.get('id') || '';
    const all = sp.get('all');
    if (id) {
      const ok = await deleteActivity(id);
      if (!ok) {
        return Response.json({ error: 'Log aktivitas tidak ditemukan.' }, { status: 404 });
      }
      return Response.json({ ok: true });
    }
    // Hapus SEMUA hanya bila diminta eksplisit (?all=1) — cegah hapus massal
    // tidak sengaja dari request tanpa parameter.
    if (all === '1') {
      const deleted = await clearActivities();
      return Response.json({ ok: true, deleted });
    }
    return Response.json({ error: 'Parameter id atau all=1 wajib.' }, { status: 400 });
  } catch (error) {
    console.error('[api/dev/activities DELETE]', error);
    return Response.json({ error: 'Gagal menghapus log aktivitas.' }, { status: 500 });
  }
}
