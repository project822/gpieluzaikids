import { updateEvent, deleteEvent, getEventById, slugify, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { requiredFieldsError, invalidUrlsError } from '@/lib/eventValidation';
import { sanitizePayload, isValidImage } from '@/lib/sanitize';

// Field wajib — hanya dicek saat payload berupa form lengkap (ada title).
// Quick-edit (mis. hanya mengisi link foto) tidak diwajibkan.
export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = sanitizePayload(await request.json());
    const badUrls = invalidUrlsError(body);
    if (badUrls) {
      return Response.json({ error: badUrls }, { status: 400 });
    }
    // Form lengkap (dari modal ubah) → field wajib dicek.
    if ('title' in body) {
      const missingError = requiredFieldsError(body);
      if (missingError) {
        return Response.json({ error: missingError }, { status: 400 });
      }
    }
    // Validasi gambar hanya bila NILAINYA BERUBAH: gambar lama (mis. data
    // demo SVG yang sudah disimpan) tidak diunggah ulang — memblokirnya akan
    // membuat edit event lama gagal. Gambar baru wajib PNG/JPG/WebP.
    const existing = await getEventById(id);
    if (!existing) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    if (body.image && body.image !== existing.image && !isValidImage(body.image)) {
      return Response.json(
        { error: 'Gambar event tidak valid (PNG/JPG/WebP, maks 4MB).' },
        { status: 400 }
      );
    }
    const payload = { ...body };
    // Jangan timpa slug saat quick-edit (payload tanpa title/slug).
    if (body.slug || body.title) payload.slug = slugify(body.slug || body.title);
    const item = await updateEvent(id, payload);
    if (!item) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'event',
      action: 'update',
      detail: `Memperbarui event "${item.title}".`,
    }).catch(() => {});
    return Response.json({ data: item });
  } catch (error) {
    console.error('[api/events PUT]', error);
    return Response.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const item = await getEventById(id);
    if (!item) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    const ok = await deleteEvent(id);
    if (!ok) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    logActivity({
      username: auth.username,
      module: 'event',
      action: 'delete',
      detail: `Menghapus event "${item.title}".`,
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/events DELETE]', error);
    return Response.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
