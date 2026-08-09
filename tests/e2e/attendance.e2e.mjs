// tests/e2e/attendance.e2e.mjs
// Test integrasi HTTP END-TO-END — server produksi nyata (next start) +
// database MongoDB test terpisah (eluzai_test). Bukan unit test:
//   * auth lewat proxy (cookie JWT httpOnly + CSRF double-submit)
//   * absensi 3-keadaan (present: true/false/null) round-trip via HTTP
//   * export Excel (escape formula injection) & PDF
//   * uji negatif: 401 tanpa autentikasi, 403 tanpa CSRF, 400 input invalid
//
// Menjalankan `next build` terlebih dahulu (script: npm run test:e2e).
// Dilewati otomatis bila MongoDB tidak tersedia (untuk CI tanpa Mongo).
import { test, after } from 'node:test';
import assert from 'node:assert';
import ExcelJS from 'exceljs';
import {
  startTestServer,
  stopTestServer,
  dropTestDatabase,
  getAdminCredentials,
} from '../helpers/e2eServer.mjs';

const ADMIN = getAdminCredentials();
const SUNDAY = '2026-08-16'; // Hari Minggu (2026-08-09 = Minggu, +1 minggu)
const ENTRIES = [
  { memberId: 'e2e-m1', name: '=1+1', present: true },
  { memberId: 'e2e-m2', name: 'Budi Normal', present: false },
  { memberId: 'e2e-m3', name: 'Caca Belum', present: null },
];

// --- cookie jar sederhana (fetch tidak menyimpan cookie otomatis) ---
function createJar() {
  const map = new Map();
  return {
    store(res) {
      const setCookies =
        typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      for (const c of setCookies) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i === -1) continue;
        map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
    header() {
      return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    get(name) {
      return map.get(name) || '';
    },
  };
}

// Sesi login admin: GET /admin/login (dapat cookie CSRF dari proxy) → login.
async function adminJar() {
  const jar = createJar();
  await api('/admin/login', { jar, csrf: false });
  const login = await api('/api/auth/login', {
    jar,
    method: 'POST',
    csrf: false,
    body: { username: ADMIN.username, password: ADMIN.password },
  });
  assert.equal(login.status, 200, `login gagal: ${await login.text()}`);
  assert.ok(jar.get('eluzai_token'), 'cookie sesi (eluzai_token) harus diset');
  return jar;
}

async function api(path, { method = 'GET', body, jar, csrf = true, headers = {} } = {}) {
  const h = { ...headers, cookie: jar.header() };
  if (csrf) h['x-csrf-token'] = jar.get('eluzai_csrf');
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(baseUrl() + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  jar.store(res);
  return res;
}

function baseUrl() {
  if (!ctx.ready) throw new Error('Server E2E belum siap');
  return ctx.baseUrl;
}

// --- setup server (sekali per file) ---
const ctx = await startTestServer();

after(async () => {
  if (ctx.ready) {
    await dropTestDatabase();
    await stopTestServer();
  }
});

const skip = ctx.ready ? false : ctx.reason;

// ============================================================
// Alur utama (happy path)
// ============================================================
test('E2E: login → simpan absensi 3-keadaan → baca ulang → export Excel/PDF → hapus', { skip }, async () => {
  const jar = await adminJar();

  // 1) Simpan absensi dengan 3 keadaan (true/false/null) + nama formula-injection.
  const post = await api('/api/attendance', {
    jar,
    method: 'POST',
    body: { className: 'baby', date: SUNDAY, entries: ENTRIES },
  });
  // clone(): pesan assert dievaluasi eager — jangan menelan body yang
  // masih dibutuhkan untuk .json()/.arrayBuffer() di bawah.
  assert.equal(post.status, 201, `POST absensi: ${(await post.clone().text()).slice(0, 200)}`);
  const created = (await post.json()).data;
  assert.ok(created.id, 'respons harus memuat id sesi');

  // 2) Baca ulang — nilai present harus bulat (tidak berubah jadi boolean salah).
  const get = await api(`/api/attendance?class=baby&date=${SUNDAY}`, { jar });
  assert.equal(get.status, 200);
  const read = (await get.json()).data;
  assert.equal(read.length, 1);
  const entries = read[0].entries;
  assert.deepEqual(
    entries.map((e) => e.present),
    [true, false, null],
    'present true/false/null harus dipertahankan persis'
  );
  assert.deepEqual(
    entries.map((e) => e.name).sort(),
    ['=1+1', 'Budi Normal', 'Caca Belum'].sort()
  );

  // 3) Export Excel — verifikasi escape formula + status 3-keadaan.
  const xlsx = await api(`/api/attendance/export?type=excel&date=${SUNDAY}`, { jar });
  assert.equal(xlsx.status, 200, `export excel: ${(await xlsx.clone().text()).slice(0, 200)}`);
  assert.match(xlsx.headers.get('content-type') || '', /spreadsheetml/);
  assert.match(xlsx.headers.get('content-disposition') || '', /rekap-kehadiran-.*\.xlsx/);
  const buf = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), 'PK', 'file harus .xlsx (zip magic)');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Rekap Kehadiran');
  const names = [];
  const statuses = [];
  ws.eachRow((row) => {
    const c3 = row.getCell(3).value;
    if (typeof c3 === 'string') names.push(c3);
    const c4 = row.getCell(4).value;
    if (typeof c4 === 'string') statuses.push(c4);
  });
  assert.ok(names.includes("'=1+1"), 'nama "=1+1" harus ter-escape dengan kutip awal');
  assert.ok(names.includes('Budi Normal') && names.includes('Caca Belum'));
  assert.ok(
    statuses.includes('Hadir') && statuses.includes('Tidak') && statuses.includes('Belum'),
    `status 3-keadaan di export: ${statuses.join(', ')}`
  );

  // 4) Export PDF — magic %PDF-.
  const pdf = await api(`/api/attendance/export?type=pdf&date=${SUNDAY}`, { jar });
  assert.equal(pdf.status, 200, `export pdf: ${(await pdf.clone().text()).slice(0, 200)}`);
  assert.match(pdf.headers.get('content-type') || '', /application\/pdf/);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

  // 5) Hapus sesi (cleanup langsung).
  const del = await api(`/api/attendance/${created.id}`, { jar, method: 'DELETE' });
  assert.equal(del.status, 200, `DELETE absensi: ${await del.text()}`);
});

