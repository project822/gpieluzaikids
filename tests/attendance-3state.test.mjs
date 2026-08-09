// Unit test — lib/attendanceValidation.js (absensi 3-keadaan)
// present: true (hadir) / false (tidak) / null (belum dicatat — default)
// Jalankan: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  isValidAttendanceEntries,
  normalizeAttendanceEntries,
  isValidMemberName,
  isValidClass,
  classLabel,
  CLASS_VALUES,
  localToday,
  nextSundayDate,
  formatSundayLabel,
} from '../lib/attendanceValidation.js';

describe('isValidAttendanceEntries — 3 keadaan present', () => {
  test('true / false / null semuanya diterima', () => {
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: true }]), true);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: false }]), true);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: null }]), true);
    assert.equal(
      isValidAttendanceEntries([
        { memberId: 'm1', name: 'A', present: true },
        { memberId: 'm2', name: 'B', present: null },
        { memberId: 'm3', name: 'C', present: false },
      ]),
      true
    );
  });

  test('nilai present di luar 3 keadaan ditolak', () => {
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A' }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: undefined }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: 1 }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: 'true' }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'A', present: 0 }]), false);
  });

  test('array kosong / bukan array / entri null ditolak', () => {
    assert.equal(isValidAttendanceEntries([]), false);
    assert.equal(isValidAttendanceEntries(null), false);
    assert.equal(isValidAttendanceEntries('x'), false);
    assert.equal(isValidAttendanceEntries([null]), false);
  });

  test('nama anggota wajib valid (1–80 karakter)', () => {
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: '', present: true }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: '  ', present: true }]), false);
    assert.equal(isValidAttendanceEntries([{ memberId: 'm1', name: 'X'.repeat(81), present: true }]), false);
  });
});

describe('normalizeAttendanceEntries', () => {
  test('memetakan ke 3 keadaan + trim nama + batas panjang', () => {
    assert.deepEqual(
      normalizeAttendanceEntries([
        { memberId: 'm1', name: '  Andi ', present: true },
        { memberId: 'm2', name: 'Budi', present: false },
        { memberId: 'm3', name: 'Caca', present: undefined },
      ]),
      [
        { memberId: 'm1', name: 'Andi', present: true },
        { memberId: 'm2', name: 'Budi', present: false },
        { memberId: 'm3', name: 'Caca', present: null },
      ]
    );
  });

  test('entri dengan nama kosong dibuang', () => {
    assert.deepEqual(normalizeAttendanceEntries([{ memberId: 'm1', name: '   ', present: true }]), []);
  });
});

describe('helper lain', () => {
  test('isValidMemberName', () => {
    assert.equal(isValidMemberName('Andi'), true);
    assert.equal(isValidMemberName(''), false);
    assert.equal(isValidMemberName('   '), false);
    assert.equal(isValidMemberName('X'.repeat(81)), false);
  });

  test('isValidClass & classLabel (4 kelas Sekolah Minggu)', () => {
    assert.equal(isValidClass('baby'), true);
    assert.equal(isValidClass('samuel'), true);
    assert.equal(isValidClass('yosua'), true);
    assert.equal(isValidClass('musa'), true);
    assert.equal(isValidClass('remaja'), false);
    assert.equal(classLabel('musa'), 'Musa');
    assert.equal(CLASS_VALUES.length, 4);
  });

  test('nextSundayDate selalu jatuh pada hari Minggu (getDay()===0)', () => {
    for (const d of ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-13']) {
      assert.equal(new Date(`${nextSundayDate(d)}T00:00:00`).getDay(), 0, `nextSundayDate(${d}) bukan Minggu`);
    }
    // Hari ini Minggu → tidak bergeser; Senin → Minggu berikutnya.
    assert.equal(nextSundayDate('2026-08-09'), '2026-08-09');
    assert.equal(nextSundayDate('2026-08-10'), '2026-08-16');
  });

  test('localToday memakai format YYYY-MM-DD', () => {
    assert.match(localToday(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test('formatSundayLabel memuat nama bulan Indonesia', () => {
    assert.ok(formatSundayLabel('2026-08-09').includes('Agustus'));
  });
});
