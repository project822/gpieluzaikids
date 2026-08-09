// Unit test — lib/sanitize.js
// Jalankan: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeString,
  sanitizePayload,
  isValidImage,
  MAX_IMAGE_CHARS,
} from '../lib/sanitize.js';

describe('sanitizeString (anti Stored XSS)', () => {
  test('menghapus tag HTML — teks di dalam tag tetap jadi teks inert', () => {
    // Kontrak: tag dihapus, isi teks dipertahankan — "alert(1)" menjadi teks
    // biasa yang di-render aman oleh React auto-escape (bukan dieksekusi).
    assert.equal(sanitizeString('<script>alert(1)</script>Nama'), 'alert(1)Nama');
    assert.equal(sanitizeString('<b>Tebal</b>'), 'Tebal');
    assert.equal(sanitizeString('<script>alert(1)</script>'), 'alert(1)');
  });

  test('menghapus tag dengan atribut on* (onerror, onload, dll.)', () => {
    assert.equal(sanitizeString('<img src=x onerror=alert(1)>Hai'), 'Hai');
    assert.equal(sanitizeString('<svg onload=alert(1)>'), '');
  });

  test('trim whitespace + null-safe', () => {
    assert.equal(sanitizeString('  halo  '), 'halo');
    assert.equal(sanitizeString(null), '');
    assert.equal(sanitizeString(undefined), '');
  });
});

describe('sanitizePayload', () => {
  test('membuang key prototipe berbahaya (anti prototype pollution)', () => {
    // JSON.parse dipakai agar __proto__ menjadi OWN key sungguhan —
    // dalam object literal, `__proto__:` justru MENETAPKAN prototype
    // (bukan own key), jadi Object.entries() tidak akan melihatnya.
    const payload = JSON.parse(
      '{"title":"X","__proto__":{"polluted":1},"constructor":{"prototype":{"x":1}},"prototype":{"y":2}}'
    );
    const out = sanitizePayload(payload);
    assert.deepEqual(Object.keys(out).sort(), ['title']);
    assert.equal({}.polluted, undefined);
  });

  test('menjaga field image apa adanya (base64 tidak dirusak)', () => {
    const img = 'data:image/png;base64,AAA=';
    const out = sanitizePayload({ title: '<b>X</b>', image: img });
    assert.equal(out.title, 'X');
    assert.equal(out.image, img);
  });

  test('sanitasi rekursif objek & array bersarang', () => {
    const out = sanitizePayload({
      a: { b: '<i>y</i>' },
      list: ['<u>z</u>', 42, { deep: '<a>w</a>' }],
    });
    assert.equal(out.a.b, 'y');
    assert.deepEqual(out.list, ['z', 42, { deep: 'w' }]);
  });

  test('nilai non-string dipertahankan', () => {
    const out = sanitizePayload({ n: 5, ok: true, nil: null, arr: [1, 2] });
    assert.deepEqual(out, { n: 5, ok: true, nil: null, arr: [1, 2] });
  });

  test('non-objek dikembalikan apa adanya', () => {
    assert.equal(sanitizePayload(null), null);
    assert.equal(sanitizePayload('x'), 'x');
  });
});

describe('isValidImage (whitelist MIME + anti-SVG)', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  test('menerima PNG/JPG/JPEG/WebP', () => {
    assert.equal(isValidImage(PNG), true);
    assert.equal(isValidImage('data:image/jpeg;base64,AAAA'), true);
    assert.equal(isValidImage('data:image/jpg;base64,AAAA'), true);
    assert.equal(isValidImage('data:image/webp;base64,AAAA'), true);
  });

  test('MENOLAK SVG — skrip inline bisa tereksekusi saat file dibuka (stored XSS)', () => {
    assert.equal(isValidImage('data:image/svg+xml;base64,PHN2Zz4='), false);
    assert.equal(isValidImage('data:image/svg+xml,<svg onload=alert(1)>'), false);
  });

  test('menolak payload yang memuat karakter < > (HTML mentah)', () => {
    assert.equal(isValidImage(`${PNG}<img src=x onerror=alert(1)>`), false);
  });

  test('menolak MIME di luar whitelist', () => {
    assert.equal(isValidImage('data:image/gif;base64,AAAA'), false);
    assert.equal(isValidImage('data:image/bmp;base64,AAAA'), false);
    assert.equal(isValidImage('data:text/html;base64,AAAA'), false);
    assert.equal(isValidImage('https://evil.example/x.png'), false);
  });

  test('menolak non-string, kosong, dan melampaui batas ukuran', () => {
    assert.equal(isValidImage(''), false);
    assert.equal(isValidImage(null), false);
    assert.equal(isValidImage(123), false);
    assert.equal(isValidImage(`data:image/png;base64,${'A'.repeat(MAX_IMAGE_CHARS)}`), false);
  });
});
