import { getRegistrations, createRegistration, getEventById } from '@/lib/repo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{8,15}$/;

export async function GET(request) {
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

    const item = await createRegistration({
      eventId,
      eventName: event.title,
      fullName,
      email,
      whatsapp,
    });

    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[api/registrations POST]', error);
    return Response.json({ error: 'Gagal menyimpan pendaftaran.' }, { status: 500 });
  }
}
