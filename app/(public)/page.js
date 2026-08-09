import HeroSection from '@/components/user/HeroSection';
import InfoSection from '@/components/user/InfoSection';
import ScheduleSection from '@/components/user/ScheduleSection';
import EventsSection from '@/components/user/EventsSection';
import LocationSection from '@/components/user/LocationSection';
import ContactSection from '@/components/user/ContactSection';
import BackToTop from '@/components/ui/BackToTop';
import { getBanners, getEvents, getNearestSchedule } from '@/lib/repo';
import { publicEvent } from '@/lib/format';

export const revalidate = 60;

export default async function HomePage() {
  // publicEvent: buang data-URL base64 dari RSC payload — HTML tetap
  // ringan; gambar event & banner dimuat lewat /img/[id] (cache immutable).
  const [banners, events, nearest] = await Promise.all([
    getBanners(),
    getEvents(),
    getNearestSchedule(),
  ]);
  const lightBanners = banners.map(publicEvent);
  const lightEvents = events.map(publicEvent);

  return (
    <>
      {/* Semua menu tampil dalam satu halaman (single-page landing) */}
      <HeroSection />
      <InfoSection banners={lightBanners} />
      <ScheduleSection date={nearest.date} schedule={nearest.schedule} />
      <EventsSection events={lightEvents} />
      <LocationSection />
      <ContactSection />
      <BackToTop />
    </>
  );
}
