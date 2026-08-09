// ============================================================
// Security Logging (audit trail) — SECURITY.md § 3.11.
// Setiap event keamanan dicatat ke console (terstruktur) dan
// buffer in-memory maksimal 500 entri (yang tertua dibuang).
//
// Adaptasi serverless: tanpa store eksternal agar tetap ringan;
// `getSecurityLogs()` & `getSecurityStats()` siap dipakai UI
// admin (lihat /admin dashboard).
// ============================================================

const MAX_LOGS = 500;

function getLogs() {
  if (!globalThis._eluzaiSecurityLogs) globalThis._eluzaiSecurityLogs = [];
  return globalThis._eluzaiSecurityLogs;
}

export function logSecurityEvent({ type, ip = '', path = '', userAgent = '', detail = '' } = {}) {
  const entry = {
    type,
    ip,
    path,
    userAgent: String(userAgent).slice(0, 200),
    detail: String(detail).slice(0, 300),
    at: new Date().toISOString(),
  };
  console.warn(
    `[security] ${entry.type} ip=${entry.ip} path=${entry.path} detail=${entry.detail}`
  );
  const logs = getLogs();
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  return entry;
}

export function getSecurityLogs({ limit = 100 } = {}) {
  return getLogs().slice(-limit);
}

export function getSecurityStats() {
  const logs = getLogs();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const count = (type) => logs.filter((l) => l.type === type).length;
  return {
    events24h: logs.filter((l) => new Date(l.at).getTime() >= dayAgo).length,
    blocked: count('blocked_ip'),
    rateLimited: count('rate_limit'),
    csrf: count('csrf'),
    failedLogin: count('failed_login'),
  };
}
