import { updateSchedule, deleteSchedule, getScheduleById, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidScheduleDate } from '@/lib/scheduleValidation';

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = sanitizePayload(await request.json());
    // Form lengkap (dari modal ubah, punya field date) → tanggal wajib hari Minggu.
    if ('date' in body && body.date && !isValidScheduleDate(body.date)) {
      return Response.json(
        { error: 'Tanggal jadwal harus jatuh pada Hari Minggu.' },
        { status: 400 }
      );
    }
    const payload = {};
    for (const key of ['date', 'ibadahAda', 'ibadahTime', 'latihanAda', 'latihanTime']) {
      if (key in body) {
        payload[key] =
          key === 'ibadahAda' || key === 'latihanAda'
            ? Boolean(body[key])
            : String(body[key] || '').slice(0, 40);
      }
    }
    const item = await updateSchedule(id, payload);
    if (!item) return Response.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'schedule',
      action: 'update',
      detail: `Memperbarui jadwal mingguan ${item.date}.`,
    }).catch(() => {});
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/schedules PUT]', error);
    return Response.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getScheduleById(id);
    if (!item) return Response.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    const ok = await deleteSchedule(id);
    if (!ok) return Response.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'schedule',
      action: 'delete',
      detail: `Menghapus jadwal mingguan ${item.date}.`,
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/schedules DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
