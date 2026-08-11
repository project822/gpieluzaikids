// Proxy (Next.js 16, menggantikan konvensi middleware lama):
// Lapisan keamanan request-level (dari SECURITY.md):
//   - Blocked IP                          → 403 (env BLOCKED_IPS + runtime state)
//   - Maintenance mode (halaman publik)   → 503 (teks & status dari runtime state)
//   - Origin/CORS whitelist (API)         → 403 (state-changing, origin beda)
//   - Body size limit (API)               → 413 (anti DoS)
//   - CSRF double-submit (API)            → 403 (header X-CSRF-Token = cookie)
//   - Proteksi rute /admin (auth JWT)
//   - Penyediaan cookie CSRF bila belum ada
//
// Catatan runtime: maintenance mode, teks halaman maintenance, dan
// blocked IP dibaca dari lib/runtimeState.js (file JSON kecil di
// data/dev-state.json) sehingga project /dev bisa mengubahnya
// real-time tanpa restart. File ini memakai fs sinkron → proxy
// harus berjalan di Node.js runtime (default Next.js 16). Bila
// project ini di-deploy dengan edge proxy (Vercel),
// lib/runtimeState perlu diganti fallback env. Sisanya (token JWT
// & CSRF) tetap edge-safe via lib/token.js & lib/security.js.

import { NextResponse } from 'next/server';
import { verifyToken, TOKEN_COOKIE } from '@/lib/token';
import {
  CSRF_COOKIE,
  csrfCookieOptions,
  generateCsrfToken,
  csrfMatches,
  getClientIp,
} from '@/lib/security';
import { maintenanceEnabled, isIpBlocked, isDeviceBlocked, getMaintenanceText } from '@/lib/runtimeState';
import { logSecurityEvent } from '@/lib/securityLog';
import { createWriteRateLimit } from '@/lib/rateLimit';

const STATE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Rate limit tulis API: generous (default 120/menit per IP) agar situs tetap
// normal saat diakses puluhan pengguna bersamaan, tetapi membendung lonjakan
// tulis dari satu sumber (script/DoS). Bisa diubah via env
// RATE_LIMIT_WRITES_PER_MIN (0 = nonaktif).
const writeLimitMax = Number(process.env.RATE_LIMIT_WRITES_PER_MIN);
const writeRateLimit = createWriteRateLimit({
  // 0 benar-benar menonaktifkan (Number('0') = 0, bukan falsy → fallback 120).
  max: Number.isFinite(writeLimitMax) && writeLimitMax >= 0 ? writeLimitMax : 120,
});

// Batas ukuran body (anti DoS) — SECURITY.md § 3.4.
// Login kecil; rute gambar menerima data-URL base64 besar.
const BODY_LIMITS = {
  login: 100 * 1024, // 100kb
  image: 8 * 1024 * 1024, // 8MB (base64 data-URL gambar + JSON)
  default: 100 * 1024,
};