// ============================================================
// Uji negatif — otorisasi & validasi
// ============================================================
test('POST absensi TANPA autentikasi → 401 (CSRF valid, tanpa cookie token)', { skip }, async () => {
  const jar = createJar();
  await api('/admin/login', { jar, csrf: false }); // dapat cookie CSRF saja
  const res = await api('/api/attendance', {
    jar,
    method: 'POST',
    body: { className: 'baby', date: SUNDAY, entries: ENTRIES },
  });
  assert.equal(res.status, 401);
});

test('POST absensi TANPA token CSRF → 403 (double-submit ditolak proxy)', { skip }, async () => {
  const jar = createJar(); // kosong — tanpa cookie CSRF & tanpa token
  const res = await api('/api/attendance', {
    jar,
    csrf: false,
    method: 'POST',
    body: { className: 'baby', date: SUNDAY, entries: ENTRIES },
  });
  assert.equal(res.status, 403);
});

test('POST absensi entries kosong → 400 (validasi ditolak)', { skip }, async () => {
  const jar = await adminJar();
  const res = await api('/api/attendance', {
    jar,
    method: 'POST',
    body: { className: 'baby', date: SUNDAY, entries: [] },
  });
  assert.equal(res.status, 400);
});

test('POST absensi present:1 dinormalisasi menjadi null (bukan disimpan)', { skip }, async () => {
  // Perilaku desain: normalizeAttendanceEntries memaksa nilai tak dikenal
  // menjadi null (belum dicatat) — aman, tidak pernah tersimpan sebagai 1.
  const jar = await adminJar();
  const res = await api('/api/attendance', {
    jar,
    method: 'POST',
    body: {
      className: 'baby',
      date: SUNDAY,
      entries: [{ memberId: 'x', name: 'Andi', present: 1 }],
    },
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  const stored = created.data.entries[0];
  assert.equal(stored.present, null);
  // Bersihkan data uji ini.
  const del = await api(`/api/attendance/${created.data.id}`, { jar, method: 'DELETE' });
  assert.equal(del.status, 200);
});

test('POST absensi kelas tidak dikenal → 400', { skip }, async () => {
  const jar = await adminJar();
  const res = await api('/api/attendance', {
    jar,
    method: 'POST',
    body: { className: 'remaja', date: SUNDAY, entries: ENTRIES },
  });
  assert.equal(res.status, 400);
});

test('login dengan password salah → 401 (tanpa cookie sesi)', { skip }, async () => {
  const jar = createJar();
  await api('/admin/login', { jar, csrf: false });
  const res = await api('/api/auth/login', {
    jar,
    csrf: false,
    method: 'POST',
    body: { username: ADMIN.username, password: 'password-salah-123' },
  });
  assert.equal(res.status, 401);
  assert.equal(jar.get('eluzai_token'), '', 'token tidak boleh terbit saat login gagal');
});

test('GET export TANPA autentikasi → 401', { skip }, async () => {
  const jar = createJar();
  await api('/admin/login', { jar, csrf: false });
  const res = await api(`/api/attendance/export?type=excel&date=${SUNDAY}`, { jar });
  assert.equal(res.status, 401);
});
