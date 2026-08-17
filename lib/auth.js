// Helper autentikasi yang hanya berjalan di runtime Node (route handlers).
// SECURITY.md § 3.8: password disimpan sebagai hash, bukan plaintext.
// Mendukung env ADMIN_PASSWORD_HASH (format scrypt$<salt-hex>$<hash-hex>);
// fallback ke ADMIN_PASSWORD biasa dengan perbandingan konstan-waktu.
import { createHash, timingSafeEqual, randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';
import { signToken, verifyToken, TOKEN_COOKIE, TOKEN_MAX_AGE, DEFAULT_SECRET } from './token';

const scrypt = promisify(_scrypt);
const SCRYPT_KEYLEN = 64;

export function adminCredentials() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.ADMIN_USERNAME || (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH))
  ) {
    throw new Error(
      'ADMIN_USERNAME serta ADMIN_PASSWORD atau ADMIN_PASSWORD_HASH wajib diisi di produksi — jangan memakai kredensial default.'
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASSWORD === 'eluzai123') {
    throw new Error('ADMIN_PASSWORD tidak boleh memakai nilai default di produksi.');
  }
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'eluzai123',
  };
}

// Perbandingan konstan-waktu untuk mencegah timing attack.
export function safeCompare(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// Buat hash scrypt untuk disimpan di env ADMIN_PASSWORD_HASH:
//   node -e "require('./lib/auth.js').hashPassword('rahasia').then(console.log)"
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(String(password || ''), Buffer.from(salt, 'hex'), SCRYPT_KEYLEN);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

// Verifikasi password terhadap hash scrypt yang tersimpan (env ADMIN_PASSWORD_HASH
// maupun passwordHash user di database — format scrypt$<salt-hex>$<hash-hex>).
export async function verifyStoredPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = String(storedHash).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  let hash;
  try {
    hash = await scrypt(String(password || ''), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  } catch {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// Verifikasi password terhadap ADMIN_PASSWORD_HASH (jika ada).
export async function verifyPassword(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  if (!stored.startsWith('scrypt$')) {
    console.warn('[auth] ADMIN_PASSWORD_HASH format tidak dikenali — harap pakai format scrypt$<salt-hex>$<hash-hex>.');
    return false;
  }
  return verifyStoredPassword(password, stored);
}

export async function issueToken(extra = {}) {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SECRET) {
    throw new Error('ADMIN_SECRET wajib diisi di produksi. Buat dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_SECRET === DEFAULT_SECRET) {
    throw new Error('ADMIN_SECRET tidak boleh memakai nilai default di produksi.');
  }
  return signToken({ role: 'admin', ...extra });
}

export function tokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
    priority: 'high', // cookie sesi penting → prioritas tinggi (Set-Cookie Priority)
  };
}

// Guard untuk route handler API admin. Contoh:
//   const auth = await requireAdmin(request);
//   if (!auth.ok) return auth.response;
// Mengembalikan username (sub JWT) agar route bisa mencatat log aktivitas.
export async function requireAdmin(request) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return { ok: false, response: Response.json({ error: 'Tidak terautentikasi' }, { status: 401 }) };
  }
  const payload = await verifyToken(token);
  if (!payload || !['admin', 'superadmin'].includes(payload.role)) {
    return { ok: false, response: Response.json({ error: 'Sesi tidak valid' }, { status: 401 }) };
  }
  return { ok: true, username: String(payload.sub || ''), role: payload.role };
}
