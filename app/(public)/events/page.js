import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import EventArchive from '@/components/user/EventArchive';
import Icon from '@/components/ui/Icons';
import { getEvents } from '@/lib/repo';
import { publicEvent } from '@/lib/format';

export const metadata = { title: 'Arsip Event' };

export const revalidate = 60;

export default async function EventsArchivePage() {
  // publicEvent: buang data-URL base64 sebelum dikirim ke komponen client
  // (EventArchive) agar RSC payload tetap ringan — gambar lewat /img/[id].
  const events = (await getEvents()).map(publicEvent);

  return (
    <>
      <PageHeader
        title="Semua Event"
        sub="Jelajahi seluruh kegiatan jemaat."
      />
      <section className="section pt-4">
        <div className="container">
          <div className="mb-4">
            <Link href="/#event" className="btn btn-eluzai-outline btn-sm px-3">
              <Icon name="chevron-left" size={16} className="me-1" /> Kembali
            </Link>
          </div>
          <EventArchive events={events} />
        </div>
      </section>
    </>
  );
}
