// ============================================================
// Runtime state — maintenance mode, teks maintenance, blocked IP,
// blocked device (device fingerprint / "MAC").
// ============================================================
// Menyimpan state di DUA tempat:
//   1. MongoDB  → collection runtime_config (untuk Vercel, persist)
//   2. File     → data/dev-state.json (untuk development lokal)
//
// Semantik prioritas baca:
//   Env (MAINTENANCE_MODE, BLOCKED_IPS) → force-on (prioritas
//   tertinggi, tidak bisa dimatikan lewat dashboard).
//   MongoDB → state runtime yang bisa diubah dashboard /dev.
//   File    → fallback (untuk development lokal tanpa MongoDB).
//
// CACHE real-time (performa):
//   Semua pembacaan state dilewati cache in-process ber-TTL pendek
//   (1,5 detik) — proxy.js mengecek blokir pada SETIAP request,
//   jadi membaca MongoDB/file tiap request tidak efisien. Setiap
//   penulisan (set/unblock) langsung membatalkan cache (write-through),
//   sehingga perubahan dari dashboard berlaku SEKETIKA di proses yang
//   sama (development), dan maksimal ~1,5 detik antar-instance
//   (serverless).
//
// Semua fungsi ekspor dibuat async agar bisa membaca dari MongoDB
// tanpa menggantung request. Caller di proxy.js / route handler
// sudah async — cukup tambah await.
//
// Di Vercel (serverless), file write selalu gagal (read-only fs).
// MongoDB menjadi satu-satunya penyimpanan persisten untuk state
// yang diubah lewat dashboard.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { connectToDatabase } from '@/lib/db';
import RuntimeConfig from '@/database/models/RuntimeConfig';

const STATE_FILE = path.join(process.cwd(), 'data', 'dev-state.json');

// Cache in-process ber-TTL pendek (lihat header file).
const STATE_CACHE_TTL_MS = 1500;
let stateCache = null; // { at, value }

const DEFAULTS = {
  maintenanceMode: false,
  blockedIps: [],
  blockedDevices: [],
  maintenanceTitle: 'Under Maintenance',
  maintenanceMessage: 'Website sedang diperbaiki, coba kembali nanti',
  maintenanceFooter: '— tim gpieluzaikids',
  verse: '',
  verseRef: '',
};

function parseBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

// ---------- Lapisan file sinkron (fallback) ----------

function readFile() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      maintenanceMode: Boolean(parsed.maintenanceMode),
      blockedIps: Array.isArray(parsed.blockedIps)
        ? parsed.blockedIps.map((s) => String(s).trim()).filter(Boolean)
        : [],
      blockedDevices: Array.isArray(parsed.blockedDevices)
        ? parsed.blockedDevices.map((s) => String(s).trim()).filter(Boolean)
        : [],
      maintenanceTitle: String(parsed.maintenanceTitle || DEFAULTS.maintenanceTitle).slice(0, 80),
      maintenanceMessage: String(parsed.maintenanceMessage || DEFAULTS.maintenanceMessage).slice(0, 300),
      maintenanceFooter: String(parsed.maintenanceFooter || DEFAULTS.maintenanceFooter).slice(0, 80),
      verse: String(parsed.verse || '').trim().slice(0, 500),
      verseRef: String(parsed.verseRef || '').trim().slice(0, 80),
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
  } catch {
    // Vercel: read-only fs — diam saja, MongoDB jadi andalan.
    return false;
  }
}

// ---------- Lapisan MongoDB (async) ----------

// Helper: baca satu dokumen runtime_config dari MongoDB.
// Timeout 2 detik — bila DB lambat/offline, fungsi mengembalikan
// null tanpa error agar fallback file berjalan normal.
async function readRuntimeConfig(key) {
  let timer;
  try {
    const conn = await Promise.race([
      connectToDatabase(),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), 2000);
      }),
    ]);
    if (!conn) return null;
    const doc = await RuntimeConfig.findOne({ key }).lean().maxTimeMS(1500);
    return doc?.value ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Helper: tulis dokumen runtime_config ke MongoDB (upsert).
