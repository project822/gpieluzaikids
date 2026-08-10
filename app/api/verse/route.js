import { revalidatePath } from 'next/cache';
import { getVerseConfig, setVerseConfig } from '@/lib/runtimeState';
import { requireAdmin } from '@/lib/auth';
import { sanitizePayload } from '@/lib/sanitize';
import { logActivity } from '@/lib/repo';

export const dynamic = 'force-dynamic';

// GET /api/verse — baca kutipan ayat hero (dipakai panel admin untuk
// prefill; halaman publik membaca langsung dari lib/runtimeState).
export async function GET() {
  try {
    return Response.json({ data: await getVerseConfig() });
  } catch (error) {
    console.error('[api/verse GET]', error);
    return Response.json({ error: 'Gagal memuat kutipan ayat.' }, { status: 500 });
  }
}

// PUT /api/verse — simpan kutipan ayat hero (khusus admin).
// Kosongkan kedua field untuk kembali ke ayat bawaan (CHURCH di lib/data.js).
export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = sanitizePayload(await request.json());
    const verse = String(body.verse ?? '').trim().slice(0, 500);
    const verseRef = String(body.verseRef ?? '').trim().slice(0, 80);
    await setVerseConfig({ verse, verseRef });
    // Beranda di-ISR (revalidate 60 dtk) — paksa regenerasi segera agar
    // kutipan baru langsung tampil di hero tanpa menunggu jendela cache.
    revalidatePath('/', 'page');
    logActivity({
      username: auth.username,
      module: 'verse',
      action: 'update',
      detail: 'Memperbarui kutipan ayat hero.',
    }).catch(() => {});
    return Response.json({ data: { verse, verseRef } });
  } catch (error) {
    console.error('[api/verse PUT]', error);
    return Response.json({ error: 'Gagal menyimpan kutipan ayat.' }, { status: 500 });
  }
}
