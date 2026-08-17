import { updateUser, deleteUser, listUsers } from '@/lib/repo';
import { hashPassword } from '@/lib/auth';
import { requireDevKey } from '@/lib/devApi';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// Kelola satu user admin dari project /dev (dashboard developer).
//   PATCH  /api/dev/users/:id  → reset password / ubah role / aktif-nonaktif
//   DELETE /api/dev/users/:id  → hapus user

export async function PATCH(request, { params }) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'PATCH user');
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    const patch = {};
    if (body?.password !== undefined && body.password !== '') {
      if (String(body.password).length < 8) {
        return Response.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
      }
      patch.passwordHash = await hashPassword(String(body.password));
    }
    if (body?.role !== undefined) {
      if (!['admin', 'superadmin'].includes(body.role)) {
        return Response.json({ error: 'Role harus admin atau superadmin.' }, { status: 400 });
      }
      patch.role = body.role;
    }
    if (body?.active !== undefined) {
      patch.active = Boolean(body.active);
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Tidak ada field yang diubah.' }, { status: 400 });
    }

    const user = await updateUser(id, patch);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: `/api/dev/users/${id}`,
      detail: `user diperbarui: ${user.username}`,
    });
    return Response.json({
      data: { id: user.id, username: user.username, role: user.role, active: user.active },
    });
  } catch (error) {
    console.error('[api/dev/users/:id PATCH]', error);
    return Response.json({ error: 'Gagal memperbarui user.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'DELETE user');
  if (denied) return denied;

  try {
    const { id } = await params;
    // Cegah menghapus akun terakhir yang aktif (biar selalu ada admin).
    const users = await listUsers();
    const target = users.find((u) => u.id === id);
    if (!target) {
      return Response.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }
    const activeOthers = users.filter((u) => u.id !== id && u.active !== false).length;
    if (target.active !== false && activeOthers === 0) {
      return Response.json(
        { error: 'Tidak bisa menghapus satu-satunya admin aktif.' },
        { status: 409 }
      );
    }

    await deleteUser(id);
    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: `/api/dev/users/${id}`,
      detail: `user dihapus: ${target.username}`,
    });
    return Response.json({ ok: true, id });
  } catch (error) {
    console.error('[api/dev/users/:id DELETE]', error);
    return Response.json({ error: 'Gagal menghapus user.' }, { status: 500 });
  }
}
