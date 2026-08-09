// Test — lib/attendanceExport.js (Excel & PDF)
// excelSafe: unit. buildExcel/buildPdf: integrasi (parse-ulang output).
// Jalankan: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert';
import ExcelJS from 'exceljs';
import {
  excelSafe,
  buildExcel,
  buildPdf,
  CHURCH_LINE,
} from '../lib/attendanceExport.js';

describe('excelSafe — anti formula injection', () => {
  test('meng-escape sel yang diawali = + - @', () => {
    assert.equal(excelSafe('=1+1'), "'=1+1");
    assert.equal(excelSafe('=HYPERLINK("http://evil")'), `'=HYPERLINK("http://evil")`);
    assert.equal(excelSafe('+2'), "'+2");
    assert.equal(excelSafe('-cmd'), "'-cmd");
    assert.equal(excelSafe('@SUM(A1)'), "'@SUM(A1)");
  });

  test('meng-escape tab & baris baru', () => {
    assert.equal(excelSafe('a\tb'), "'a\tb");
    assert.equal(excelSafe('a\nb'), "'a\nb");
  });

  test('nilai normal tidak berubah', () => {
    assert.equal(excelSafe('Budi'), 'Budi');
    assert.equal(excelSafe('a=b'), 'a=b');
    assert.equal(excelSafe(''), '');
    assert.equal(excelSafe(null), '');
    assert.equal(excelSafe(123), '123');
  });
});

describe('buildExcel — integrasi', () => {
  // Simulasi data sesi (campuran 3 keadaan + nama formula injection).
  const sessions = [
    {
      className: 'baby',
      entries: [
        { memberId: 'm1', name: '=1+1', present: true },
        { memberId: 'm2', name: 'Budi', present: false },
        { memberId: 'm3', name: 'Caca', present: null },
      ],
    },
    {
      className: 'samuel',
      entries: [{ memberId: 'm4', name: 'Dewi', present: true }],
    },
  ];

  async function readSheet(buf) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb.getWorksheet('Rekap Kehadiran');
  }

  test('menghasilkan Buffer .xlsx yang valid (magic PK = zip)', async () => {
    const buf = await buildExcel(sessions, '2026-08-16');
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
  });

  test('nama anak formula-injection ter-escape setelah di-parse ulang', async () => {
    const ws = await readSheet(await buildExcel(sessions, '2026-08-16'));
    const names = [];
    ws.eachRow((row) => {
      const v = row.getCell(3).value;
      if (typeof v === 'string') names.push(v);
    });
    assert.ok(names.includes("'=1+1"), 'nama "=1+1" harus tersimpan sebagai teks "' + "'=1+1" + '"');
    assert.ok(names.includes('Budi'));
    assert.ok(names.includes('Caca'));
  });

  test('status 3-keadaan dirender Hadir / Tidak / Belum', async () => {
    const ws = await readSheet(await buildExcel(sessions, '2026-08-16'));
    const statuses = [];
    ws.eachRow((row) => {
      const v = row.getCell(4).value;
      if (typeof v === 'string') statuses.push(v);
    });
    assert.ok(statuses.includes('Hadir'));
    assert.ok(statuses.includes('Tidak'));
    assert.ok(statuses.includes('Belum'));
  });

  test('judul, baris gereja, dan ringkasan kehadiran benar', async () => {
    const ws = await readSheet(await buildExcel(sessions, '2026-08-16'));
    let text = '';
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') text += `${cell.value}\n`;
      });
    });
    assert.ok(text.includes('Rekap Kehadiran Minggu'));
    assert.ok(text.includes(CHURCH_LINE));
    assert.ok(text.includes('Baby: 1 hadir / 3 anak'));
    assert.ok(text.includes('Samuel: 1 hadir / 1 anak'));
    assert.ok(text.includes('Total: 2 hadir / 4 anak'));
  });
});

describe('buildPdf — smoke test', () => {
  test('menghasilkan Buffer PDF (magic %PDF-)', () => {
    const buf = buildPdf(
      [{ className: 'baby', entries: [{ memberId: 'm1', name: 'Andi', present: true }] }],
      '2026-08-16'
    );
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  });
});
