// ============================================================
// Rate limiter login (anti brute-force) — SECURITY.md § 3.7.
// Melacak 3 dimensi sekaligus: per IP, per username, per
// IP+username. Pembersihan memori otomatis tiap 30 menit
// (anti memory leak).
//
// Catatan serverless: store ini in-memory per instance. Pada
// platform serverless dengan banyak instance, batas bersifat
// per-instance — tetap efektif melawan serangan dari satu
// sumber, dan tanpa dependensi eksternal.
//
// Sejak project /dev (dashboard developer) hadir, store ini
// juga bisa diintrospeksi: getRateLimitedIps() & unblockIp()
// dipakai endpoint /api/dev/* untuk menampilkan IP yang sedang
// diblokir secara real-time dan membukanya kembali.
// ============================================================

const DEFAULTS = { windowMs: 15 * 60 * 1000, max: 5, blockMs: 10 * 60 * 1000 };

function getStore() {
  if (!globalThis._eluzaiRateLimitStore) globalThis._eluzaiRateLimitStore = new Map();
  return globalThis._eluzaiRateLimitStore;
}

function startCleanup(store) {
  if (globalThis._eluzaiRateLimitCleanup) return;
  globalThis._eluzaiRateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.blockedUntil && entry.blockedUntil <= now) store.delete(key);
      else if (!entry.blockedUntil && now - entry.windowStart > 24 * 60 * 60 * 1000) {
        store.delete(key);
      }
    }
  }, 30 * 60 * 1000);
  // Jangan menahan proses server tetap hidup (dev/serverless).
  if (globalThis._eluzaiRateLimitCleanup.unref) globalThis._eluzaiRateLimitCleanup.unref();
}

export function rateLimitLogin(options = {}) {
  const { windowMs, max, blockMs } = { ...DEFAULTS, ...options };
  const store = getStore();
  startCleanup(store);

  const keyOf = (kind, value) => `${kind}:${String(value || '').toLowerCase()}`;

  function dimensionBlocked(key, now) {
    const entry = store.get(key);
    return entry?.blockedUntil && entry.blockedUntil > now ? entry.blockedUntil - now : 0;
  }

  return function check({ ip, username }) {
    const now = Date.now();
    const keys = [keyOf('ip', ip), keyOf('user', username), keyOf('both', `${ip}:${username}`)];

    // Sudah diblokir di salah satu dimensi?
    for (const key of keys) {
      const remain = dimensionBlocked(key, now);
      if (remain > 0) return { allowed: false, retryAfter: Math.ceil(remain / 1000) };
    }

    // Catat percobaan di 3 dimensi sekaligus.
    let exceeded = false;
    const touched = [];
    for (const key of keys) {
      const entry = store.get(key) || { count: 0, windowStart: now, blockedUntil: 0 };
      if (now - entry.windowStart > windowMs) {
        entry.count = 0;
        entry.windowStart = now;
      }
      entry.count += 1;
      if (entry.count >= max && !entry.blockedUntil) exceeded = true;
      touched.push([key, entry]);
    }

    // Saat salah satu dimensi melewati batas, BLOKIR KETIGANYA sekaligus
    // (ip, username, ip+username). Lebih akurat: IP pelaku langsung tampil
    // di daftar "IP terblokir" real-time dashboard /dev, dan pergantian
    // username tidak bisa menghindari blokir IP.
    if (exceeded) {
      for (const [, entry] of touched) entry.blockedUntil = now + blockMs;
    }
    for (const [key, entry] of touched) store.set(key, entry);

    if (exceeded) return { allowed: false, retryAfter: Math.ceil(blockMs / 1000) };
    return { allowed: true };
  };
}

// Bersihkan riwayat percobaan setelah login berhasil.
export function resetLoginAttempts({ ip, username }) {
  const store = getStore();
  const user = String(username || '').toLowerCase();
  for (const key of [`ip:${ip}`, `user:${user}`, `both:${ip}:${user}`]) {
    store.delete(key);
  }
}

