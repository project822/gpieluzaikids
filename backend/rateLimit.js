// Simple in-memory rate limiter for Express.
// Note: This resets when server restarts.

const DEFAULTS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // max attempts within window
  blockMs: 10 * 60 * 1000, // 10 minutes temporary ban
};

// Track separately:
// - per IP+device-ish (we approximate by IP)
// - per account username
// - per IP+username (to avoid edge cases)
const stateByIp = new Map();
const stateByAccount = new Map();
const stateByIpAccount = new Map();

// FIX: sebelumnya Map ini tidak pernah dibersihkan sama sekali, jadi setiap
// IP/username unik yang pernah login akan tetap tersimpan di memori selamanya
// selama proses server hidup -> memory leak perlahan pada server yang lama nyala.
// Sekarang dibersihkan berkala: entri yang sudah tidak diblokir dan tidak ada
// percobaan dalam 24 jam terakhir akan dihapus.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function sweepMap(map, now) {
  for (const [key, record] of map) {
    const stillBlocked = record.blockedUntil && now < record.blockedUntil;
    const lastAttempt = record.attempts.length
      ? record.attempts[record.attempts.length - 1]
      : 0;
    const isStale = !stillBlocked && now - lastAttempt > STALE_AFTER_MS;
    if (isStale) map.delete(key);
  }
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  sweepMap(stateByIp, now);
  sweepMap(stateByAccount, now);
  sweepMap(stateByIpAccount, now);
}, 30 * 60 * 1000);
// .unref() supaya timer ini tidak menahan proses Node tetap hidup
// (mis. saat proses lain mencoba shutdown/exit dengan bersih).
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function getIp(req) {
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function getUsername(req, usernameField = "username") {
  return ((req.body && req.body[usernameField]) || "").toString();
}

function makeState() {
  return { attempts: [], blockedUntil: 0 };
}

function getKeyIp(req) {
  return getIp(req);
}

function getKeyAccount(req, usernameField = "username") {
  return `acct::${getUsername(req, usernameField).toLowerCase()}`;
}

function getKeyIpAccount(req, usernameField = "username") {
  const ip = getIp(req);
  const u = getUsername(req, usernameField).toLowerCase();
  return `ipacct::${ip}::${u}`;
}

function getRecord(map, key) {
  const record = map.get(key);
  if (record) return record;
  const fresh = makeState();
  map.set(key, fresh);
  return fresh;
}

function rateLimitLogin(options = {}) {
  const { windowMs, max, blockMs } = { ...DEFAULTS, ...options };

  return (req, res, next) => {
    const now = Date.now();

    const ipKey = getKeyIp(req);
    const accountKey = getKeyAccount(req);
    const ipAccountKey = getKeyIpAccount(req);

    const ipRecord = getRecord(stateByIp, ipKey);
    const accountRecord = getRecord(stateByAccount, accountKey);
    const ipAccountRecord = getRecord(stateByIpAccount, ipAccountKey);

    // Block jika salah satu sudah diblokir
    const blockedUntil = Math.max(
      ipRecord.blockedUntil || 0,
      accountRecord.blockedUntil || 0,
      ipAccountRecord.blockedUntil || 0,
    );

    if (blockedUntil && now < blockedUntil) {
      return res.status(429).render("login", {
        error: `Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil(
          (blockedUntil - now) / 1000,
        )} detik.`,
      });
    }

    // Filter attempts dalam window
    ipRecord.attempts = ipRecord.attempts.filter((t) => now - t <= windowMs);
    accountRecord.attempts = accountRecord.attempts.filter(
      (t) => now - t <= windowMs,
    );
    ipAccountRecord.attempts = ipAccountRecord.attempts.filter(
      (t) => now - t <= windowMs,
    );

    // Kalau sudah menembus batas, block sementara untuk masing-masing dimensi
    if (ipRecord.attempts.length >= max) ipRecord.blockedUntil = now + blockMs;
    if (accountRecord.attempts.length >= max)
      accountRecord.blockedUntil = now + blockMs;
    if (ipAccountRecord.attempts.length >= max)
      ipAccountRecord.blockedUntil = now + blockMs;

    // Jika setelah evaluasi masih belum block, register attempt
    const isBlockedNow =
      (ipRecord.blockedUntil && now < ipRecord.blockedUntil) ||
      (accountRecord.blockedUntil && now < accountRecord.blockedUntil) ||
      (ipAccountRecord.blockedUntil && now < ipAccountRecord.blockedUntil);

    if (isBlockedNow) {
      const nextBlockedUntil = Math.max(
        ipRecord.blockedUntil || 0,
        accountRecord.blockedUntil || 0,
        ipAccountRecord.blockedUntil || 0,
      );

      return res.status(429).render("login", {
        error: `Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil(
          (nextBlockedUntil - now) / 1000,
        )} detik.`,
      });
    }

    // Register attempt di 3 dimensi
    ipRecord.attempts.push(now);
    accountRecord.attempts.push(now);
    ipAccountRecord.attempts.push(now);

    return next();
  };
}

module.exports = { rateLimitLogin };