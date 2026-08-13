'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tema admin INDEPENDEN dari situs publik: kunci 'eluzai-admin-theme'
  // (default light). Saat masuk area admin, tema area ini diterapkan.
  useSiteTheme('eluzai-admin-theme');

  // Pindah halaman → drawer langsung tertutup (setState ditunda satu tick,
  // pola yang sama dengan halaman lain di project ini — hindari setState
  // sinkron dalam efek).
  useEffect(() => {
    const id = setTimeout(() => setMobileOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  // Drawer terbuka → kunci scroll body & tutup dengan tombol Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="admin-shell d-flex">
      {/* Sidebar desktop */}
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

      {/* Header mobile: hamburger di pojok kiri sebelah logo + aksi */}
      <div className="d-md-none w-100 position-fixed top-0 start-0" style={{ zIndex: 1040 }}>
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{ background: 'var(--eluzai-surface)', borderBottom: '1px solid var(--eluzai-border)' }}
        >
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="icon-btn"
              aria-label="Buka menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" size={18} />
            </button>
          </div>
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
      </div>

      {/* Backdrop saat drawer terbuka */}
      <div
        className={`d-md-none admin-drawer-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar mobile — drawer menumpuk di atas halaman (overlay) */}
      <aside
        className={`d-md-none admin-drawer ${mobileOpen ? 'open' : ''}`}
        aria-label="Menu admin"
        aria-hidden={!mobileOpen}
      >
        <div
          className="d-flex align-items-center justify-content-between px-3 py-3"
          style={{ borderBottom: '1px solid var(--eluzai-border)' }}
        >
          <Link
            href="/admin"
            className="d-flex align-items-center gap-2 text-decoration-none"
            onClick={() => setMobileOpen(false)}
          >
            <ChurchLogo size={34} style={{ borderRadius: 9 }} />
            <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>Eluzai Admin</span>
          </Link>
          <button type="button" className="icon-btn" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className="d-flex flex-column gap-1 p-3 flex-grow-1">
          {NAV.map((n) => {
            const active = isNavActive(n, pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${active ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="d-flex flex-column gap-2 p-3"
          style={{ borderTop: '1px solid var(--eluzai-border)' }}
        >
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

      <main className="admin-main flex-grow-1" style={{ padding: '1.25rem', minWidth: 0 }}>
        <div className="container-fluid px-0 px-md-2" style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