async function writeRuntimeConfig(key, value) {
  let timer;
  try {
    const conn = await Promise.race([
      connectToDatabase(),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), 3000);
      }),
    ]);
    if (!conn) return false;
    await RuntimeConfig.updateOne(
      { key },
      { $set: { value } },
      { upsert: true, maxTimeMS: 2500 }
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Fungsi state parser ----------

function parseState(state) {
  return {
    maintenanceMode: Boolean(state?.maintenanceMode),
    blockedIps: Array.isArray(state?.blockedIps)
      ? state.blockedIps.map((s) => String(s).trim()).filter(Boolean)
      : [],
    blockedDevices: Array.isArray(state?.blockedDevices)
      ? state.blockedDevices.map((s) => String(s).trim()).filter(Boolean)
      : [],
    maintenanceTitle: String(state?.maintenanceTitle || DEFAULTS.maintenanceTitle).slice(0, 80),
    maintenanceMessage: String(state?.maintenanceMessage || DEFAULTS.maintenanceMessage).slice(0, 300),
    maintenanceFooter: String(state?.maintenanceFooter || DEFAULTS.maintenanceFooter).slice(0, 80),
  };
}

// Gabung state dari MongoDB + file: field yang ada di MongoDB menang,
// sisanya dari file (biar migrasi bertahap tanpa kehilangan data).
// Kutipan ayat hero disimpan di key MongoDB terpisah ('verse').
// PENTING: jika MongoDB tidak terjangkau/tidak dikonfigurasi (dbState null),
// parseState(null) mengembalikan SEMUA nilai default — jangan disebar ke
// merged karena akan menimpa state file (fallback development). Hanya merge
// hasil parse bila dokumen DB benar-benar ada.
async function getState() {
  const dbState = await readRuntimeConfig('maintenance');
  const dbVerse = await readRuntimeConfig('verse');
  const fileState = readFile();
  const merged = dbState ? { ...fileState, ...parseState(dbState) } : fileState;
  if (dbVerse && typeof dbVerse === 'object') {
    if (dbVerse.verse !== undefined) merged.verse = String(dbVerse.verse).slice(0, 500);
    if (dbVerse.verseRef !== undefined) merged.verseRef = String(dbVerse.verseRef).slice(0, 80);
  }
  return merged;
}

// ---------- Cache real-time ----------

// Baca state melalui cache ber-TTL pendek. Dipakai semua fungsi baca
// yang berjalan pada jalur request (proxy) agar tidak membaca DB/file
// pada tiap request.
//
// Invalidasi INSTATAN di development: setiap penulisan state juga
// menulis file (data/dev-state.json), jadi mtime file dijadikan penanda
// versi — fs.statSync lokal berbiaya mikro-detik, jauh lebih murah dari
// baca MongoDB, dan terlihat lintas proses/instance di mesin yang sama.
// Di serverless (Vercel) file tidak bisa ditulis → mtime konstan →
// fallback ke TTL (maks ~1,5 detik antar-instance).
async function getStateCached() {
  const now = Date.now();
  if (stateCache) {
    let mtime = 0;
    try {
      mtime = fs.statSync(STATE_FILE).mtimeMs;
    } catch {
      mtime = 0;
    }
    if (mtime === stateCache.mtime && now - stateCache.at < STATE_CACHE_TTL_MS) {
      return stateCache.value;
    }
  }
  const value = await getState();
  let mtime = 0;
  try {
    mtime = fs.statSync(STATE_FILE).mtimeMs;
  } catch {
    mtime = 0;
  }
  stateCache = { at: now, value, mtime };
  return value;
}

function invalidateStateCache() {
  stateCache = null;
}

// ============================================================
// API Publik
// ============================================================

// ---------- Maintenance mode ----------
export async function maintenanceEnabled() {
  // Env force-on — prioritas tertinggi (darurat, tak bisa dimatikan dashboard).
  if (parseBool(process.env.MAINTENANCE_MODE)) return true;
  const state = await getStateCached();
  return state.maintenanceMode;
}

export async function getMaintenanceMode() {
  return maintenanceEnabled();
}

export async function getMaintenanceSource() {
  if (parseBool(process.env.MAINTENANCE_MODE)) return 'env';
  const state = await getStateCached();
  return state.maintenanceMode ? 'runtime' : 'none';
}

export async function setMaintenanceMode(enabled) {
  const val = Boolean(enabled);
  // Tulis ke MongoDB (berhasil di Vercel) — gabungkan dengan field lain
  // agar teks maintenance & blocklist tidak hilang.
  const existing = (await readRuntimeConfig('maintenance')) || {};
  await writeRuntimeConfig('maintenance', { ...existing, maintenanceMode: val });
  // Juga tulis ke file (berhasil di development)
  const file = readFile();
  file.maintenanceMode = val;
  writeFile(file);
  invalidateStateCache();
}

// ---------- Teks halaman maintenance ----------
export async function getMaintenanceText() {
  const state = await getStateCached();
  return {
    title: state.maintenanceTitle,
    message: state.maintenanceMessage,
    footer: state.maintenanceFooter,
  };
}

export async function setMaintenanceText({ title, message, footer } = {}) {
  const patch = {};
  if (title !== undefined) patch.maintenanceTitle = String(title).slice(0, 80);
  if (message !== undefined) patch.maintenanceMessage = String(message).slice(0, 300);
  if (footer !== undefined) patch.maintenanceFooter = String(footer).slice(0, 80);

  // Tulis ke MongoDB
  const existing = (await readRuntimeConfig('maintenance')) || {};
  await writeRuntimeConfig('maintenance', { ...existing, ...patch });

  // Juga tulis ke file
  const file = readFile();
  if (patch.maintenanceTitle !== undefined) file.maintenanceTitle = patch.maintenanceTitle;
  if (patch.maintenanceMessage !== undefined) file.maintenanceMessage = patch.maintenanceMessage;
  if (patch.maintenanceFooter !== undefined) file.maintenanceFooter = patch.maintenanceFooter;
  writeFile(file);
  invalidateStateCache();
}

// ---------- Blocked IP ----------
function envBlockedIps() {
  return (process.env.BLOCKED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function isIpBlocked(ip) {
  if (!ip) return false;
  // Env force-block (tanpa cache — murah & selalu akurat).
  if (envBlockedIps().includes(ip)) return true;

  const state = await getStateCached();
  return state.blockedIps.includes(ip);
}

export async function getBlockedIps() {
  const state = await getStateCached();
  return [...new Set([...envBlockedIps(), ...state.blockedIps])];
}

export async function getBlockedIpsDetailed() {
  const state = await getStateCached();
  const map = new Map();
  for (const ip of envBlockedIps()) map.set(ip, 'env');
  for (const ip of state.blockedIps) if (!map.has(ip)) map.set(ip, 'runtime');
  return [...map.entries()].map(([ip, source]) => ({ ip, source }));
}

export async function setBlockedIps(ips) {
  const list = (Array.isArray(ips) ? ips : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  // Tulis ke MongoDB — gabungkan dengan field lain agar maintenance mode
  // & teks halaman pemeliharaan tidak ikut terhapus.
  const existing = (await readRuntimeConfig('maintenance')) || {};
  await writeRuntimeConfig('maintenance', { ...existing, blockedIps: list });

  // Juga tulis ke file
  const file = readFile();
  file.blockedIps = list;
  writeFile(file);
  invalidateStateCache();
}

export async function unblockBlockedIp(ip) {
  // Baca dari MongoDB, hapus, tulis ulang
  const current = (await readRuntimeConfig('maintenance')) || {};
  const ips = Array.isArray(current.blockedIps)
    ? current.blockedIps.filter((s) => s !== ip)
    : [];
  const removed = ips.length < (current.blockedIps?.length || 0);

  await writeRuntimeConfig('maintenance', { ...current, blockedIps: ips });

  // Juga dari file
  const file = readFile();
  const before = file.blockedIps.length;
  file.blockedIps = file.blockedIps.filter((s) => s !== ip);
  writeFile(file);

  invalidateStateCache();
  return removed || before !== file.blockedIps.length;
}

// ---------- Blocked device (device fingerprint / "MAC") ----------
// Device diidentifikasi lewat ID stabil yang dibuat browser
// (localStorage) dan dikirim sebagai header X-Device-Id — pendekatan
// standar industri; MAC fisik tidak terlihat lewat HTTPS.

export async function getBlockedDevices() {
  const state = await getStateCached();
  return [...state.blockedDevices];
}

export async function getBlockedDevicesDetailed() {
  const state = await getStateCached();
  return state.blockedDevices.map((id) => ({ id, source: 'runtime' }));
}

export async function isDeviceBlocked(deviceId) {
  if (!deviceId) return false;
  const state = await getStateCached();
  return state.blockedDevices.includes(deviceId);
}

export async function setBlockedDevices(devices) {
  const list = (Array.isArray(devices) ? devices : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  // Tulis ke MongoDB
  const existing = (await readRuntimeConfig('maintenance')) || {};
  await writeRuntimeConfig('maintenance', { ...existing, blockedDevices: list });

  // Juga tulis ke file
  const file = readFile();
  file.blockedDevices = list;
  writeFile(file);
  invalidateStateCache();
}

export async function unblockBlockedDevice(deviceId) {
  const current = (await readRuntimeConfig('maintenance')) || {};
  const devices = Array.isArray(current.blockedDevices)
    ? current.blockedDevices.filter((s) => s !== deviceId)
    : [];
  const removed = devices.length < (current.blockedDevices?.length || 0);

  await writeRuntimeConfig('maintenance', { ...current, blockedDevices: devices });

  // Juga dari file
  const file = readFile();
  const before = file.blockedDevices.length;
  file.blockedDevices = file.blockedDevices.filter((s) => s !== deviceId);
  writeFile(file);

  invalidateStateCache();
  return removed || before !== file.blockedDevices.length;
}

// ---------- Kutipan ayat hero (dikelola dari /admin/informasi) ----------
// Disimpan seperti state runtime lain (MongoDB key 'verse' + file). Bila
// kosong, halaman publik jatuh ke ayat bawaan (CHURCH.verse di lib/data.js).

export async function getVerseConfig() {
  const state = await getStateCached();
  return {
    verse: state.verse || '',
    verseRef: state.verseRef || '',
  };
}

export async function setVerseConfig({ verse, verseRef } = {}) {
  const patch = {};
  if (verse !== undefined) patch.verse = String(verse).trim().slice(0, 500);
  if (verseRef !== undefined) patch.verseRef = String(verseRef).trim().slice(0, 80);

  // Tulis ke MongoDB (key terpisah 'verse')
  const existing = (await readRuntimeConfig('verse')) || {};
  await writeRuntimeConfig('verse', { ...existing, ...patch });

  // Juga tulis ke file (berhasil di development)
  const file = readFile();
  if (patch.verse !== undefined) file.verse = patch.verse;
  if (patch.verseRef !== undefined) file.verseRef = patch.verseRef;
  writeFile(file);
  invalidateStateCache();
}
