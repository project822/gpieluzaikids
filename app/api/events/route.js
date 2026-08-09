import { getEvents, createEvent, slugify, logActivity } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { requiredFieldsError } from '@/lib/eventValidation';
import { sanitizePayload, isValidImage } from '@/lib/sanitize';

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
    if (!isValidImage(body.image)) {
      return Response.json(
        { error: 'Gambar event tidak valid (PNG/JPG/WebP, maks 4MB).' },
        { status: 400 }
      );
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
