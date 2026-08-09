import { getBanners, createBanner, slugify, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload, isValidImage } from '@/lib/sanitize';

export async function GET() {
  try {
    const list = await getBanners();
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/banners GET]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    if (!isValidImage(body.image)) {
      return Response.json(
        { error: 'Gambar banner wajib diisi (PNG/JPG/WebP, maks 4MB).' },
        { status: 400 }
      );
    }
    const result = await createBanner({
      ...body,
      slug: slugify(body.slug || body.title || 'banner'),
    });
    // Aturan maks 1 banner: createBanner mengganti banner lama → beri tahu admin.
    logActivity({
      username: auth.username,
      module: 'banner',
      action: 'create',
      detail: result.replaced
        ? 'Mengganti banner informasi dengan yang baru.'
        : 'Menambahkan banner informasi baru.',
    }).catch(() => {});
    return Response.json(
      { data: result.item, replaced: result.replaced },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/banners POST]', error);
    return Response.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
