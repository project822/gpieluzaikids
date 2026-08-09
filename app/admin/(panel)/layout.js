import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { verifyToken, TOKEN_COOKIE } from '@/lib/token';

export const metadata = { title: 'Admin' };

// Halaman admin WAJIB dinamis: cookie sesi hanya bisa dibaca saat request
// (mencegah render statis / cache halaman admin).
export const dynamic = 'force-dynamic';

// ── Lapisan keamanan kedua (defense-in-depth) ──
// proxy.js sudah memblokir /admin tanpa sesi (redirect ke /admin/login).
// Layout ini MEMERIKSA ULANG token JWT di sisi server untuk setiap halaman
// panel — sehingga akses langsung (forced browsing, mis. /admin/events)
// tetap tertutup meskipun proxy tidak aktif pada suatu deployment.
export default async function AdminPanelLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload || !['admin', 'superadmin'].includes(payload.role)) {
    redirect('/admin/login');
  }

  return <AdminShell>{children}</AdminShell>;
}
