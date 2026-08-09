import { getAttendance, deleteAttendance, logActivity } from '@/lib/repo';
import { requireDevKey } from '@/lib/devApi';

// ============================================================
// Detail & kelola sesi absensi untuk Dev Console (project /dev).
// GET    /api/dev/attendance?month=YYYY-MM → daftar sesi (hari/tanggal)
//        per bulan — persis seperti daftar Riwayat Absensi di admin.
// DELETE /api/dev/attendance?id=...        → hapus SATU sesi absensi.
// Diotentikasi dengan kunci X-Dev-Key (bukan sesi admin).
// ============================================================

export async function GET(request) {
  const denied = requireDevKey(request, 'GET detail absensi');
  if (denied) return denied;
  try {
    const month = request.nextUrl.searchParams.get('month') || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: 'Parameter month wajib (format YYYY-MM).' }, { status: 400 });
    }
    const sessions = await getAttendance({ all: true });
    const list = sessions
      .filter((s) => String(s.date || '').startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.className).localeCompare(String(b.className)))
      .map((s) => ({
        id: s.id,
        className: s.className,
        date: s.date,
        entries: (s.entries || []).map((e) => ({
          name: e.name || '',
          present: Boolean(e.present),
        })),
      }));
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/dev/attendance GET]', error);
    return Response.json({ error: 'Gagal memuat detail absensi.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = requireDevKey(request, 'DELETE sesi absensi');
  if (denied) return denied;
  try {
    const id = request.nextUrl.searchParams.get('id') || '';
    if (!id) {
      return Response.json({ error: 'Parameter id wajib.' }, { status: 400 });
    }
    const ok = await deleteAttendance(id);
    if (!ok) {
      return Response.json({ error: 'Sesi absensi tidak ditemukan.' }, { status: 404 });
    }
    logActivity({
      module: 'attendance',
      action: 'delete',
      detail: 'Menghapus satu sesi absensi via Dev Console.',
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/dev/attendance DELETE]', error);
    return Response.json({ error: 'Gagal menghapus sesi absensi.' }, { status: 500 });
  }
}
