// ============================================================
// GPI ELUZAI KIDS — Rate limiter login (3 dimensi)
// ------------------------------------------------------------
// Sesuai PRD docs/PRD-ADMIN-LOGIN.md bagian 9.4:
//  - per IP
//  - per akun (username lowercased)
//  - per kombinasi IP+akun
// State di memory (reset saat server restart); entri basi
// dibersihkan tiap 30 menit (prevent memory leak).
//
// HANYA percobaan login yang GAGAL yang dihitung (recordLoginFailure
// dipanggil dari handler saat kredensial salah). Login yang berhasil
// memanggil clearLoginState → tidak pernah memblokir pengguna sah.
// ============================================================

const DEFAULTS = {
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 8, // percobaan GAGAL maksimal per window
  blockMs: 10 * 60 * 1000, // blokir sementara 10 menit
};

const stateByIp = new Map();
const stateByAccount = new Map();
const stateByIpAccount = new Map();

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function sweepMap(map, now) {
  for (const [key, record] of map) {
    const stillBlocked = record.blockedUntil && now < record.blockedUntil;
    const lastAttempt = record.attempts.length ? record.attempts[record.attempts.length - 1] : 0;
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
// .unref() supaya timer tidak menahan proses Node tetap hidup
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function getIp(req) {
  return req.ip || (req.connection && req.connection.remoteAddress) || "unknown";
}

function makeState() {
  return { attempts: [], blockedUntil: 0 };
}

function getRecord(map, key) {
  let record = map.get(key);
  if (!record) {
    record = makeState();
    map.set(key, record);
  }
  return record;
}

function keyOf(req, username) {
  const ipKey = getIp(req);
  const acct = String(username || "").toLowerCase();
  return {
    ip: ipKey,
    account: `acct::${acct}`,
    ipAccount: `ipacct::${ipKey}::${acct}`,
  };
}

// Reset record bila blokir sudah lewat — mencegah "re-block" langsung:
// tanpa reset ini, attempts lama (masih ≥ max) membuat user diblokir
// lagi segera setelah masa blokir pertama berakhir.
function settle(record, now) {
  if (record.blockedUntil && now >= record.blockedUntil) {
    record.blockedUntil = 0;
    record.attempts = [];
  }
  return record;
}

// Blokir saat ini (timestamp) jika ada salah satu dimensi yang diblokir
function blockedUntilOf(records, now) {
  return Math.max(0, ...records.map((r) => settle(r, now).blockedUntil || 0));
}

// Middleware: hanya MENGHITUNG & MEMBLOKIR berdasar state yang sudah
// dicatat oleh recordLoginFailure. Tidak menambah attempt di sini —
// attempt hanya ditambah saat login GAGAL (lihat recordLoginFailure).
function rateLimitLogin(options = {}) {
  const { windowMs, max, blockMs, onBlocked } = { ...DEFAULTS, ...options };

  return (req, res, next) => {
    const now = Date.now();
    const { ip, account, ipAccount } = keyOf(req, req.body && req.body.username);

    const blockedUntil = blockedUntilOf(
      [getRecord(stateByIp, ip), getRecord(stateByAccount, account), getRecord(stateByIpAccount, ipAccount)],
      now
    );

    if (blockedUntil && now < blockedUntil) {
      const msg = `Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil((blockedUntil - now) / 1000)} detik.`;
      if (onBlocked) return onBlocked(req, res, msg);
      return res.status(429).send(msg);
    }

    return next();
  };
}

// Catat 1 percobaan GAGAL di 3 dimensi; blokir bila menembus batas.
// options boleh diteruskan dari pemanggil (server.js) supaya ambang blokir
// (max) SELALU sama dengan yang dipakai middleware rateLimitLogin.
function recordLoginFailure(req, username, options = {}) {
  const now = Date.now();
  const { windowMs, max, blockMs } = { ...DEFAULTS, ...options };
  const { ip, account, ipAccount } = keyOf(req, username);

  const records = [getRecord(stateByIp, ip), getRecord(stateByAccount, account), getRecord(stateByIpAccount, ipAccount)];

  for (const record of records) {
    settle(record, now);
    record.attempts = record.attempts.filter((t) => now - t <= windowMs);
    record.attempts.push(now);
    if (record.attempts.length >= max) record.blockedUntil = now + blockMs;
  }
}

// Login berhasil → hapus semua catatan & blokir untuk IP + akun ini,
// supaya percobaan lama tidak membuat pengguna sah terblokir.
function clearLoginState(req, username) {
  const { ip, account, ipAccount } = keyOf(req, username);
  stateByIp.delete(ip);
  stateByAccount.delete(account);
  stateByIpAccount.delete(ipAccount);
}

module.exports = { rateLimitLogin, recordLoginFailure, clearLoginState };
