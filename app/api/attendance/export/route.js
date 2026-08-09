import { getAttendanceByDate } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import { formatSundayLabel } from '@/lib/attendanceValidation';
import { buildExcel, buildPdf } from '@/lib/attendanceExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/attendance/export?type=excel|pdf&date=YYYY-MM-DD
// Rekap SATU Minggu: semua kelas digabung dalam satu file.
// Bisa export minggu kapan pun (data lama tetap aman di database).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get('type');
    const date = sp.get('date') || '';

    if (!['excel', 'pdf'].includes(type)) {
      return Response.json({ error: 'Jenis export tidak valid (excel/pdf).' }, { status: 400 });
    }
    if (!isValidScheduleDate(date)) {
      return Response.json({ error: 'Pilih tanggal Hari Minggu untuk export.' }, { status: 400 });
    }

    const sessions = await getAttendanceByDate(date);
    const filled = sessions.filter((s) => (s.entries || []).length > 0);
    if (filled.length === 0) {
      return Response.json(
        { error: `Belum ada data absensi untuk Minggu ${formatSundayLabel(date)}.` },
        { status: 404 }
      );
    }

    const buffer = type === 'excel' ? buildExcel(filled, date) : buildPdf(filled, date);
    const ext = type === 'excel' ? 'xlsx' : 'pdf';
    const filename = `rekap-kehadiran-${date}.${ext}`;
    const contentType =
      type === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength || buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/attendance/export GET]', error);
    return Response.json({ error: 'Gagal membuat file export.' }, { status: 500 });
  }
}
