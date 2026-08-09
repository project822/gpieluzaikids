import { updateMember, deleteMember, getMemberById, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidClass, isValidMemberName, MEMBER_NAME_MAX } from '@/lib/attendanceValidation';

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = sanitizePayload(await request.json());
    const payload = {};
    if ('name' in body) {
      if (!isValidMemberName(body.name)) {
        return Response.json(
          { error: `Nama anggota wajib diisi (maks ${MEMBER_NAME_MAX} karakter).` },
          { status: 400 }
        );
      }
      payload.name = String(body.name).trim().slice(0, MEMBER_NAME_MAX);
    }
    if ('className' in body) {
      if (!isValidClass(body.className)) {
        return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
      }
      payload.className = body.className;
    }
    const item = await updateMember(id, payload);
    if (!item) return Response.json({ error: 'Anggota tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'member',
      action: 'update',
      detail: `Memperbarui anggota "${item.name}".`,
    }).catch(() => {});
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/members PUT]', error);
    return Response.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getMemberById(id);
    if (!item) return Response.json({ error: 'Anggota tidak ditemukan.' }, { status: 404 });
    const ok = await deleteMember(id);
    if (!ok) return Response.json({ error: 'Anggota tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'member',
      action: 'delete',
      detail: `Menghapus anggota "${item.name}".`,
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/members DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
