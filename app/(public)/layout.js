import Navbar from '@/components/user/Navbar';
import Footer from '@/components/user/Footer';

// Layout khusus halaman publik (route group (public)).
// Halaman /admin tidak memakai navbar & footer publik ini.
export default function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
