'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '../ui/Icons';
import ChurchLogo from '../ui/ChurchLogo';
import LogoutButton from './LogoutButton';
import AdminThemeToggle from './AdminThemeToggle';
import useSiteTheme from '../ui/useSiteTheme';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'home', exact: true },
  { href: '/admin/informasi', label: 'Informasi', icon: 'info' },
  { href: '/admin/jadwal', label: 'Jadwal', icon: 'clock' },
  {
    href: '/admin/absensi',
    label: 'Absensi',
    icon: 'users',
    // Tetap aktif di halaman kelas: /admin/absensi/{baby,samuel,yosua,musa}
    match: (p) => p.startsWith('/admin/absensi'),
  },
  {
    href: '/admin/anggota',
    label: 'Anggota',
    icon: 'user',
    // Tetap aktif di halaman kelas: /admin/anggota/{baby,samuel,yosua,musa}
    match: (p) => p.startsWith('/admin/anggota'),
  },
  { href: '/admin/events', label: 'Event', icon: 'calendar' },
];

function isNavActive(n, pathname) {
  if (n.exact) return pathname === n.href;
  if (n.match) return n.match(pathname);
  return pathname.startsWith(n.href);
}

export default function AdminShell({ children }) {
  const pathname = usePathname();

  // Tema admin INDEPENDEN dari situs publik: kunci 'eluzai-admin-theme'
  // (default light). Saat masuk area admin, tema area ini diterapkan.
  useSiteTheme('eluzai-admin-theme');

  return (
    <div className="admin-shell d-flex">
      <aside className="admin-sidebar d-none d-md-flex flex-column p-3" style={{ width: 260 }}>
        <Link href="/admin" className="d-flex align-items-center gap-2 text-decoration-none mb-4 px-2 pt-2">
          <ChurchLogo size={38} style={{ borderRadius: 10 }} />
          <span className="fw-bold text-dark">Eluzai Admin</span>
        </Link>

        <nav className="d-flex flex-column gap-1 flex-grow-1">
          {NAV.map((n) => {
            const active = isNavActive(n, pathname);
            return (
              <Link key={n.href} href={n.href} className={`nav-link ${active ? 'active' : ''}`}>
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="d-flex flex-column gap-2 mt-4">
          <AdminThemeToggle />
          <Link
            href="/"
            target="_blank"
            className="btn btn-sm w-100 d-flex align-items-center gap-2 justify-content-start px-3"
            style={{ color: 'var(--eluzai-muted)', border: '1px solid var(--eluzai-border)', borderRadius: 10 }}
          >
            <Icon name="external" size={17} />
            Lihat Situs
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Sidebar mobile (hanya tampil di bawah breakpoint md) */}
      <div className="d-md-none w-100 position-fixed top-0 start-0" style={{ zIndex: 1040 }}>
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{ background: 'var(--eluzai-surface)', borderBottom: '1px solid var(--eluzai-border)' }}
        >
          <Link href="/admin" className="d-flex align-items-center gap-2 text-decoration-none">
            <ChurchLogo size={34} style={{ borderRadius: 9 }} />
            <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>Eluzai Admin</span>
          </Link>
          <div className="d-flex gap-2">
            <AdminThemeToggle compact />
            <Link
              href="/"
              target="_blank"
              className="icon-btn"
              style={{ color: 'var(--eluzai-muted)', borderColor: 'var(--eluzai-border)' }}
            >
              <Icon name="external" size={16} />
            </Link>
            <LogoutButton compact />
          </div>
        </div>
        <div
          className="d-flex gap-1 flex-wrap px-3 py-2"
          style={{ background: 'var(--eluzai-bg)', borderBottom: '1px solid var(--eluzai-border)' }}
        >
          {NAV.map((n) => {
            const active = isNavActive(n, pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="btn btn-sm"
                style={
                  active
                    ? { background: 'var(--eluzai-blue)', color: '#fff' }
                    : { color: 'var(--eluzai-muted)' }
                }
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="admin-main flex-grow-1" style={{ padding: '1.25rem', minWidth: 0 }}>
        <div className="container-fluid px-0 px-md-2" style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
