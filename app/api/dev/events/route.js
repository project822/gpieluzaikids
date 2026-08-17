import { getEvents } from '@/lib/repo';
import { requireDevKey } from '@/lib/devApi';

// ============================================================
// Daftar event untuk Dev Console.
// GET /api/dev/events → daftar semua event (ringan, tanpa gambar base64)
// Diotentikasi dengan kunci X-Dev-Key (bukan sesi admin).
// ============================================================

export async function GET(request) {
  const denied = requireDevKey(request, 'GET events');
  if (denied) return denied;
  try {
    const events = await getEvents();
    // Kirim data ringan: tanpa field image (base64 besar)
    const light = events.map(({ image, ...rest }) => rest);
    return Response.json({ data: light });
  } catch (error) {
    console.error('[api/dev/events GET]', error);
    return Response.json({ error: 'Gagal memuat data event.' }, { status: 500 });
  }
}
