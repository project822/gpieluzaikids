import { getRegistrations, clearRegistrations } from '@/lib/repo';
import { requireDevKey } from '@/lib/devApi';

// ============================================================
// Registrasi pendaftaran untuk Dev Console (menu Registration).
// GET    /api/dev/registrations?eventId=...  → daftar pendaftar
// DELETE /api/dev/registrations?eventId=...  → hapus semua pendaftar event
// Diotentikasi dengan kunci X-Dev-Key (bukan sesi admin).
// ============================================================

export async function GET(request) {
  const denied = requireDevKey(request, 'GET pendaftaran');
  if (denied) return denied;
  try {
    const eventId = request.nextUrl.searchParams.get('eventId') || '';
    const list = await getRegistrations({ eventId });
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/dev/registrations GET]', error);
    return Response.json({ error: 'Gagal memuat data pendaftaran.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = requireDevKey(request, 'DELETE pendaftaran');
  if (denied) return denied;
  try {
    const eventId = request.nextUrl.searchParams.get('eventId') || '';
    if (!eventId) {
      return Response.json({ error: 'Parameter eventId wajib.' }, { status: 400 });
    }
    const deleted = await clearRegistrations(eventId);
    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error('[api/dev/registrations DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data pendaftaran.' }, { status: 500 });
  }
}
