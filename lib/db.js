// Koneksi MongoDB (Mongoose) — pola singleton agar aman di serverless.
// Jika MONGODB_URI tidak diisi, aplikasi berjalan penuh dengan data demo.

import mongoose from 'mongoose';
import dns from 'node:dns';

const MONGODB_URI = process.env.MONGODB_URI;

// --- Fix DNS self-healing ---
// Pada sebagian mesin (umumnya Windows), resolver c-ares Node terbaca sebagai
// 127.0.0.1 padahal tidak ada layanan DNS lokal di sana → semua kueri DNS
// (termasuk SRV/TXT MongoDB Atlas) gagal dengan ECONNREFUSED. Deteksi kondisi
// ini dan arahkan ulang ke DNS publik HANYA bila semua server terkonfigurasi
// berupa loopback — di mesin sehat fungsi ini tidak mengubah apa pun.
// Bisa dipaksa lewat env DNS_SERVERS (format: "8.8.8.8,1.1.1.1").
// PENTING: dipanggil ulang di connectToDatabase() karena state resolver DNS
// Node bersifat per-konteks eksekusi (worker thread pada Next.js) — harus
// diset di konteks yang sama dengan mongoose.connect().
// Set server DNS pada SEMUA resolver (callback & promises) — pada runtime
// Next.js keduanya adalah objek terpisah; driver MongoDB memakai resolver
// promises, jadi tanpa ini setServers biasa tidak berpengaruh.
function setDnsServers(list) {
  try {
    dns.setServers(list);
  } catch (error) {
    console.warn(`[eluzai] Gagal set DNS servers (${list.join(', ')}): ${error.message}`);
  }
  try {
    if (typeof dns.promises?.setServers === 'function') dns.promises.setServers(list);
  } catch (error) {
    console.warn(`[eluzai] Gagal set DNS servers promises (${list.join(', ')}): ${error.message}`);
  }
}

function applyDnsFix() {
  if (typeof dns.setServers !== 'function') return;
  const override = (process.env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (override.length > 0) {
    setDnsServers(override);
    return;
  }
  const servers = dns.getServers();
  const allLoopback =
    servers.length > 0 &&
    servers.every((s) => s === '::1' || s.startsWith('127.'));
  if (allLoopback) {
    setDnsServers(['8.8.8.8', '1.1.1.1']);
    // Flag global agar peringatan tidak berulang di tiap bundle/worker Next.js.
    if (!globalThis.__eluzaiDnsWarned) {
      globalThis.__eluzaiDnsWarned = true;
      console.warn(
        '[eluzai] DNS lokal (127.0.0.1) tidak tersedia — memakai 8.8.8.8 / 1.1.1.1. Set env DNS_SERVERS untuk mengubah.'
      );
    }
  }
}

if (MONGODB_URI) {
  applyDnsFix();
}

if (!MONGODB_URI) {
  // Tidak ada database terkonfigurasi — mode demo.
}

const cached = global._eluzaiMongo || { conn: null, promise: null };
global._eluzaiMongo = cached;

export async function connectToDatabase() {
  if (!MONGODB_URI) return null;
  if (cached.conn) return cached.conn;

  // Pastikan resolver DNS konteks eksekusi ini sudah benar (lihat applyDnsFix).
  applyDnsFix();

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((mongooseInstance) => {
        console.log('[eluzai] Terhubung ke MongoDB');
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
