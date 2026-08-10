import {
  getAttendance,
  getAttendanceByClassDate,
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

// GET /api/attendance — data HANYA untuk admin (tidak tampil di publik) → wajib login.
// - tanpa query            → riwayat yang TAMPIL: sesi 1 bulan terakhir (30 hari)
// - ?all=1                 → semua sesi (tidak dibatasi jendela waktu)
// - ?class=baby&date=...   → lookup satu sesi (preload form absensi)
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const className = sp.get('class') || '';
    const date = sp.get('date') || '';

    if (className && date) {
      if (!isValidClass(className) || !isValidScheduleDate(date)) {
        return Response.json({ error: 'Parameter kelas/tanggal tidak valid.' }, { status: 400 });
      }
      const item = await getAttendanceByClassDate(className, date);
      return Response.json({ data: item ? [item] : [] });
    }

    const all = sp.get('all') === '1';
    // Jendela default 1 bulan (30 hari) — data lama tetap aman di database.
    const days = Math.min(365, Math.max(1, Number(sp.get('days')) || 30));
    let list = await getAttendance({ recentDays: days, all });
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
