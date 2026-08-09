// Token JWT untuk sesi admin.
// File ini TIDAK mengimpor modul Node murni (crypto, bcrypt, dsb)
// sehingga aman dipakai di proxy (edge runtime).

import { SignJWT, jwtVerify } from 'jose';

export const DEFAULT_SECRET = 'eluzai-dev-secret-ganti-di-produksi';

export const TOKEN_COOKIE = 'eluzai_token';
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export function getSecret() {
  const secret = process.env.ADMIN_SECRET;
  // Fail-closed: di produksi, secret WAJIB diisi dan TIDAK boleh memakai
  // nilai default (yang publik di repo). Tanpa ini, token JWT bisa
  // dipalsukan oleh siapa pun yang tahu DEFAULT_SECRET bila deployment
  // tidak mengonfigurasi ADMIN_SECRET dengan benar.
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('ADMIN_SECRET wajib diisi di produksi.');
    }
    if (secret === DEFAULT_SECRET) {
      throw new Error('ADMIN_SECRET tidak boleh memakai nilai default di produksi.');
    }
  }
  return new TextEncoder().encode(secret || DEFAULT_SECRET);
}

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}
