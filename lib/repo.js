// ============================================================
// Lapisan akses data.
// - Jika MONGODB_URI terisi  → memakai MongoDB (Mongoose),
//   dengan data demo di-seed otomatis saat pertama kali dipakai
//   (kecuali NODE_ENV=production — DB produksi dibiarkan kosong,
//   data diisi manual lewat panel admin).
// - Jika tidak terisi         → memakai penyimpanan in-memory
//   (data demo) sehingga situs tetap berfungsi penuh, termasuk
//   CRUD admin selama proses server berjalan.
// ============================================================

import { randomUUID } from 'crypto';
import { connectToDatabase } from './db';
import EventItem from '@/database/models/EventItem';
import Banner from '@/database/models/Banner';
import Schedule from '@/database/models/Schedule';
import User from '@/database/models/User';
import ClassMember from '@/database/models/ClassMember';
import Attendance from '@/database/models/Attendance';
import ActivityLog from '@/database/models/ActivityLog';
import Registration from '@/database/models/Registration';
import { DEMO_EVENTS, DEMO_BANNERS, buildDemoSchedules } from './data';
import { invalidateImageCache } from './imageCache';
import { localToday, nextSundayDate } from './attendanceValidation';

export { nextSundayDate }; // dipakai bersama (halaman publik jadwal)

export const isDbEnabled = () => Boolean(process.env.MONGODB_URI);

// ---------- Penyimpanan in-memory (mode demo) ----------
// Disimpan di globalThis agar dibagi oleh semua graf modul server
// (route handler API & Server Component halaman dibundel terpisah oleh
// Next.js App Router — tanpa ini, CRUD admin tidak terlihat di halaman).
const memory =
  globalThis._eluzaiMemory ??
  (globalThis._eluzaiMemory = {
    events: DEMO_EVENTS.map((d) => ({ ...d })),
    banners: DEMO_BANNERS.map((d) => ({ ...d })),
    schedules: buildDemoSchedules(),
    users: [],
    members: [],
    attendance: [],
    activities: [],
    registrations: [],
  });

