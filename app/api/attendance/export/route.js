import { getAttendanceByDate, getAttendanceByMonth } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import {
  formatSundayLabel,
  formatDateLabel,
  formatMonthLabel,
} from '@/lib/attendanceValidation';
import { buildExcel, buildPdf, buildMonthExcel, buildMonthPdf } from '@/lib/attendanceExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/attendance/export
//   ?type=excel|pdf&date=YYYY-MM-DD   → rekap SATU Minggu (semua kelas)
//   ?type=excel|pdf&month=YYYY-MM     → rekap SATU BULAN (semua sesi)
// Nama file mengikuti format Indonesia:
//   "Rekap Kehadiran 9 Agustus 2026.xlsx"  (per tanggal)
//   "Rekap Kehadiran Agustus 2026.xlsx"    (per bulan)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get('type');
    const date = sp.get('date') || '';
    const month = sp.get('month') || '';

    if (!['excel', 'pdf'].includes(type)) {
      return Response.json({ error: 'Jenis export tidak valid (excel/pdf).' }, { status: 400 });
    }
    if ((!date && !month) || (date && month)) {
      return Response.json(
        { error: 'Berikan salah satu parameter: ?date=YYYY-MM-DD atau ?month=YYYY-MM.' },
        { status: 400 }
      );
    }
    if (date && !isValidScheduleDate(date)) {
      return Response.json({ error: 'Pilih tanggal Hari Minggu untuk export.' }, { status: 400 });
    }
    if (month && !MONTH_RE.test(month)) {
      return Response.json({ error: 'Parameter month harus format YYYY-MM.' }, { status: 400 });
    }

    let sessions;
    let label; // bagian nama file setelah "Rekap Kehadiran "
    let title; // judul di dalam dokumen
    if (date) {
      sessions = await getAttendanceByDate(date);
      label = formatDateLabel(date);
      title = `Rekap Kehadiran Minggu, ${label}`;
    } else {
      sessions = await getAttendanceByMonth(month);
      label = formatMonthLabel(month);
      title = `Rekap Kehadiran ${label}`;
    }

    const filled = sessions.filter((s) => (s.entries || []).length > 0);
    if (filled.length === 0) {
      return Response.json(
        {
          error: date
            ? `Belum ada data absensi untuk Minggu ${formatSundayLabel(date)}.`
            : `Belum ada data absensi untuk bulan ${label}.`,
        },
        { status: 404 }
      );
    }

    let buffer;
    if (type === 'excel') {
      buffer = date ? await buildExcel(filled, date) : await buildMonthExcel(filled, month);
    } else {
      buffer = date ? buildPdf(filled, date) : buildMonthPdf(filled, month);
    }
    const ext = type === 'excel' ? 'xlsx' : 'pdf';
    const filename = `Rekap Kehadiran ${label}.${ext}`;
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
