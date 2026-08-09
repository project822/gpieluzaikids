/** @type {import('next').NextConfig} */

import fs from 'node:fs';
import path from 'node:path';

// .env.local harus menjadi sumber kebenaran untuk variabel yang ia definisikan
// (nilai tidak kosong). Loader env Next.js (dotenv) TIDAK menimpa process.env
// yang sudah terisi dari environment luar — mis. sisa variabel sesi lama
// (ADMIN_SECRET default) akan selalu menang atas .env.local. Fungsi ini memaksa
// nilai dari file env menggantikan nilai lingkungan yang sudah ada.
// Catatan: nilai KOSONG dilewati (env luar tetap menang), dan file dengan
// prioritas lebih tinggi (.env.<mode>.local) diterapkan setelah .env.local.
function parseEnvFile(filePath) {
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.length >= 2) {
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }
    if (val !== '') out[m[1]] = val;
  }
  return out;
}

function applyEnvFileOverrides() {
  try {
    const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    // Urutan menaik prioritas: .env.local lalu .env.<mode>.local (yang terakhir menang).
    for (const file of ['.env.local', `.env.${mode}.local`]) {
      const envPath = path.join(process.cwd(), file);
      if (!fs.existsSync(envPath)) continue;
      for (const [key, value] of Object.entries(parseEnvFile(envPath))) {
        process.env[key] = value;
      }
    }
  } catch {
    // Jangan pernah menggagalkan startup karena masalah pembacaan file env.
  }
}
applyEnvFileOverrides();

const isProduction = process.env.NODE_ENV === 'production';

// Security headers — SECURITY.md § 3.1 (CSP, HSTS, clickjacking, dll.).
// Catatan: script-src 'unsafe-eval' hanya untuk dev (webpack HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Google Maps embed (iframe lokasi di halaman depan)
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS hanya di produksi (localhost dev tidak membutuhkannya)
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  // Jangan ekspos versi framework (X-Powered-By) — kecil tapi rapi.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // API selalu dinamis → jangan di-cache (SECURITY.md § 3.13).
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
