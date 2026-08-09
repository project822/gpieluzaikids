import { getSchedules, createSchedule, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidScheduleDate } from '@/lib/scheduleValidation';

export async function GET() {
  try {
    const list = await getSchedules();
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/schedules GET]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    if (!body.date) {
      return Response.json({ error: 'Tanggal wajib diisi.' }, { status: 400 });
    }
    if (!isValidScheduleDate(body.date)) {
      return Response.json(
        { error: 'Tanggal jadwal harus jatuh pada Hari Minggu.' },
        { status: 400 }
      );
    }
    const item = await createSchedule({
      date: body.date,
      ibadahAda: Boolean(body.ibadahAda),
      ibadahTime: String(body.ibadahTime || '').slice(0, 40),
      latihanAda: Boolean(body.latihanAda),
      latihanTime: String(body.latihanTime || '').slice(0, 40),
    });
    logActivity({
      username: auth.username,
      module: 'schedule',
      action: 'create',
      detail: `Menyimpan jadwal mingguan ${body.date}.`,
    }).catch(() => {});
    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/schedules POST]', error);
    return Response.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
