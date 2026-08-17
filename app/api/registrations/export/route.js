import { getRegistrations, getEventById } from '@/lib/repo';
import { requireAdmin } from '@/lib/auth';
import { buildRegistrationExcel, buildRegistrationPdf } from '@/lib/registrationExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get('type');
    const eventId = sp.get('eventId') || '';

    if (!['excel', 'pdf'].includes(type)) {
      return Response.json({ error: 'Jenis export tidak valid (excel/pdf).' }, { status: 400 });
    }
    if (!eventId) {
      return Response.json({ error: 'Parameter eventId wajib.' }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event) {
      return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    }

    const registrations = await getRegistrations({ eventId });
    if (registrations.length === 0) {
      return Response.json(
        { error: 'Belum ada data pendaftaran untuk event ini.' },
        { status: 404 }
      );
    }

    const eventName = event.title;
    let buffer;
    if (type === 'excel') {
      buffer = await buildRegistrationExcel(registrations, eventName);
    } else {
      buffer = buildRegistrationPdf(registrations, eventName);
    }

    const ext = type === 'excel' ? 'xlsx' : 'pdf';
    const filename = `Rekap Pendaftaran ${eventName}.${ext}`;
    const contentType =
      type === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength || buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/registrations/export GET]', error);
    return Response.json({ error: 'Gagal membuat file export.' }, { status: 500 });
  }
}
