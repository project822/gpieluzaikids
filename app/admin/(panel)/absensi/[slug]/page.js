import { notFound } from 'next/navigation';
import AttendanceClassPage from '@/components/admin/AttendanceClassPage';
import { CLASS_VALUES } from '@/lib/attendanceValidation';

export const metadata = { title: 'Absensi Kelas' };

// Halaman per kelas: /admin/absensi/baby, /admin/absensi/samuel, dll.
// Berisi form absensi mingguan (2 kotak: Hadir / Tidak) + riwayat kelas.
// ?date=YYYY-MM-DD (Hari Minggu) → form langsung menampilkan minggu itu.
export default async function AdminAttendanceClassPage({ params, searchParams }) {
  const { slug } = await params;
  if (!CLASS_VALUES.includes(slug)) notFound();

  const sp = await searchParams;
  const initialDate = typeof sp?.date === 'string' ? sp.date : '';
  return <AttendanceClassPage className={slug} initialDate={initialDate} />;
}
