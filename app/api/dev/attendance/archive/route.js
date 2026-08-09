import { getAttendanceArchive, clearAllAttendance, logActivity } from '@/lib/repo';
import { requireDevKey } from '@/lib/devApi';

// ============================================================
// Arsip absensi tahunan untuk Dev Console (project /dev).
// GET    → statistik 12 bulan terakhir + penanda tombol hapus.
// DELETE → hapus SEMUA data absensi permanen — HANYA boleh jika
//          data sudah terakumulasi ≥ 1 tahun penuh (dicek server).
// Diotentikasi dengan kunci X-Dev-Key (bukan sesi admin).
// ============================================================

export async function GET(request) {
  const denied = requireDevKey(request, 'GET arsip absensi');
  if (denied) return denied;
  try {
    const archive = await getAttendanceArchive();
    return Response.json({ data: archive });
  } catch (error) {
    console.error('[api/dev/attendance/archive GET]', error);
    return Response.json({ error: 'Gagal memuat arsip absensi.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = requireDevKey(request, 'DELETE arsip absensi');
  if (denied) return denied;
  try {
    // Guard anti-hapus-masal: klien harus menyatakan eksplisit (?all=1) agar
    // DELETE tanpa sengaja tidak menghapus seluruh data — sama seperti
    // DELETE /api/dev/activities. Dashboard mengirim ?all=1 setelah
    // verifikasi ketik "HAPUS" di UI.
    if (request.nextUrl.searchParams.get('all') !== '1') {
      return Response.json(
        { error: 'Parameter ?all=1 diperlukan untuk menghapus seluruh data absensi.' },
        { status: 400 }
      );
    }
    const archive = await getAttendanceArchive();
    if (!archive.canDelete) {
      return Response.json(
        {
          error: archive.oldestDate
            ? 'Data absensi belum mencapai 1 tahun penuh — tombol hapus tersedia setelahnya.'
            : 'Belum ada data absensi untuk dihapus.',
        },
        { status: 400 }
      );
    }
    const deleted = await clearAllAttendance();
    // Aksi dari Dev Console — tidak ada sesi admin di sana, jadi username
    // dikosongkan (tampil sebagai '—' di log aktivitas).
    logActivity({
      module: 'attendance',
      action: 'clear',
      detail: `Menghapus seluruh data absensi (${deleted} sesi) dari database (via Dev Console).`,
    }).catch(() => {});
    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error('[api/dev/attendance/archive DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data absensi.' }, { status: 500 });
  }
}
