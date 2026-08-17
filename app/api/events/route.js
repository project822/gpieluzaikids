import { getEvents, createEvent, slugify, logActivity } from '@/lib/repo';
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

export async function GET() {
  try {
    const list = await getEvents();
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/events GET]', error);
    return Response.json({ error: 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    const missingError = requiredFieldsError(body);
    if (missingError) {
      return Response.json({ error: missingError }, { status: 400 });
    }
    const badUrls = invalidUrlsError(body);
    if (badUrls) {
      return Response.json({ error: badUrls }, { status: 400 });
    }
    if (!isValidImage(body.image)) {
      return Response.json(
        { error: 'Gambar event tidak valid (PNG/JPG/WebP, maks 4MB).' },
        { status: 400 }
      );
    }
    // Sanitasi customFormFields
    if ('customFormFields' in body) {
      body.customFormFields = sanitizeCustomFormFields(body.customFormFields);
    }
    // Sanitasi formTitle
    if ('formTitle' in body) {
      body.formTitle = sanitizeString(String(body.formTitle || '').slice(0, 100));
    }
    // Mutual exclusion: formLink dan formActive tidak boleh aktif bersamaan
    if (body.formLink && body.formLink.trim()) {
      body.formActive = false;
    }
    if (body.formActive) {
      body.formLink = '';
    }
    const item = await createEvent({ ...body, slug: slugify(body.slug || body.title) });
    logActivity({
      username: auth.username,
      module: 'event',
      action: 'create',
      detail: `Menambahkan event "${body.title}" (${body.date || 'tanpa tanggal'}).`,
    }).catch(() => {});
    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/events POST]', error);
    return Response.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
