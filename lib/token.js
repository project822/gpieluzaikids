// Token JWT untuk sesi admin.
// File ini TIDAK mengimpor modul Node murni (crypto, bcrypt, dsb)
// sehingga aman dipakai di proxy (edge runtime).

import { SignJWT, jwtVerify } from 'jose';

export const DEFAULT_SECRET = 'eluzai-dev-secret-ganti-di-produksi';

export const TOKEN_COOKIE = 'eluzai_token';
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export function getSecret() {
  return new TextEncoder().encode(process.env.ADMIN_SECRET || DEFAULT_SECRET);
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
