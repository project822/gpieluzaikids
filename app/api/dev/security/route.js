import { requireDevKey } from '@/lib/devApi';
import { maintenanceEnabled, getBlockedIps } from '@/lib/runtimeState';
import { getRateLimitedIps } from '@/lib/rateLimit';
import { getSecurityStats } from '@/lib/securityLog';

// Daftar lapisan keamanan yang terpasang beserta statusnya.
// GET /api/dev/security — dipakai halaman Security dashboard /dev.
// Sebagian bersifat statis (terpasang di config), sebagian dinamis.

export async function GET(request) {
  const denied = requireDevKey(request, 'GET security');
  if (denied) return denied;

  const isProd = process.env.NODE_ENV === 'production';
  const stats = getSecurityStats();
  const rateLimited = getRateLimitedIps();
  const blockedIps = getBlockedIps();

  const layers = [
    {
      id: 'security_headers',
      name: 'Security Headers',
      status: 'enabled',
      protection: 'XSS, clickjacking, MIME sniffing',
      detail: 'CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (next.config.mjs).',
    },
    {
      id: 'csp',
      name: 'Content Security Policy',
      status: 'enabled',
      protection: 'XSS & injeksi skrip',
      detail: "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'.",
    },
    {
      id: 'hsts',
      name: 'HTTPS / HSTS',
      status: isProd ? 'enabled' : 'dev',
      protection: 'Downgrade HTTP & traffic plaintext',
      detail: isProd
        ? 'Strict-Transport-Security aktif (max-age 2 tahun, preload).'
        : 'HSTS hanya aktif di produksi; di dev berjalan via HTTP (localhost).',
    },
    {
      id: 'origin_whitelist',
      name: 'Origin/CORS Whitelist',
      status: 'enabled',
      protection: 'Akses API dari domain asing',
      detail: 'Semua request state-changing /api/* dengan origin berbeda ditolak 403 (proxy.js).',
    },
    {
      id: 'body_limit',
      name: 'Body Size Limit',
      status: 'enabled',
      protection: 'DoS via payload besar',
      detail: '100kb umum / 8MB upload gambar (Content-Length check di proxy.js).',
    },
    {
      id: 'csrf',
      name: 'CSRF Protection',
      status: 'enabled',
      protection: 'CSRF pada API state-changing',
      detail: `Double-submit cookie (eluzai_csrf ↔ X-CSRF-Token). Ditolak hari ini: ${stats.csrf}.`,
    },
    {
      id: 'rate_limit',
      name: 'Rate Limiting Login',
      status: 'enabled',
      protection: 'Brute-force login',
      detail: `5 percobaan/15 menit → blokir 10 menit (IP, username, IP+username). Sedang diblokir: ${rateLimited.length} IP.`,
    },
    {
      id: 'password_hashing',
      name: 'Password Hashing (scrypt)',
      status: process.env.ADMIN_PASSWORD_HASH ? 'enabled' : 'partial',
      protection: 'Kredensial bocor plaintext',
      detail: process.env.ADMIN_PASSWORD_HASH
        ? 'ADMIN_PASSWORD_HASH scrypt aktif; semua user DB di-hash scrypt.'
        : 'User DB di-hash scrypt; super-admin env masih memakai perbandingan SHA-256 (set ADMIN_PASSWORD_HASH untuk scrypt penuh).',
    },
    {
      id: 'jwt',
      name: 'Sesi Admin (JWT httpOnly)',
      status: 'enabled',
      protection: 'Session hijacking',
      detail: 'Cookie httpOnly + SameSite=Lax + Secure di produksi (7 hari).',
    },
    {
      id: 'sanitize',
      name: 'Input Sanitization',
      status: 'enabled',
      protection: 'Stored XSS via form',
      detail: 'Semua field string POST/PUT dibersihkan tag HTML (lib/sanitize.js).',
    },
    {
      id: 'security_log',
      name: 'Security Logging',
      status: 'enabled',
      protection: 'Deteksi serangan (audit trail)',
      detail: `Event 24 jam: ${stats.events24h} · login gagal: ${stats.failedLogin} · rate limit: ${stats.rateLimited} · blocked IP: ${stats.blocked}.`,
    },
    {
      id: 'maintenance_mode',
      name: 'Maintenance Mode',
      status: maintenanceEnabled() ? 'active' : 'standby',
      protection: 'Kontrol akses darurat',
      detail: maintenanceEnabled()
        ? 'AKTIF — halaman publik mengembalikan 503; /admin & /api tetap jalan.'
        : 'Nonaktif — situs melayani semua pengunjung.',
    },
    {
      id: 'blocked_ip',
      name: 'IP Blocklist',
      status: blockedIps.length > 0 ? 'active' : 'standby',
      protection: 'Blokir IP tertentu (403)',
      detail:
        blockedIps.length > 0
          ? `${blockedIps.length} IP diblokir: ${blockedIps.join(', ')}.`
          : 'Tidak ada IP di blocklist. IP yang kena rate limit login diblokir otomatis 10 menit.',
    },
  ];

  return Response.json({ ok: true, layers, stats });
}