// Daftar IP yang SEDANG diblokir (dimensi per-IP dan IP+username)
// beserta sisa waktu blokir — dipakai UI /dev real-time.
export function getRateLimitedIps() {
  const store = getStore();
  const now = Date.now();
  const byIp = new Map();
  for (const [key, entry] of store) {
    if (!(entry.blockedUntil && entry.blockedUntil > now)) continue;
    let ip = '';
    let kind = '';
    if (key.startsWith('ip:')) {
      ip = key.slice(3);
      kind = 'ip';
    } else if (key.startsWith('both:')) {
      // Format "both:<ip>:<username>" — username tidak memuat ':',
      // jadi separator terakhir memisahkan IP (yang bisa IPv6 "::1").
      const rest = key.slice(5);
      const sep = rest.lastIndexOf(':');
      ip = sep === -1 ? rest : rest.slice(0, sep);
      kind = 'ip+username';
    }
    if (!ip) continue;
    const existing = byIp.get(ip) || {
      ip,
      blockedUntil: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      count: entry.count || 0,
      dimensions: [],
    };
    existing.dimensions.push(kind);
    if (entry.blockedUntil < existing.blockedUntil) {
      existing.blockedUntil = entry.blockedUntil;
      existing.retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    }
    existing.count = Math.max(existing.count, entry.count || 0);
    byIp.set(ip, existing);
  }
  return [...byIp.values()].sort((a, b) => a.blockedUntil - b.blockedUntil);
}

// Buka blokir rate limit untuk satu IP (hapus dimensi ip & both-nya).
// Dimensi username yang ikut terblokir BERSAMA IP ini (key both:ip|user)
// juga dibersihkan — sehingga "reset akses login" benar-benar memulihkan
// kemampuan login untuk IP tersebut.
export function unblockIp(ip) {
  const store = getStore();
  const lc = String(ip || '').toLowerCase();
  if (!lc) return false;
  let removed = false;
  const usernames = new Set();
  for (const key of [...store.keys()]) {
    if (key === `ip:${lc}` || key.startsWith(`both:${lc}:`)) {
      if (key.startsWith(`both:${lc}:`)) {
        // Format "both:<ip>:<username>" — separator terakhir (IP bisa IPv6).
        const rest = key.slice(`both:${lc}:`.length);
        const sep = rest.lastIndexOf(':');
        const user = sep === -1 ? rest : rest.slice(sep + 1);
        if (user) usernames.add(user);
      }
      store.delete(key);
      removed = true;
    }
  }
  for (const user of usernames) {
    store.delete(`user:${user}`);
  }
  return removed;
}

// Bersihkan SEMUA entri rate limit (dimensi ip/user/both) sekaligus.
// Dipakai tombol "Reset Semua" di dashboard /dev agar akses login
// kembali normal untuk semua IP — berlaku instan di proses ini.
export function resetAllRateLimits() {
  const store = getStore();
  store.clear();
}

// ============================================================
// Rate limit umum untuk API state-changing (anti DoS ringan).
// Melindungi dari lonjakan permintaan tulis dari satu sumber saat
// situs diakses ramai (puluhan pengguna bersamaan) — tetap sangat
// generous (120 tulis/menit per IP) sehingga pengguna normal tidak
// pernah terdampak. Dipakai proxy.js untuk POST/PUT/PATCH/DELETE
// pada /api (kecuali /api/dev yang memakai kunci mesin sendiri).
// ============================================================

const WRITE_DEFAULTS = { windowMs: 60 * 1000, max: 120 };

export function createWriteRateLimit({
  windowMs = WRITE_DEFAULTS.windowMs,
  max = WRITE_DEFAULTS.max,
} = {}) {
  const store = getStore();
  startCleanup(store);
  const key = (ip) => `write:${String(ip || 'unknown').toLowerCase()}`;

  function check(ip) {
    const now = Date.now();
    const k = key(ip);
    const entry = store.get(k) || { count: 0, windowStart: now };
    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    store.set(k, entry);
    if (entry.count > max) {
      return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
    }
    return { allowed: true };
  }
  // Batas maksimum dibawa serta agar caller bisa mengecek aktif/nonaktif
  // (max = 0 berarti rate limit ini dimatikan via env).
  check.max = max;
  return check;
}
