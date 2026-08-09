import { notFound } from 'next/navigation';
import MembersClassPage from '@/components/admin/MembersClassPage';
import { CLASS_VALUES } from '@/lib/attendanceValidation';

export const metadata = { title: 'Anggota Kelas' };

// Halaman per kelas: /admin/anggota/baby, /admin/anggota/samuel, dll.
// Berisi form penambahan anggota + daftar anggota (dipakai untuk absensi).
export default async function AdminMembersClassPage({ params }) {
  const { slug } = await params;
  if (!CLASS_VALUES.includes(slug)) notFound();
  return <MembersClassPage className={slug} />;
}
