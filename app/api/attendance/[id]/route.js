import { getAttendanceById, updateAttendance, deleteAttendance, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import {
  isValidClass,
  isValidAttendanceEntries,
  normalizeAttendanceEntries,
} from '@/lib/attendanceValidation';

export async function GET(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getAttendanceById(id);
    if (!item) return Response.json({ error: 'Absensi tidak ditemukan.' }, { status: 404 });
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/attendance GET:id]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = sanitizePayload(await request.json());
    const payload = {};
    if ('className' in body) {
      if (!isValidClass(body.className)) {
        return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
      }
      payload.className = body.className;
    }
    if ('date' in body) {
      if (!isValidScheduleDate(body.date)) {
        return Response.json({ error: 'Tanggal absensi harus jatuh pada Hari Minggu.' }, { status: 400 });
      }
      payload.date = body.date;
    }
    if ('entries' in body) {
      const entries = normalizeAttendanceEntries(body.entries);
      if (!isValidAttendanceEntries(entries)) {
        return Response.json({ error: 'Daftar kehadiran tidak valid.' }, { status: 400 });
      }
      payload.entries = entries;
    }
    const item = await updateAttendance(id, payload);
    if (!item) return Response.json({ error: 'Absensi tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'attendance',
      action: 'update',
      detail: `Memperbarui absensi kelas ${item.className} (${item.date}).`,
    }).catch(() => {});
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/attendance PUT]', error);
    return Response.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getAttendanceById(id);
    if (!item) return Response.json({ error: 'Absensi tidak ditemukan.' }, { status: 404 });
    const ok = await deleteAttendance(id);
    if (!ok) return Response.json({ error: 'Absensi tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'attendance',
      action: 'delete',
      detail: `Menghapus absensi kelas ${item.className} (${item.date}).`,
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/attendance DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
