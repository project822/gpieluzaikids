import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/token';
import { CSRF_COOKIE } from '@/lib/security';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
  // Hapus juga cookie CSRF — token dibuat ulang saat halaman admin dimuat.
  res.cookies.set(CSRF_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
