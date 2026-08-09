import { NextResponse } from 'next/server';
import {
  adminCredentials,
  safeCompare,
  issueToken,
  tokenCookieOptions,
  verifyPassword,
  verifyStoredPassword,
} from '@/lib/auth';
import { TOKEN_COOKIE } from '@/lib/token';
import { rateLimitLogin, resetLoginAttempts } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/security';
import { logSecurityEvent } from '@/lib/securityLog';
import { findUserByUsername, isDbEnabled, updateUser, logActivity } from '@/lib/repo';

// Rate limiting login — SECURITY.md § 3.7: 5 percobaan / 15 menit,
// blokir 10 menit (dimensi IP, username, IP+username).
const loginCheck = rateLimitLogin({ windowMs: 15 * 60 * 1000, max: 5, blockMs: 10 * 60 * 1000 });

// Batas waktu cek user database — bila MongoDB lambat/putus, login tidak
// menggantung; cukup jatuh ke kredensial env (super admin) setelah 5 detik.
function withTimeout(promise, ms, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        if (onTimeout) onTimeout();
        resolve(null);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function POST(request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';
  try {
    const body = await request.json();
    // Normalisasi username (trim + huruf kecil) — "Admin", " admin ", dll. tetap masuk.
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    // 1) Rate limit — sebelum verifikasi (murah) untuk blokir brute-force.
    const { allowed, retryAfter } = loginCheck({ ip, username });
    if (!allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        ip,
        path: '/api/auth/login',
        userAgent,
        detail: `terlalu banyak percobaan (${username || 'tanpa username'})`,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
      );
    }

    // 2) Verifikasi kredensial — user DATABASE dulu (multi-user), lalu
    //    kredensial env (ADMIN_USERNAME/ADMIN_PASSWORD) sebagai cadangan
    //    super-admin bila user database tidak cocok.
    let identity = null;
    if (isDbEnabled()) {
      // Timeout 5 detik: DB yang lambat/putus tidak menghalangi login.
      const user = await withTimeout(findUserByUsername(username), 5000, () =>
        console.warn('[api/login] MongoDB lookup melebihi 5 detik — fallback ke kredensial env (super admin).')
      );
      if (user) {
        const passwordOk = await verifyStoredPassword(password, user.passwordHash);
        if (passwordOk && user.active !== false) {
          identity = { source: 'db', id: user.id, username: user.username, role: user.role || 'admin' };
        }
      }
    }
    if (!identity) {
      let creds;
      try {
        creds = adminCredentials();
      } catch (err) {
        // Konfigurasi produksi belum lengkap — pesan jelas, bukan 500 generik.
        console.error('[api/login]', err.message);
        return NextResponse.json(
          {
            error:
              'Kredensial admin belum dikonfigurasi di server. Periksa ADMIN_USERNAME serta ADMIN_PASSWORD / ADMIN_PASSWORD_HASH.',
          },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      const usernameOk = safeCompare(username.toLowerCase(), String(creds.username || '').toLowerCase());
      // Jika ADMIN_PASSWORD_HASH diset, verifikasi via scrypt; jika tidak,
      // fallback ke perbandingan konstan-waktu terhadap ADMIN_PASSWORD.
      const passwordOk = process.env.ADMIN_PASSWORD_HASH
        ? await verifyPassword(password)
        : safeCompare(password, creds.password);
      if (usernameOk && passwordOk) {
        identity = { source: 'env', username: creds.username, role: 'superadmin' };
      }
    }

    if (!identity) {
      logSecurityEvent({
        type: 'failed_login',
        ip,
        path: '/api/auth/login',
        userAgent,
        detail: `username=${username || '(kosong)'}`,
      });
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3) Login sukses — reset riwayat percobaan & terbitkan token sesi.
    //    Cookie CSRF (eluzai_csrf) sudah dijamin ada oleh proxy.js untuk
    //    setiap respons — tidak perlu di-set dua kali di sini.
    resetLoginAttempts({ ip, username: username || '' });

    // Catat waktu & IP login terakhir (untuk dashboard /dev) — tidak
    // menghalangi respons bila penyimpanan gagal.
    if (identity.source === 'db' && identity.id) {
      updateUser(identity.id, { lastLoginAt: new Date(), lastLoginIp: ip }).catch((err) =>
        console.warn('[api/login] Gagal mencatat last login:', err.message)
      );
    }

    let token;
    try {
      token = await issueToken({ sub: identity.username });
    } catch (err) {
      // Konfigurasi produksi belum lengkap (ADMIN_SECRET) — pesan jelas,
      // bukan 500 generik yang membingungkan.
      console.error('[api/login] Gagal menerbitkan token:', err.message);
      return NextResponse.json(
        {
          error:
            'Konfigurasi server belum lengkap: ADMIN_SECRET belum diatur atau masih memakai nilai default. Tambahkan env ADMIN_SECRET (hex acak) di Vercel lalu redeploy.',
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    logActivity({
      username: identity.username,
      module: 'auth',
      action: 'login',
      detail: `Login berhasil${identity.source === 'env' ? ' (super admin)' : ''}.`,
    }).catch(() => {});
    const res = NextResponse.json({ ok: true });
    res.cookies.set(TOKEN_COOKIE, token, tokenCookieOptions());
    return res;
  } catch (error) {
    console.error('[api/login]', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
