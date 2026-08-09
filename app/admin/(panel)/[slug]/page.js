import { notFound } from 'next/navigation';
import ClassPage from '@/components/admin/ClassPage';
import { CLASS_VALUES } from '@/lib/attendanceValidation';

export const metadata = { title: 'Kelas' };

// Halaman per kelas: /admin/baby, /admin/samuel, /admin/yosua, /admin/musa.
// Berisi daftar anggota + form absensi mingguan kelas tersebut.
// ?date=YYYY-MM-DD (Hari Minggu) → form langsung menampilkan minggu itu.
export default async function AdminClassPage({ params, searchParams }) {
  const { slug } = await params;
  if (!CLASS_VALUES.includes(slug)) notFound();

  const sp = await searchParams;
  const initialDate = typeof sp?.date === 'string' ? sp.date : '';
  return <ClassPage className={slug} initialDate={initialDate} />;
}
