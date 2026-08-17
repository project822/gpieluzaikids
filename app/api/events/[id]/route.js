import { updateEvent, deleteEvent, getEventById, slugify, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { requiredFieldsError, invalidUrlsError } from '@/lib/eventValidation';
import { sanitizePayload, isValidImage, sanitizeString } from '@/lib/sanitize';

const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'select', 'checkbox', 'textarea'];

function sanitizeCustomFormFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f === 'object' && f.label)
    .slice(0, 20)
    .map((f) => ({
      label: sanitizeString(String(f.label || '').slice(0, 100)),
      type: FIELD_TYPES.includes(f.type) ? f.type : 'text',
      required: Boolean(f.required),
      options: Array.isArray(f.options)
        ? f.options.map((o) => sanitizeString(String(o || '').slice(0, 200))).filter(Boolean).slice(0, 50)
        : [],
      placeholder: sanitizeString(String(f.placeholder || '').slice(0, 200)),
    }))
    .filter((f) => f.label);
}

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
    // Sanitasi customFormFields bila dikirim
    if ('customFormFields' in body) {
      body.customFormFields = sanitizeCustomFormFields(body.customFormFields);
    }
    // Sanitasi formTitle
    if ('formTitle' in body) {
      body.formTitle = sanitizeString(String(body.formTitle || '').slice(0, 100));
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
    // Mutual exclusion: formLink dan formActive tidak boleh aktif bersamaan
    if ('formLink' in body && body.formLink && body.formLink.trim()) {
      body.formActive = false;
    }
    if ('formActive' in body && body.formActive) {
      body.formLink = '';
    }
    const payload = { ...body };
    // Jangan timpa slug saat quick-edit (payload tanpa title/slug).
    if (body.slug || body.title) payload.slug = slugify(body.slug || body.title);
    const item = await updateEvent(id, payload);
    if (!item) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    // Log aktivitas: form pendaftaran (aktif/nonaktif) atau update umum.
    if ('formActive' in body && body.formActive !== existing?.formActive) {
      logActivity({
        username: auth.username,
        module: 'event',
        action: 'update',
        detail: body.formActive
          ? `Mengaktifkan form pendaftaran "${item.title}".`
          : `Menonaktifkan form pendaftaran "${item.title}".`,
      }).catch(() => {});
    } else {
      logActivity({
        username: auth.username,
        module: 'event',
        action: 'update',
        detail: `Memperbarui event "${item.title}".`,
      }).catch(() => {});
    }
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