function bodyLimitFor(pathname) {
  if (pathname === '/api/auth/login') return BODY_LIMITS.login;
  if (pathname.startsWith('/api/events') || pathname.startsWith('/api/banners')) {
    return BODY_LIMITS.image;
  }
  return BODY_LIMITS.default;
}

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// Halaman status (maintenance 503 / blocked 403) — desain sederhana &
// profesional. Emoji gerigi (⚙️/🔧) berputar di tempat (wrap flex +
// transform-origin di tengah, tanpa bergeser).
function statusPage({ title, message, footer = '', status, icon = '⚙️' }) {
  const footerHtml = footer ? `<p class="footer">${escapeHtml(footer)}</p>` : '';
  const isGear = icon === '⚙️' || icon === '🔧';
  const iconClass = isGear ? 'gear' : 'static-icon';
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @font-face {
    font-family: "Inter";
    src: url("/fonts/inter-400.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Inter";
    src: url("/fonts/inter-700.woff2") format("woff2");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Hanken Grotesk";
    src: url("/fonts/hanken-grotesk-700.woff2") format("woff2");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #f6f8f5 0%, #eef3f0 100%);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #22302c;
    -webkit-font-smoothing: antialiased;
    padding: 1.5rem;
  }
  .card {
    text-align: center;
    background: #ffffff;
    border: 1px solid #e3e7df;
    border-radius: 20px;
    box-shadow: 0 18px 50px rgba(15, 40, 35, 0.08);
    padding: 3rem 2.5rem;
    max-width: 520px;
    width: 100%;
  }
  /* Penampung transparan — gerigi berputar di tengah tanpa bergeser,
     tanpa lingkaran background. */
  .gear-wrap {
    width: 92px;
    height: 92px;
    margin: 0 auto 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gear {
    font-size: 3rem;
    width: 1em;
    height: 1em;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: 50% 50%;
    animation: spin 12s linear infinite;
  }
  .static-icon {
    font-size: 3rem;
    line-height: 1;
    display: block;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  h1 {
    font-family: "Hanken Grotesk", "Inter", sans-serif;
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #16231f;
    margin-bottom: 0.6rem;
  }
  p.message {
    color: #5f6f6a;
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 0;
  }
  p.footer {
    margin-top: 1.8rem;
    padding-top: 1.2rem;
    border-top: 1px solid #eef2ef;
    color: #8a9994;
    font-size: 0.88rem;
  }
  @media (max-width: 480px) {
    .card { padding: 2.2rem 1.5rem; border-radius: 16px; }
    .gear-wrap { width: 80px; height: 80px; }
    .gear, .static-icon { font-size: 2.6rem; }
    h1 { font-size: 1.4rem; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="gear-wrap">
      <span class="${iconClass}" aria-hidden="true">${escapeHtml(icon)}</span>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${escapeHtml(message)}</p>
    ${footerHtml}
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const ip = getClientIp(request);
  const deviceId = request.headers.get('x-device-id') || '';

  const isApi = pathname.startsWith('/api/');
  const isAdmin = pathname.startsWith('/admin');
  // Endpoint khusus project /dev (mesin-ke-mesin): autentikasi via kunci
  // bersama DEV_API_KEY (X-Dev-Key), bukan sesi/CSRF browser.
  const isDevApi = pathname.startsWith('/api/dev/');

  // 1) Blocked IP — semua rute ditolak 403 (audit trail §3.11).
  if (await isIpBlocked(ip)) {
    logSecurityEvent({ type: 'blocked_ip', ip, path: pathname, detail: 'IP diblokir' });
    return statusPage({
      title: '403 — Akses Ditolak',
      message: 'IP Anda telah diblokir.',
      status: 403,
      icon: '🔒',
    });
  }

  // 1b) Blocked device (fingerprint / "MAC") — halaman admin & API.
  //     ID perangkat dikirim browser via header X-Device-Id (lib/csrfClient)
  //     pada setiap request admin. Blokir berlaku real-time (cache
  //     write-through di lib/runtimeState.js).
  if ((isApi || isAdmin) && deviceId && (await isDeviceBlocked(deviceId))) {
    logSecurityEvent({
      type: 'blocked_device',
      ip,
      path: pathname,
      detail: `perangkat diblokir: ${deviceId.slice(0, 16)}…`,
    });
    return isApi
      ? jsonError('Akses dari perangkat ini diblokir.', 403)
      : statusPage({
          title: '403 — Akses Ditolak',
          message: 'Perangkat Anda telah diblokir.',
          status: 403,
          icon: '🔒',
        });
  }

  // 2) Maintenance mode — hanya halaman publik; /admin & /api tetap
  //    diizinkan (SECURITY.md § 3.10). Teks halaman bisa diedit dari
  //    dashboard /dev (data/dev-state.json). Catatan: /img tidak pernah
  //    sampai ke proxy (dikecualikan di matcher), jadi aset gambar jalan.
  if (await maintenanceEnabled() && !isApi && !isAdmin) {
    const text = await getMaintenanceText();
    return statusPage({
      title: text.title,
      message: text.message,
      footer: text.footer,
      status: 503,
      icon: '⚙️',
    });
  }

  const isStateChanging = STATE_METHODS.includes(method);

  // 3) Proteksi API state-changing.
  if (isApi && isStateChanging) {
    // a) Origin/CORS whitelist: request dari origin asing ditolak.
    //    Dikecualikan untuk /api/dev (mesin-ke-mesin dengan kunci sendiri).
    if (!isDevApi) {
      const origin = request.headers.get('origin');
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== request.nextUrl.host) {
            logSecurityEvent({ type: 'csrf', ip, path: pathname, detail: `origin tidak cocok (${originHost})` });
            return jsonError('Asal permintaan tidak diizinkan.', 403);
          }
        } catch {
          logSecurityEvent({ type: 'csrf', ip, path: pathname, detail: `origin tidak valid (${origin})` });
          return jsonError('Asal permintaan tidak valid.', 403);
        }
      }
    }

    // b) Body size limit (Content-Length) — anti DoS.
    //    Catatan: ini pertahanan berlapis (defense-in-depth) karena header
    //    Content-Length bisa dihilangkan/dipalsukan; platform serverless
    //    (Vercel) juga memberlakukan batas body-nya sendiri.
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > bodyLimitFor(pathname)) {
      return jsonError('Ukuran payload melebihi batas.', 413);
    }

    // c) CSRF double-submit — kecuali login (belum punya token) dan
    //    /api/dev (dilindungi kunci DEV_API_KEY, bukan sesi browser).
    if (!isDevApi && pathname !== '/api/auth/login') {
      const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
      const headerToken = request.headers.get('x-csrf-token');
      if (!(await csrfMatches(cookieToken, headerToken))) {
        logSecurityEvent({ type: 'csrf', ip, path: pathname, detail: 'token CSRF tidak cocok' });
        return jsonError('Token CSRF tidak valid.', 403);
      }
    }

    // d) Rate limit tulis per-IP (anti DoS ringan) — login tetap memakai
    //    rate limit khusus yang lebih ketat di route-nya sendiri.
    if (pathname !== '/api/auth/login' && writeRateLimit.max > 0) {
      const check = writeRateLimit(ip);
      if (!check.allowed) {
        logSecurityEvent({ type: 'rate_limit_write', ip, path: pathname });
        return jsonError('Terlalu banyak permintaan. Coba lagi sebentar lagi.', 429);
      }
    }
  }

  // 4) Autentikasi halaman /admin (JWT cookie httpOnly).
  //    Verifikasi hanya dilakukan untuk rute /admin — halaman publik
  //    (termasuk /img) tidak perlu pemborosan verifikasi JWT.
  let valid = false;
  if (isAdmin) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    if (token) {
      const payload = await verifyToken(token);
      valid = Boolean(payload);
    }
  }

  let response;

  // Halaman login: jika sudah login, arahkan ke dashboard.
  if (pathname === '/admin/login') {
    response = valid ? NextResponse.redirect(new URL('/admin', request.url)) : NextResponse.next();
  } else if (pathname.startsWith('/admin')) {
    // Rute admin lainnya: wajib login.
    if (!valid) {
      const url = new URL('/admin/login', request.url);
      url.searchParams.set('from', pathname);
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // 5) Pastikan cookie CSRF tersedia — HANYA untuk halaman admin & API.
  //    Aset publik (/img) tidak mendapat Set-Cookie (biar gambar bisa
  //    di-cache CDN/browser tanpa respons ber-cookie).
  if ((isAdmin || isApi) && !request.cookies.get(CSRF_COOKIE)?.value) {
    response.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieOptions());
  }

  return response;
}

export const config = {
  // Jalankan di semua rute non-statis agar maintenance & blocked IP
  // berlaku untuk seluruh situs, dan CSRF/body-limit untuk /api.
  // /img (gambar publik) DILEWATI proxy — setara aset statis, jalur
  // tercepat untuk gambar yang di-cache browser.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|/img/|.*\\..*).*)'],
};
