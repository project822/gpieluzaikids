import { findUserByUsername, createUser, listUsers, isDbEnabled } from '@/lib/repo';
import { hashPassword } from '@/lib/auth';
import { requireDevKey } from '@/lib/devApi';
import { logSecurityEvent } from '@/lib/securityLog';
import { getClientIp } from '@/lib/security';

// Endpoint khusus project /dev (project terpisah) untuk mengelola user admin.
// Autentikasi memakai kunci rahasia bersama (env DEV_API_KEY) lewat header
// X-Dev-Key — BUKAN sesi admin biasa. CSRF tidak berlaku di sini (proxy.js
// mengecualikan /api/dev/*), karena pemanggilnya mesin-ke-mesin.

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export async function GET(request) {
  const denied = requireDevKey(request, 'GET users');
  if (denied) return denied;
  try {
    const users = (await listUsers()).map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt || null,
      lastLoginIp: u.lastLoginIp || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
    return Response.json({ data: users });
  } catch (error) {
    console.error('[api/dev/users GET]', error);
    return Response.json({ error: 'Gagal memuat user.' }, { status: 500 });
  }
}

export async function POST(request) {
  const ip = getClientIp(request);
  const denied = requireDevKey(request, 'POST users');
  if (denied) return denied;
  try {
    const body = await request.json();
    const username = String(body?.username || '').toLowerCase().trim();
    const password = String(body?.password || '');

    if (!USERNAME_RE.test(username)) {
      return Response.json(
        { error: 'Username 3–30 karakter (huruf, angka, titik, garis, underscore).' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return Response.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    if (isDbEnabled() && (await findUserByUsername(username))) {
      return Response.json({ error: 'Username sudah terdaftar.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ username, passwordHash, role: body?.role === 'superadmin' ? 'superadmin' : 'admin' });
    logSecurityEvent({
      type: 'dev_api',
      ip,
      path: '/api/dev/users',
      detail: `user dibuat: ${user.username}`,
    });
    return Response.json(
      {
        data: { id: user.id, username: user.username, role: user.role, active: user.active },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/dev/users POST]', error);
    return Response.json({ error: 'Gagal membuat user.' }, { status: 500 });
  }
}
