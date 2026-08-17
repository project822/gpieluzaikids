import { getRegistrations, createRegistration, getEventById } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { sanitizeString } from '@/lib/sanitize';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{8,15}$/;

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const eventId = sp.get('eventId') || '';
    const list = await getRegistrations({ eventId });
    return Response.json({ data: list });
  } catch (error) {
    console.error('[api/registrations GET]', error);
    return Response.json({ error: 'Gagal memuat data pendaftaran.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const whatsapp = String(body.whatsapp || '').trim();
    const eventId = String(body.eventId || '').trim();

    if (!fullName || fullName.length < 2) {
      return Response.json({ error: 'Nama lengkap wajib diisi (minimal 2 karakter).' }, { status: 400 });
    }
    if (fullName.length > 100) {
      return Response.json({ error: 'Nama lengkap maksimal 100 karakter.' }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return Response.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
    }
    if (!whatsapp || !PHONE_RE.test(whatsapp)) {
      return Response.json({ error: 'Nomor WhatsApp tidak valid (8-15 digit angka, tanpa spasi atau simbol).' }, { status: 400 });
    }
    if (!eventId) {
      return Response.json({ error: 'Event tidak valid.' }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event) {
      return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    }
    if (!event.formActive) {
      return Response.json({ error: 'Form pendaftaran untuk event ini belum aktif.' }, { status: 403 });
    }

    // Validasi custom fields berdasarkan definisi di event
    const customFields = {};
    const eventFields = Array.isArray(event.customFormFields) ? event.customFormFields : [];
    const rawCustom = body.customFields && typeof body.customFields === 'object' ? body.customFields : {};

    for (const field of eventFields) {
      const value = rawCustom[field.label];
      const strVal = value !== undefined && value !== null ? String(value).trim() : '';

      if (field.required && !strVal) {
        return Response.json({ error: `Field "${field.label}" wajib diisi.` }, { status: 400 });
      }

      if (strVal) {
        // Validasi tipe
        if (field.type === 'email' && !EMAIL_RE.test(strVal)) {
          return Response.json({ error: `Field "${field.label}" harus berupa email yang valid.` }, { status: 400 });
        }
        if (field.type === 'tel' && !/^[0-9]{6,15}$/.test(strVal)) {
          return Response.json({ error: `Field "${field.label}" harus berupa nomor telepon yang valid.` }, { status: 400 });
        }
        if (field.type === 'number' && (isNaN(Number(strVal)) || strVal === '')) {
          return Response.json({ error: `Field "${field.label}" harus berupa angka.` }, { status: 400 });
        }
        if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(strVal)) {
          return Response.json({ error: `Field "${field.label}" memiliki pilihan yang tidak valid.` }, { status: 400 });
        }
        if (strVal.length > 500) {
          return Response.json({ error: `Field "${field.label}" maksimal 500 karakter.` }, { status: 400 });
        }
        customFields[field.label] = sanitizeString(strVal);
      }
    }

    const item = await createRegistration({
      eventId,
      eventName: event.title,
      fullName,
      email,
      whatsapp,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });

    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/registrations POST]', error);
    return Response.json({ error: 'Gagal menyimpan pendaftaran.' }, { status: 500 });
  }
}
