import { getMembers, createMember, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { isValidClass, isValidMemberName, MEMBER_NAME_MAX } from '@/lib/attendanceValidation';

// Data anggota HANYA untuk admin (tidak tampil di publik) → GET pun wajib login.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const className = request.nextUrl.searchParams.get('class') || '';
    if (className && !isValidClass(className)) {
      return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
    }
    const list = await getMembers({ className });
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/members GET]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    if (!isValidClass(body.className)) {
      return Response.json({ error: 'Kelas tidak dikenal.' }, { status: 400 });
    }
    if (!isValidMemberName(body.name)) {
      return Response.json(
        { error: `Nama anggota wajib diisi (maks ${MEMBER_NAME_MAX} karakter).` },
        { status: 400 }
      );
    }
    const item = await createMember({
      className: body.className,
      name: String(body.name).trim().slice(0, MEMBER_NAME_MAX),
    });
    logActivity({
      username: auth.username,
      module: 'member',
      action: 'create',
      detail: `Menambahkan anggota "${item.name}" (kelas ${item.className}).`,
    }).catch(() => {});
    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/members POST]', error);
    return Response.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
