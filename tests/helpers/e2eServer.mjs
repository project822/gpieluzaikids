// tests/helpers/e2eServer.mjs
// Helper test integrasi HTTP end-to-end:
//  - membaca .env.local (tanpa dependensi dotenv)
//  - memakai database MongoDB TERPISAH (eluzai_test) agar data dev tidak tersentuh
//  - menyalakan server produksi nyata (next start) di port test
//  - menyediakan pembersihan: stop server + drop database test
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import mongoose from 'mongoose';

export const TEST_PORT = 22910;
export const TEST_DB = 'eluzai_test';

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadLocalEnv() {
  return parseEnvFile(path.join(process.cwd(), '.env.local'));
}

// Kredensial admin dari .env.local (server test memuatnya; proses test tidak).
export function getAdminCredentials() {
  const env = loadLocalEnv();
  return {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || 'eluzai123',
  };
}

// URI MongoDB untuk test: nama database diganti eluzai_test.
// (mongodb://host/db?x dan mongodb+srv://host/db keduanya didukung.)
export function getTestMongoUri() {
  const uri = loadLocalEnv().MONGODB_URI;
  if (!uri) return null;
  // Skema boleh memuat + . - (mis. mongodb+srv) — pola \(w+ tidak cukup.
  const m = uri.match(/^([a-z][a-z0-9+.-]*:\/\/[^/]*)\/([^/?]+)(\?.*)?$/i);
  if (m) return `${m[1]}/${TEST_DB}${m[3] || ''}`;
  return `${uri.replace(/\/+$/, '')}/${TEST_DB}`;
}

// Koneksi mongoose yang aman lintas versi (asPromise + fallback event).
async function openConnection(uri, timeoutMs) {
  applyDnsFix();
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    bufferCommands: false,
  });
  try {
    if (typeof conn.asPromise === 'function') {
      await conn.asPromise();
    } else {
      await new Promise((resolve, reject) => {
        conn.once('connected', resolve);
        conn.once('error', reject);
      });
    }
  } catch (error) {
    try { await conn.close(); } catch {}
    throw error;
  }
  return conn;
}

export async function mongoAvailable(uri) {
  if (!uri) return false;
  try {
    const conn = await openConnection(uri, 3000);
    await conn.close();
    return true;
  } catch {
    return false;
  }
}

// Bersihkan database test (dipanggil sebelum server dinyalakan & setelah selesai).
export async function dropTestDatabase() {
  const uri = getTestMongoUri();
  if (!uri) return;
  let conn;
  try {
    conn = await openConnection(uri, 5000);
    await conn.dropDatabase();
  } catch (error) {
    console.warn('[e2e] Gagal membersihkan database test:', error.message);
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
}

// Salinan DNS-fix dari lib/db.js: di sebagian mesin Windows, resolver c-ares
// Node terbaca 127.0.0.1 padahal tidak ada DNS lokal → kueri SRV/TXT Atlas
// gagal (ECONNREFUSED). Diarahkan ke DNS publik bila semua server loopback.
function applyDnsFix() {
  if (typeof dns.setServers !== 'function') return;
  const override = (process.env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (override.length > 0) {
    try { dns.setServers(override); } catch {}
    return;
  }
  const servers = dns.getServers();
  const allLoopback =
    servers.length > 0 && servers.every((s) => s === '::1' || s.startsWith('127.'));
  if (allLoopback) {
    try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let currentChild = null;
let startupLogs = '';

// Jalankan `next start` di port test dengan MONGODB_URI test.
// Mengembalikan { ready, baseUrl, reason }.
// Harus dijalankan SETELAH `next build` (lihat script npm test:e2e).
export async function startTestServer() {
  const uri = getTestMongoUri();
  if (!(await mongoAvailable(uri))) {
    return {
      ready: false,
      reason: `MongoDB test tidak tersedia (${uri ? 'cek koneksi/URI' : 'MONGODB_URI kosong di .env.local'}) — test E2E dilewati.`,
    };
  }

  // Mulai dengan database bersih.
  await dropTestDatabase();

  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  startupLogs = '';
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(TEST_PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: uri },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  currentChild = child;
  child.stdout.on('data', (d) => (startupLogs += d));
  child.stderr.on('data', (d) => (startupLogs += d));

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      return {
        ready: false,
        reason: `Server keluar lebih awal (code ${child.exitCode}):\n${startupLogs.slice(-800)}`,
      };
    }
    try {
      const res = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2500) });
      if (res.status < 500) {
        return { ready: true, baseUrl, reason: '' };
      }
    } catch {}
    await sleep(500);
  }
  return {
    ready: false,
    reason: `Server tidak siap dalam 90 detik:\n${startupLogs.slice(-800)}`,
  };
}

export async function stopTestServer() {
  const child = currentChild;
  currentChild = null;
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(8000),
  ]);
}
