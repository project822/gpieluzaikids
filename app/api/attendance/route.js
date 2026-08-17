import {
  getAttendance,
  getAttendanceByClassDate,
  getAttendanceByMonth,
  upsertAttendance,
  logActivity,
} from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidScheduleDate } from '@/lib/scheduleValidation';
import {
  isValidClass,
  isValidAttendanceEntries,
  normalizeAttendanceEntries,
} from '@/lib/attendanceValidation';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/attendance — data HANYA untuk admin (tidak tampil di publik) → wajib login.
// - tanpa query            → SEMUA sesi (tidak dibatasi jendela waktu)
// - ?all=1                 → semua sesi (sama dengan tanpa query, backward compat)
// - ?month=YYYY-MM         → sesi satu bulan tertentu
// - ?class=baby&date=...   → lookup satu sesi (preload form absensi)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const className = sp.get('class') || '';
    const date = sp.get('date') || '';
    const month = sp.get('month') || '';

    if (className && date) {
      if (!isValidClass(className) || !isValidScheduleDate(date)) {
        return Response.json({ error: 'Parameter kelas/tanggal tidak valid.' }, { status: 400 });
      }
      const item = await getAttendanceByClassDate(className, date);
      return Response.json({ data: item ? [item] : [] });
    }

    // Filter per bulan tertentu
    if (month) {
      if (!MONTH_RE.test(month)) {
        return Response.json({ error: 'Parameter month harus format YYYY-MM.' }, { status: 400 });
      }
      let list = await getAttendanceByMonth(month);
      if (className) {
        if (!isValidClass(className)) {
          return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
        }
        list = list.filter((s) => s.className === className);
      }
      return Response.json({ data: list });
    }

    // Default: semua data (tanpa batasan waktu)
    let list = await getAttendance({ all: true });
    // Filter per kelas (mis. halaman /admin/baby menampilkan riwayat kelasnya saja).
    if (className) {
      if (!isValidClass(className)) {
        return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
      }
      list = list.filter((s) => s.className === className);
    }
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/attendance GET]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

// POST /api/attendance — isi/isi ulang absensi (upsert per kelas+tanggal).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    if (!isValidClass(body.className)) {
      return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
    }
    if (!isValidScheduleDate(body.date)) {
      return Response.json({ error: 'Tanggal absensi harus jatuh pada Hari Minggu.' }, { status: 400 });
    }
    const entries = normalizeAttendanceEntries(body.entries);
    if (!isValidAttendanceEntries(entries)) {
      return Response.json(
        { error: 'Belum ada anggota untuk dicatat — tambahkan anggota kelas terlebih dahulu.' },
        { status: 400 }
      );
    }
    const item = await upsertAttendance({
      className: body.className,
      date: body.date,
      entries,
    });
    const hadir = entries.filter((e) => e.present).length;
    logActivity({
      username: auth.username,
      module: 'attendance',
      action: 'create',
      detail: `Mengisi absensi kelas ${body.className} (${body.date}) — ${hadir}/${entries.length} hadir.`,
    }).catch(() => {});
    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/attendance POST]', error);
    return Response.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
