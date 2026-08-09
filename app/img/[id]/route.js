import { getEventById, getBannerById } from '@/lib/repo';
import { cacheParsedImage, getCachedImage } from '@/lib/imageCache';

// ============================================================
// Route gambar — SECURITY.md § 3.15 (Cache-Control).
// Mengubah gambar yang tersimpan sebagai data-URL (base64 /
// percent-encoded SVG) menjadi respons biner dengan
// `Cache-Control: public, max-age=31536000, immutable`.
//
// URL memakai cache-buster ?v=<updatedAt> sehingga saat admin
// mengganti gambar, URL baru dipakai dan browser tidak
// menyajikan cache lama.
//
// Alasan performa: halaman publik menjadi ringan (HTML berisi
// URL /img/..., bukan puluhan KB–MB base64 per foto).
// ============================================================

const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(;[^,]*)?,(.*)$/is;

function parseDataUrl(value) {
  const m = DATA_URL_RE.exec(value);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const meta = m[2] || '';
  const payload = m[3];
  // Hanya izinkan gambar — jangan pernah menyajikan mime lain.
  if (!/^image\//.test(mime)) return null;
  let buf;
  if (/;base64/i.test(meta)) {
    buf = Buffer.from(payload, 'base64');
  } else {
    try {
      buf = Buffer.from(decodeURIComponent(payload), 'utf8');
    } catch {
      return null;
    }
  }
  return { mime, buf };
}

export async function GET(_request, { params }) {
  const { id } = await params;

  // Cache parse: gambar immutable (ada ?v=), tidak perlu di-decode ulang.
  const cached = getCachedImage(id);
  if (cached) return respondImage(cached);

  // Query SEKUENSIAL: cari event dulu, banner hanya jika event tidak ada.
  // (Promise.all dengan id berbentuk ObjectId akan membuat model lain
  //  melempar CastError → log error palsu + fallback sia-sia di mode Mongo.)
  let item = await getEventById(id);
  if (!item) item = await getBannerById(id);
  if (!item?.image) return new Response('Not Found', { status: 404 });

  const parsed = parseDataUrl(item.image);
  // Batasi ukuran yang disajikan (anti abuse; upload maks ±4MB → base64 ±5.6MB).
  if (!parsed || parsed.buf.length === 0 || parsed.buf.length > 8 * 1024 * 1024) {
    return new Response('Not Found', { status: 404 });
  }
  cacheParsedImage(id, parsed);

  return respondImage(parsed);
}

function respondImage(parsed) {
  return new Response(new Uint8Array(parsed.buf), {
    headers: {
      'Content-Type': parsed.mime,
      'Content-Length': String(parsed.buf.length),
      // immutable: aman karena ?v= berubah saat gambar diganti admin.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Netralkan eksekusi skrip pada SVG warisan/data demo bila file
      // dibuka langsung di browser (upload SVG baru sudah diblokir di
      // lib/sanitize.js). Tidak berpengaruh pada gambar raster.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