// ---------- Seeding idempoten ke MongoDB ----------
let seededPromise = null;
function ensureSeeded() {
  if (!isDbEnabled() || seededPromise) return seededPromise;
  // PRODUKSI: database dibiarkan KOSONG dari awal — data diisi manual
  // lewat panel admin. Data demo hanya untuk development (npm run dev),
  // agar situs langsung terlihat hidup saat uji coba lokal.
  // Koneksi tetap dibuat (tanpa seed) — query Mongo memakai
  // bufferCommands:false, tanpa koneksi semua query langsung error dan
  // denganFallback akan jatuh ke memori demo (halaman demo ter-bake).
  if (process.env.NODE_ENV === 'production') {
    console.log('[eluzai] NODE_ENV=production — seeding data demo dilewati, DB dibiarkan kosong.');
    // Error koneksi diteruskan — withFallback sudah menanganinya
    // (log + fallback data demo bila DB memang tidak terjangkau).
    seededPromise = (async () => {
      await connectToDatabase();
    })();
    return seededPromise;
  }
  seededPromise = (async () => {
    const conn = await connectToDatabase();
    if (!conn) return;
    const seed = (Model, docs) =>
      Model.bulkWrite(
        docs.map((d) => {
          const { id, ...rest } = d;
          return {
            updateOne: {
              filter: { slug: d.slug },
              update: { $setOnInsert: rest },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
    const seedSchedules = async () => {
      const docs = buildDemoSchedules();
      await Schedule.bulkWrite(
        docs.map((d) => ({
          updateOne: {
            filter: { date: d.date },
            update: { $setOnInsert: d },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    };
    await Promise.all([
      seed(EventItem, DEMO_EVENTS),
      // Aturan maks 1 banner: bersihkan banner lama, sisakan hanya banner demo.
      Banner.deleteMany({}).then(() => seed(Banner, DEMO_BANNERS)),
      seedSchedules(),
    ]);
    console.log('[eluzai] Data demo berhasil di-seed ke MongoDB');
  })();
  return seededPromise;
}

// ---------- Utilitas ----------
function serialize(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  delete obj.__v;
  return obj;
}

// Jalan pintas: coba MongoDB, jika gagal/tidak aktif → fallback in-memory.
async function withFallback(mongoFn, fallbackFn) {
  if (!isDbEnabled()) return fallbackFn();
  try {
    await ensureSeeded();
    return await mongoFn();
  } catch (error) {
    console.error('[eluzai] Gagal memakai MongoDB, fallback ke data demo:', error.message);
    return fallbackFn();
  }
}

function memoryDelete(arr, id) {
  const idx = arr.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  return true;
}

function memoryFind(arr, id) {
  return arr.find((x) => x.id === id) || null;
}

// ============================================================
// Events
// ============================================================
export async function getEvents({ upcomingOnly = false } = {}) {
  return withFallback(
    async () => {
      // Urut: tanggal acara (terbaru dulu) + urutan penambahan (createdAt).
      const docs = await EventItem.find().sort({ date: -1, createdAt: 1 });
      let list = docs.map(serialize);
      if (upcomingOnly) {
        const today = new Date().toISOString().slice(0, 10);
        list = list
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));
      }
      return list;
    },
    () => {
      let list = [...memory.events].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
      if (upcomingOnly) {
        const today = new Date().toISOString().slice(0, 10);
        list = list
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));
      }
      return list;
    }
  );
}

export async function getEventById(id) {
  return withFallback(
    async () => {
      const doc = await EventItem.findById(id);
      return serialize(doc);
    },
    () => memoryFind(memory.events, id)
  );
}

export async function createEvent(data) {
  return withFallback(
    async () => serialize(await EventItem.create(data)),
    () => {
      const item = {
        id: randomUUID(),
        slug: data.slug || `event-${Date.now()}`,
        image: '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      memory.events.push(item);
      return item;
    }
  );
}

export async function updateEvent(id, data) {
  const result = await withFallback(
    async () => {
      const doc = await EventItem.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.events, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
  // Gambar bisa berubah → buang cache /img/[id] agar versi baru tersaji.
  invalidateImageCache(id);
  return result;
}

export async function deleteEvent(id) {
  const result = await withFallback(
    async () => {
      await EventItem.findByIdAndDelete(id);
      return true;
    },
    () => memoryDelete(memory.events, id)
  );
  invalidateImageCache(id);
  return result;
}

// ============================================================
// Banner informasi (rasio 16:9)
// ============================================================
export async function getBanners() {
  return withFallback(
    async () => {
      const docs = await Banner.find().sort({ order: 1, createdAt: 1 });
      return docs.map(serialize);
    },
    () => [...memory.banners].sort((a, b) => (a.order || 0) - (b.order || 0))
  );
}

// Aturan: HANYA 1 banner yang boleh tampil (fokus penyampaian).
// Membuat banner baru = mengganti banner yang ada (upsert).
// Mengembalikan { item, replaced } agar API bisa memberi tahu admin.
export async function createBanner(data) {
  const buildItem = (d) => ({
    id: randomUUID(),
    slug: d.slug || `banner-${Date.now()}`,
    title: '',
    caption: '',
    order: 1,
    updatedAt: new Date().toISOString(),
    ...d,
  });
  return withFallback(
    async () => {
      const existing = await Banner.countDocuments();
      // Buat dulu baru hapus yang lama — jika create gagal, banner lama tetap utuh.
      const doc = await Banner.create(data);
      await Banner.deleteMany({ _id: { $ne: doc._id } });
      return { item: serialize(doc), replaced: existing > 0 };
    },
    () => {
      const replaced = memory.banners.length > 0;
      memory.banners.splice(0, memory.banners.length);
      const item = buildItem(data);
      memory.banners.push(item);
      return { item, replaced };
    }
  );
}

export async function getBannerById(id) {
  return withFallback(
    async () => serialize(await Banner.findById(id)),
    () => memoryFind(memory.banners, id)
  );
}

export async function updateBanner(id, data) {
  const result = await withFallback(
    async () => {
      const doc = await Banner.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.banners, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
  invalidateImageCache(id);
  return result;
}

export async function deleteBanner(id) {
  const result = await withFallback(
    async () => {
      await Banner.findByIdAndDelete(id);
      return true;
    },
    () => memoryDelete(memory.banners, id)
  );
  invalidateImageCache(id);
  return result;
}

// ============================================================
// Jadwal mingguan (ibadah & latihan) — 1 entri per hari Minggu
// ============================================================
export async function getSchedules() {
  return withFallback(
    async () => {
      const docs = await Schedule.find().sort({ date: -1 });
      return docs.map(serialize);
    },
    () => [...memory.schedules].sort((a, b) => b.date.localeCompare(a.date))
  );
}

// Jadwal untuk Minggu terdekat — dipakai halaman publik (#schedule).
// Jika belum diisi admin, `schedule` bernilai null (tampil "Tidak ada").
export async function getNearestSchedule() {
  const date = nextSundayDate(localToday());
  const schedule = await withFallback(
    async () => serialize(await Schedule.findOne({ date })),
    () => memory.schedules.find((s) => s.date === date) || null
  );
  return { date, schedule };
}

export async function getScheduleById(id) {
  return withFallback(
    async () => serialize(await Schedule.findById(id)),
    () => memoryFind(memory.schedules, id)
  );
}

export async function createSchedule(data) {
  return withFallback(
    // 1 jadwal per Minggu: tanggal yang sama → perbarui (upsert), jangan duplikat.
    async () =>
      serialize(
        await Schedule.findOneAndUpdate({ date: data.date }, data, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        })
      ),
    () => {
      const item = {
        id: randomUUID(),
        ibadahAda: true,
        ibadahTime: '',
        latihanAda: false,
        latihanTime: '',
        updatedAt: new Date().toISOString(),
        ...data,
      };
      const idx = memory.schedules.findIndex((s) => s.date === item.date);
      if (idx !== -1) memory.schedules[idx] = item;
      else memory.schedules.push(item);
      return item;
    }
  );
}

export async function updateSchedule(id, data) {
  const result = await withFallback(
    async () => {
      const doc = await Schedule.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.schedules, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
  return result;
}

export async function deleteSchedule(id) {
  const result = await withFallback(
    async () => {
      await Schedule.findByIdAndDelete(id);
      return true;
    },
    () => memoryDelete(memory.schedules, id)
  );
  return result;
}

// ============================================================
// Absensi — anggota kelas Sekolah Minggu (Baby, Samuel, Yosua, Musa)
// ============================================================
export async function getMembers({ className = '' } = {}) {
  const filter = className ? { className } : {};
  return withFallback(
    async () => {
      const docs = await ClassMember.find(filter).sort({ name: 1, createdAt: 1 });
      return docs.map(serialize);
    },
    () =>
      [...memory.members]
        .filter((m) => !className || m.className === className)
        .sort((a, b) => a.name.localeCompare(b.name) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  );
}

export async function getMemberById(id) {
  return withFallback(
    async () => serialize(await ClassMember.findById(id)),
    () => memoryFind(memory.members, id)
  );
}

export async function createMember(data) {
  return withFallback(
    async () => serialize(await ClassMember.create(data)),
    () => {
      const item = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      memory.members.push(item);
      return item;
    }
  );
}

export async function updateMember(id, data) {
  return withFallback(
    async () => {
      const doc = await ClassMember.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.members, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
}

export async function deleteMember(id) {
  return withFallback(
    async () => {
      await ClassMember.findByIdAndDelete(id);
      return true;
    },
    () => memoryDelete(memory.members, id)
  );
}

// ============================================================
// Absensi — sesi kehadiran mingguan (1 per kelas per tanggal Minggu)
// ============================================================

// Sesi absensi untuk DITAMPILKAN di admin: hanya sesi yang diisi dalam
// `recentDays` hari terakhir (aturan 1 bulan = 30 hari) — data LAMA tetap
// utuh di database (tidak dihapus), hanya disembunyikan dari daftar agar
// tidak menumpuk. `all: true` mengembalikan semuanya (dipakai export/riwayat).
export async function getAttendance({ recentDays = 30, all = false } = {}) {
  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);
  const filter = (item) => !all && new Date(item.createdAt).getTime() < cutoff.getTime();
  return withFallback(
    async () => {
      const docs = await Attendance.find(all ? {} : { createdAt: { $gte: cutoff } }).sort({
        date: -1,
        createdAt: -1,
      });
      return docs.map(serialize);
    },
    () =>
      [...memory.attendance]
        .filter((s) => !filter(s))
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  );
}

// Semua sesi pada satu tanggal Minggu (semua kelas) — bahan export rekap.
export async function getAttendanceByDate(date) {
  return withFallback(
    async () => {
      const docs = await Attendance.find({ date }).sort({ className: 1, createdAt: 1 });
      return docs.map(serialize);
    },
    () =>
      [...memory.attendance]
        .filter((s) => s.date === date)
        .sort((a, b) => a.className.localeCompare(b.className))
  );
}

// Semua sesi pada satu bulan (YYYY-MM) — bahan export rekap bulanan
// ("Rekap Kehadiran <bulan>"). Diurutkan per tanggal lalu per kelas.
export async function getAttendanceByMonth(monthKey) {
  const re = new RegExp(`^${monthKey}-\\d{2}$`);
  return withFallback(
    async () => {
      const docs = await Attendance.find({ date: { $regex: re } }).sort({
        date: 1,
        className: 1,
        createdAt: 1,
      });
      return docs.map(serialize);
    },
    () =>
      [...memory.attendance]
        .filter((s) => re.test(String(s.date || '')))
        .sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className))
  );
}

// Semua sesi pada satu tahun (YYYY) — bahan export rekap tahunan.
export async function getAttendanceByYear(yearStr) {
  const re = new RegExp(`^${yearStr}-\\d{2}-\\d{2}$`);
  return withFallback(
    async () => {
      const docs = await Attendance.find({ date: { $regex: re } }).sort({
        date: 1,
        className: 1,
        createdAt: 1,
      });
      return docs.map(serialize);
    },
    () =>
      [...memory.attendance]
        .filter((s) => re.test(String(s.date || '')))
        .sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className))
  );
}

// Satu sesi (kelas + tanggal) — dipakai preload form absensi.
export async function getAttendanceByClassDate(className, date) {
  return withFallback(
    async () => serialize(await Attendance.findOne({ className, date })),
    () => memory.attendance.find((s) => s.className === className && s.date === date) || null
  );
}

export async function getAttendanceById(id) {
  return withFallback(
    async () => serialize(await Attendance.findById(id)),
    () => memoryFind(memory.attendance, id)
  );
}

// Simpan/isi ulang absensi: kelas + tanggal yang sama → perbarui (upsert),
// jangan duplikat (sama seperti pola jadwal mingguan).
export async function upsertAttendance({ className, date, entries }) {
  const data = { className, date, entries };
  return withFallback(
    async () =>
      serialize(
        await Attendance.findOneAndUpdate({ className, date }, data, {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: true,
        })
      ),
    () => {
      const idx = memory.attendance.findIndex((s) => s.className === className && s.date === date);
      if (idx !== -1) {
        const updated = { ...memory.attendance[idx], ...data, id: memory.attendance[idx].id };
        updated.updatedAt = new Date().toISOString();
        memory.attendance[idx] = updated;
        return updated;
      }
      const item = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      memory.attendance.push(item);
      return item;
    }
  );
}

export async function updateAttendance(id, data) {
  return withFallback(
    async () => {
      const doc = await Attendance.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.attendance, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
}

export async function deleteAttendance(id) {
  return withFallback(
    async () => {
      const res = await Attendance.findByIdAndDelete(id);
      return Boolean(res);
    },
    () => memoryDelete(memory.attendance, id)
  );
}

// ============================================================
// Absensi — arsip tahunan (menu Kelola Absensi)
// ============================================================

export async function getAttendanceArchive() {
  const sessions = await withFallback(
    async () => {
      const docs = await Attendance.find({}).sort({ date: 1 });
      return docs.map(serialize);
    },
    () => [...memory.attendance].sort((a, b) => a.date.localeCompare(b.date))
  );

  // Jendela 1 tahun = TAHUN KALENDER berjalan (Januari–Desember), bukan
  // 12 bulan berjalan dari hari ini.
  const year = new Date().getFullYear();
  const keys = [];
  for (let m = 1; m <= 12; m += 1) {
    keys.push(`${year}-${String(m).padStart(2, '0')}`);
  }
  const months = keys.map((key) => ({
    key,
    sessions: 0,
    hadir: 0,
    totalEntries: 0,
  }));
  const byKey = {};
  months.forEach((m) => {
    byKey[m.key] = m;
  });

  let olderCount = 0;
  let olderHadir = 0;
  let totalSessions = sessions.length;
  let totalHadir = 0;
  let totalEntries = 0;

  sessions.forEach((s) => {
    const entries = s.entries || [];
    const hadir = entries.filter((e) => e.present).length;
    const key = String(s.date || '').slice(0, 7);
    const month = byKey[key];
    if (month) {
      month.sessions += 1;
      month.hadir += hadir;
      month.totalEntries += entries.length;
    } else {
      olderCount += 1;
      olderHadir += hadir;
    }
    totalHadir += hadir;
    totalEntries += entries.length;
  });

  const oldestDate = sessions[0]?.date || null;
  const newestDate = sessions[sessions.length - 1]?.date || null;

  // Tombol hapus muncul bila sudah ada data dari TAHUN SEBELUMNYA
  // (artinya data telah melewati satu tahun kalender penuh) — cegah penumpukan.
  const canDelete = Boolean(oldestDate && oldestDate < `${year}-01-01`);

  return {
    months,
    olderCount,
    olderHadir,
    totalSessions,
    totalHadir,
    totalEntries,
    oldestDate,
    newestDate,
    canDelete,
  };
}

// Hapus SEMUA data absensi secara permanen (dipakai setelah 1 tahun penuh).
// Mengembalikan jumlah sesi yang dihapus.
export async function clearAllAttendance() {
  return withFallback(
    async () => {
      const res = await Attendance.deleteMany({});
      return res.deletedCount || 0;
    },
    () => {
      const n = memory.attendance.length;
      memory.attendance.splice(0, n);
      return n;
    }
  );
}

// ============================================================
// Registrasi pendaftaran event
// ============================================================
export async function getRegistrations({ eventId = '' } = {}) {
  const filter = eventId ? { eventId } : {};
  return withFallback(
    async () => {
      const docs = await Registration.find(filter).sort({ createdAt: -1 });
      return docs.map(serialize);
    },
    () =>
      [...memory.registrations]
        .filter((r) => !eventId || r.eventId === eventId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  );
}

export async function createRegistration(data) {
  return withFallback(
    async () => serialize(await Registration.create(data)),
    () => {
      const item = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      memory.registrations.push(item);
      return item;
    }
  );
}

export async function deleteRegistration(id) {
  return withFallback(
    async () => {
      const res = await Registration.findByIdAndDelete(id);
      return Boolean(res);
    },
    () => memoryDelete(memory.registrations, id)
  );
}

export async function clearRegistrations(eventId) {
  const filter = eventId ? { eventId } : {};
  return withFallback(
    async () => {
      const res = await Registration.deleteMany(filter);
      return res.deletedCount || 0;
    },
    () => {
      if (eventId) {
        const before = memory.registrations.length;
        memory.registrations = memory.registrations.filter((r) => r.eventId !== eventId);
        return before - memory.registrations.length;
      }
      const n = memory.registrations.length;
      memory.registrations.splice(0, n);
      return n;
    }
  );
}

// ============================================================
// Log aktivitas admin (menu Aktivitas)
// ============================================================

// Catat aktivitas admin. Tidak pernah melempar error — kegagalan logging
// tidak boleh menggagalkan operasi utama (dipakai fire-and-forget).
export async function logActivity({ username = '', module = '', action = '', detail = '' } = {}) {
  const data = {
    username: String(username).slice(0, 60),
    module: String(module).slice(0, 20),
    action: String(action).slice(0, 20),
    detail: String(detail).slice(0, 300),
  };
  if (isDbEnabled()) {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        await ActivityLog.create({ ...data, at: new Date() });
        return;
      }
    } catch (error) {
      console.warn('[eluzai] Gagal menyimpan log aktivitas ke MongoDB:', error.message);
    }
  }
  memory.activities.push({ id: randomUUID(), ...data, at: new Date().toISOString() });
}

export async function getActivities({ limit = 200, module = '' } = {}) {
  const filter = module ? { module } : {};
  return withFallback(
    async () => {
      const docs = await ActivityLog.find(filter).sort({ at: -1 }).limit(limit);
      return docs.map(serialize);
    },
    () =>
      [...memory.activities]
        .filter((a) => !module || a.module === module)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, limit)
  );
}

// ============================================================
// User admin (multi-user) — dibuat via /api/dev/users
// ============================================================
export async function findUserByUsername(username) {
  const uname = String(username || '').toLowerCase().trim();
  if (!uname) return null;
  return withFallback(
    async () => serialize(await User.findOne({ username: uname })),
    () => memory.users.find((u) => u.username === uname) || null
  );
}

export async function listUsers() {
  return withFallback(
    async () => {
      const docs = await User.find().sort({ createdAt: 1 });
      return docs.map(serialize);
    },
    () => [...memory.users]
  );
}

export async function createUser(data) {
  return withFallback(
    async () => serialize(await User.create(data)),
    () => {
      const item = {
        id: randomUUID(),
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString(),
        ...data,
      };
      memory.users.push(item);
      return item;
    }
  );
}

export async function updateUser(id, data) {
  return withFallback(
    async () => {
      const doc = await User.findByIdAndUpdate(id, data, { new: true });
      return serialize(doc);
    },
    () => {
      const item = memoryFind(memory.users, id);
      if (!item) return null;
      Object.assign(item, data, { id });
      item.updatedAt = new Date().toISOString();
      return item;
    }
  );
}

export async function deleteUser(id) {
  return withFallback(
    async () => {
      await User.findByIdAndDelete(id);
      return true;
    },
    () => memoryDelete(memory.users, id)
  );
}

// ============================================================
// Statistik untuk dashboard admin
// ============================================================
export async function getStats() {
  const [events, banners, schedules] = await Promise.all([
    getEvents(),
    getBanners(),
    getSchedules(),
  ]);
  return {
    events: events.length,
    banners: banners.length,
    schedules: schedules.length,
  };
}

// ============================================================
// Slug helper
// ============================================================
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

// ============================================================
// Dev Console — hapus satu log aktivitas (menu Aktivitas)
// ============================================================
export async function deleteActivity(id) {
  return withFallback(
    async () => {
      const res = await ActivityLog.findByIdAndDelete(id);
      return Boolean(res);
    },
    () => memoryDelete(memory.activities, id)
  );
}

// ============================================================
// Dev Console — hapus SEMUA log aktivitas (menu Aktivitas)
// ============================================================
export async function clearActivities() {
  return withFallback(
    async () => {
      const res = await ActivityLog.deleteMany({});
      return res.deletedCount || 0;
    },
    () => {
      const n = memory.activities.length;
      memory.activities.splice(0, n);
      return n;
    }
  );
}
