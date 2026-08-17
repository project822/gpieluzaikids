import { getAttendanceByDate, getAttendanceByMonth, getAttendanceByYear } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import {
  classLabel,
  formatSundayLabel,
  formatDateLabel,
  formatMonthLabel,
  isValidClass,
} from '@/lib/attendanceValidation';
import {
  buildExcel,
  buildPdf,
  buildMonthExcel,
  buildMonthPdf,
  buildYearExcel,
  buildYearPdf,
} from '@/lib/attendanceExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

// GET /api/attendance/export
//   ?type=excel|pdf|graphics&date=YYYY-MM-DD         → rekap SATU Minggu
//   ?type=excel|pdf|graphics&month=YYYY-MM           → rekap SATU BULAN
//   ?type=excel|pdf|graphics&year=YYYY               → rekap SATU TAHUN
// Nama file mengikuti format Indonesia:
//   "Rekap Kehadiran 9 Agustus 2026.xlsx"  (per tanggal)
//   "Rekap Kehadiran Agustus 2026.xlsx"    (per bulan)
//   "Rekap Kehadiran 2026.xlsx"            (per tahun)
//   "Grafik Kehadiran Agustus 2026.xlsx"   (grafik bulanan)
//   "Grafik Kehadiran 2026.xlsx"           (grafik tahunan)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get('type');
    const date = sp.get('date') || '';
    const month = sp.get('month') || '';
    const year = sp.get('year') || '';
    const className = sp.get('class') || '';

    if (!['excel', 'pdf', 'graphics'].includes(type)) {
      return Response.json({ error: 'Jenis export tidak valid (excel/pdf/graphics).' }, { status: 400 });
    }
    const paramCount = [date, month, year].filter(Boolean).length;
    if (paramCount !== 1) {
      return Response.json(
        { error: 'Berikan salah satu: ?date=YYYY-MM-DD, ?month=YYYY-MM, atau ?year=YYYY.' },
        { status: 400 }
      );
    }
    if (date && !isValidScheduleDate(date)) {
      return Response.json({ error: 'Pilih tanggal Hari Minggu untuk export.' }, { status: 400 });
    }
    if (month && !MONTH_RE.test(month)) {
      return Response.json({ error: 'Parameter month harus format YYYY-MM.' }, { status: 400 });
    }
    if (year && !YEAR_RE.test(year)) {
      return Response.json({ error: 'Parameter year harus format YYYY.' }, { status: 400 });
    }

    let sessions;
    let label;
    let title;
    if (date) {
      sessions = await getAttendanceByDate(date);
      label = formatDateLabel(date);
      title = `Rekap Kehadiran Minggu, ${label}`;
    } else if (month) {
      sessions = await getAttendanceByMonth(month);
      label = formatMonthLabel(month);
      title = `Rekap Kehadiran ${label}`;
    } else {
      sessions = await getAttendanceByYear(year);
      label = year;
      title = `Rekap Kehadiran ${year}`;
    }

    // Opsional filter per kelas
    const exportOpts = {};
    if (className) {
      if (!isValidClass(className)) {
        return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
      }
      sessions = sessions.filter((s) => s.className === className);
      if (date) {
        title = `Rekap Kehadiran ${classLabel(className)} — Minggu, ${label}`;
      } else if (month) {
        title = `Rekap Kehadiran ${classLabel(className)} — ${label}`;
      } else {
        title = `Rekap Kehadiran ${classLabel(className)} — ${year}`;
      }
      exportOpts.title = title;
    }

    const filled = sessions.filter((s) => (s.entries || []).length > 0);
    if (filled.length === 0) {
      return Response.json(
        {
          error: date
            ? `Belum ada data absensi untuk ${formatSundayLabel(date)}.`
            : month
              ? `Belum ada data absensi untuk bulan ${label}.`
              : `Belum ada data absensi untuk tahun ${year}.`,
        },
        { status: 404 }
      );
    }

    const isGraphics = type === 'graphics';
    let buffer;
    if (date) {
      // Per-tanggal: tidak ada grafik (hanya Excel/PDF)
      buffer = type === 'excel'
        ? await buildExcel(filled, date, exportOpts)
        : buildPdf(filled, date, exportOpts);
    } else if (month) {
      buffer = isGraphics
        ? await buildMonthExcel(filled, month, { ...exportOpts, chartOnly: true })
        : type === 'excel'
          ? await buildMonthExcel(filled, month, exportOpts)
          : buildMonthPdf(filled, month, exportOpts);
    } else {
      buffer = isGraphics
        ? await buildYearExcel(filled, year, { ...exportOpts, chartOnly: true })
        : type === 'excel'
          ? await buildYearExcel(filled, year, exportOpts)
          : buildYearPdf(filled, year, exportOpts);
    }

    const ext = type === 'excel' || type === 'graphics' ? 'xlsx' : 'pdf';
    const prefix = isGraphics ? 'Grafik' : 'Rekap';
    const filename = `${prefix} Kehadiran ${label}.${ext}`;
    const contentType =
      ext === 'xlsx'
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
