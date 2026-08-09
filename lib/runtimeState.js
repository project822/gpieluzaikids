// ============================================================
// Runtime state (file-based) — maintenance mode & blocked IP.
// ============================================================
// Env (MAINTENANCE_MODE, BLOCKED_IPS) hanya bisa diubah dengan
// restart. Project /dev (dashboard developer) perlu mengubahnya
// real-time, jadi state runtime disimpan di file JSON kecil:
//
//   data/dev-state.json
//   → { maintenanceMode, blockedIps, maintenanceTitle,
//       maintenanceMessage, maintenanceFooter }
//
// Semantik env vs file:
//   - Maintenance: env MAINTENANCE_MODE=1 berlaku sebagai
//     switch darurat FORCE-ON (tidak bisa dimatikan lewat file);
//     jika env kosong, flag file yang menentukan.
//   - Teks halaman maintenance selalu dari file (bisa diedit
//     dari dashboard /dev).
//   - Blocked IP: env BLOCKED_IPS digabung dengan daftar file.
// File dibaca sinkron setiap pemanggilan (ukuran kecil, proses
// lokal). Jika fs tidak tersedia (mis. runtime edge), fungsi
// otomatis jatuh ke env saja.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = path.join(process.cwd(), 'data', 'dev-state.json');

const DEFAULTS = {
  maintenanceMode: false,
  blockedIps: [],
  maintenanceTitle: 'Under Maintenance',
  maintenanceMessage: 'Website sedang diperbaiki, coba kembali nanti',
  maintenanceFooter: '— tim gpieluzaikids',
};

function parseBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function readFile() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      maintenanceMode: Boolean(parsed.maintenanceMode),
      blockedIps: Array.isArray(parsed.blockedIps)
        ? parsed.blockedIps.map((s) => String(s).trim()).filter(Boolean)
        : [],
      maintenanceTitle: String(parsed.maintenanceTitle || DEFAULTS.maintenanceTitle).slice(0, 80),
      maintenanceMessage: String(parsed.maintenanceMessage || DEFAULTS.maintenanceMessage).slice(0, 300),
      maintenanceFooter: String(parsed.maintenanceFooter || DEFAULTS.maintenanceFooter).slice(0, 80),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeFile(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.warn(`[eluzai] Gagal menulis ${STATE_FILE}: ${error.message}`);
    return false;
  }
}

// ---------- Maintenance mode ----------
// Env MAINTENANCE_MODE=1 = force-on (darurat, tak bisa dimatikan
// lewat dashboard); bila env kosong, flag file yang menentukan.
export function maintenanceEnabled() {
  return parseBool(process.env.MAINTENANCE_MODE) || readFile().maintenanceMode;
}

export function getMaintenanceMode() {
  return maintenanceEnabled();
}

export function getMaintenanceSource() {
  if (parseBool(process.env.MAINTENANCE_MODE)) return 'env';
  if (readFile().maintenanceMode) return 'runtime';
  return 'none';
}

export function setMaintenanceMode(enabled) {
  const file = readFile();
  file.maintenanceMode = Boolean(enabled);
  return writeFile(file);
}

// ---------- Teks halaman maintenance (bisa diedit dari dashboard) ----------
export function getMaintenanceText() {
  const file = readFile();
  return {
    title: file.maintenanceTitle,
    message: file.maintenanceMessage,
    footer: file.maintenanceFooter,
  };
}

export function setMaintenanceText({ title, message, footer } = {}) {
  const file = readFile();
  if (title !== undefined) file.maintenanceTitle = String(title).slice(0, 80);
  if (message !== undefined) file.maintenanceMessage = String(message).slice(0, 300);
  if (footer !== undefined) file.maintenanceFooter = String(footer).slice(0, 80);
  return writeFile(file);
}

// ---------- Blocked IP ----------
// Gabungan env BLOCKED_IPS + daftar dari file.
export function isIpBlocked(ip) {
  if (!ip) return false;
  const envList = (process.env.BLOCKED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const file = readFile();
  const all = [...new Set([...envList, ...file.blockedIps])];
  return all.includes(ip);
}

export function getBlockedIps() {
  const envList = (process.env.BLOCKED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const file = readFile();
  return [...new Set([...envList, ...file.blockedIps])];
}

// Daftar IP dengan sumbernya (env tidak bisa dihapus lewat dashboard).
export function getBlockedIpsDetailed() {
  const envList = (process.env.BLOCKED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const file = readFile();
  const map = new Map();
  for (const ip of envList) map.set(ip, 'env');
  for (const ip of file.blockedIps) if (!map.has(ip)) map.set(ip, 'runtime');
  return [...map.entries()].map(([ip, source]) => ({ ip, source }));
}

// Ganti seluruh daftar IP file (env tetap berlaku).
export function setBlockedIps(ips) {
  const file = readFile();
  file.blockedIps = (Array.isArray(ips) ? ips : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  return writeFile(file);
}

export function unblockBlockedIp(ip) {
  const file = readFile();
  const before = file.blockedIps.length;
  file.blockedIps = file.blockedIps.filter((s) => s !== ip);
  if (file.blockedIps.length === before) return false;
  return writeFile(file);
}
