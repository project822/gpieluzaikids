// Unit test — filter URL (lib/format.js + lib/eventValidation.js)
// Jalankan: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { safeExternalUrl } from '../lib/format.js';
import {
  isValidExternalUrl,
  invalidUrlFields,
  invalidUrlsError,
  requiredFieldsError,
} from '../lib/eventValidation.js';

describe('safeExternalUrl — filter render (defense-in-depth)', () => {
  test('hanya http/https yang dirender sebagai href', () => {
    assert.equal(safeExternalUrl('https://maps.google.com/?q=eluzai'), 'https://maps.google.com/?q=eluzai');
    assert.equal(safeExternalUrl('http://a.b/c?x=1'), 'http://a.b/c?x=1');
  });

  test('skema berbahaya dinetralkan menjadi null', () => {
    assert.equal(safeExternalUrl('javascript:alert(1)'), null);
    assert.equal(safeExternalUrl('data:text/html,<script>x</script>'), null);
    assert.equal(safeExternalUrl('vbscript:msgbox(1)'), null);
    assert.equal(safeExternalUrl('file:///etc/passwd'), null);
  });

  test('trim whitespace & nilai aneh', () => {
    assert.equal(safeExternalUrl('  https://ok.com/a  '), 'https://ok.com/a');
    assert.equal(safeExternalUrl('https://x.com" onmouseover="alert(1)'), null);
    assert.equal(safeExternalUrl(''), null);
    assert.equal(safeExternalUrl(null), null);
    assert.equal(safeExternalUrl(undefined), null);
  });
});

describe('isValidExternalUrl (validasi input API)', () => {
  test('field kosong dianggap valid (opsional)', () => {
    assert.equal(isValidExternalUrl(''), true);
    assert.equal(isValidExternalUrl(null), true);
  });

  test('http/https valid', () => {
    assert.equal(isValidExternalUrl('https://forms.gle/abc123'), true);
    assert.equal(isValidExternalUrl('http://localhost:3000/x'), true);
  });

  test('skema berbahaya tidak valid', () => {
    assert.equal(isValidExternalUrl('javascript:alert(1)'), false);
    assert.equal(isValidExternalUrl('data:text/html,hi'), false);
    assert.equal(isValidExternalUrl('https://x.com/path with space'), false);
  });
});

describe('invalidUrlFields / invalidUrlsError', () => {
  test('hanya memeriksa field yang ADA di body (penting untuk PUT parsial)', () => {
    assert.deepEqual(invalidUrlFields({ mapsLink: 'javascript:x' }), ['mapsLink']);
    assert.deepEqual(invalidUrlFields({ title: 'X' }), []);
    assert.deepEqual(invalidUrlFields({ formLink: 'https://ok.com' }), []);
  });

  test('field null/nil dilewati', () => {
    assert.deepEqual(invalidUrlFields({ formLink: null }), []);
  });

  test('invalidUrlsError: null bila bersih, pesan bila ada yang rusak', () => {
    assert.equal(invalidUrlsError({ mapsLink: 'https://maps.google.com', title: 'X' }), null);
    const err = invalidUrlsError({ mapsLink: 'javascript:alert(1)' });
    assert.ok(err.includes('mapsLink'));
  });
});

describe('requiredFieldsError', () => {
  test('mendeteksi field wajib yang kosong', () => {
    const err = requiredFieldsError({ title: 'X' });
    assert.ok(err.includes('Tema') || err.includes('theme'));
  });

  test('null bila semua field wajib terisi', () => {
    const full = {
      title: 'A',
      theme: 'B',
      image: 'C',
      date: '2026-12-20',
      openGate: '07:30',
      time: '09:00',
      location: 'L',
      mapsLink: 'https://m.example',
      formLink: 'https://f.example',
    };
    assert.equal(requiredFieldsError(full), null);
  });
});
