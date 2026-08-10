import { updateBanner, deleteBanner, getBannerById, slugify, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload, isValidImage, isValidRedirectLink } from '@/lib/sanitize';

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = sanitizePayload(await request.json());
    // Validasi gambar hanya bila NILAINYA BERUBAH — gambar lama (mis. data
    // demo SVG yang sudah tersimpan) tidak diunggah ulang. Gambar baru wajib
    // PNG/JPG/WebP (SVG diblokir, lihat lib/sanitize.js); mengosongkan gambar
    // banner tetap ditolak (banner wajib punya gambar).
    const existing = await getBannerById(id);
    if (!existing) return Response.json({ error: 'Banner tidak ditemukan.' }, { status: 404 });
    if ('image' in body && body.image !== existing.image && !isValidImage(body.image)) {
      return Response.json(
        { error: 'Gambar banner wajib diisi (PNG/JPG/WebP, maks 4MB).' },
        { status: 400 }
      );
    }
    if ('link' in body && !isValidRedirectLink(body.link)) {
      return Response.json(
        { error: 'Tautan banner tidak valid — gunakan https://..., atau jalur internal seperti /event/...' },
        { status: 400 }
      );
    }
    const item = await updateBanner(id, {
      ...body,
      slug: slugify(body.slug || body.title || 'banner'),
    });
    if (!item) return Response.json({ error: 'Banner tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'banner',
      action: 'update',
      detail: 'Memperbarui banner informasi.',
    }).catch(() => {});
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/banners PUT]', error);
    return Response.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getBannerById(id);
    if (!item) return Response.json({ error: 'Banner tidak ditemukan.' }, { status: 404 });
    const ok = await deleteBanner(id);
    if (!ok) return Response.json({ error: 'Banner tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'banner',
      action: 'delete',
      detail: 'Menghapus banner informasi.',
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/banners DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
