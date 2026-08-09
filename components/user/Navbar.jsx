'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '../ui/Icons';
import ThemeToggle from '../ui/ThemeToggle';
import useSiteTheme from '../ui/useSiteTheme';
import { scrollToAnchor } from '../ui/scrollToAnchor';

const LINKS = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'informasi', label: 'Informasi' },
  { id: 'schedule', label: 'Jadwal' },
  { id: 'event', label: 'Event' },
  { id: 'lokasi', label: 'Lokasi' },
  { id: 'kontak', label: 'Kontak' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  // Tema situs PUBLIK diterapkan di sini (bukan hanya lewat tombol toggle)
  // agar saat kembali dari area admin — termasuk di layar mobile yang menu
  // togglenya sedang tertutup — tema publik kembali dipulihkan dengan benar.
  useSiteTheme('eluzai-public-theme');

  // Efek scroll: ubah tampilan navbar & scroll-spy (menu aktif mengikuti section).
  useEffect(() => {
    const ids = LINKS.map((l) => l.id);

    const onScrollVisual = () => setScrolled(window.scrollY > 12);

    let ticking = false;
    const updateActive = () => {
      ticking = false;
      const line = window.innerHeight * 0.38;
      let current = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // Jika belum ada section melewati garis (bagian atas halaman) → Beranda.
      if (current === null && document.getElementById(ids[0])) current = ids[0];
      setActive(current);
    };
    const onScrollSpy = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActive);
      }
    };

    onScrollVisual();
    updateActive();
    window.addEventListener('scroll', onScrollVisual, { passive: true });
    window.addEventListener('scroll', onScrollSpy, { passive: true });
    window.addEventListener('resize', onScrollSpy, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollVisual);
      window.removeEventListener('scroll', onScrollSpy);
      window.removeEventListener('resize', onScrollSpy);
    };
  }, []);

  // href ikut di-update lewat history.replaceState di scrollToSection agar
  // URL hash tetap mencerminkan section aktif.
  const hrefFor = (id) => (pathname === '/' ? `#${id}` : `/#${id}`);

  // Pendaratan PRESISI: pakai helper bersama (scrollToAnchor) yang menghitung
  // tinggi header AKTUAL saat itu — tidak bergantung scroll-padding-top yang
  // bisa diabaikan browser bila body menjadi scroll container (overflow-x).
  // Menu mobile ditutup dulu agar tinggi header kembali normal sebelum hitung.
  const scrollToSection = (e, id) => {
    if (pathname !== '/') return; // navigasi antar-halaman: biarkan default
    e.preventDefault();
    setOpen(false);
    history.replaceState(null, '', `#${id}`);
    setTimeout(() => scrollToAnchor(id), 0);
  };

  return (
    <header className={`navbar-eluzai ${scrolled ? 'is-scrolled' : ''}`}>
      <nav className="container">
        <div className="d-flex align-items-center justify-content-between gap-3">
          <Link href="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <span className="brand-logo">
              <Icon name="cross" size={22} />
            </span>
            <span className="fw-bold fs-5 text-dark">
              Eluzai <span style={{ color: 'var(--eluzai-blue)' }}>Kids</span>
            </span>
          </Link>

          <div className="d-none d-lg-flex align-items-center gap-1">
            {LINKS.map((l) => (
              <a
                key={l.id}
                href={hrefFor(l.id)}
                onClick={(e) => scrollToSection(e, l.id)}
                className={`nav-link ${active === l.id ? 'active' : ''}`}
                aria-current={active === l.id ? 'true' : undefined}
              >
                {l.label}
              </a>
            ))}
            <a
              href={hrefFor('kontak')}
              onClick={(e) => scrollToSection(e, 'kontak')}
              className="btn btn-eluzai ms-2 px-3 py-2"
              style={{ fontSize: '0.9rem' }}
            >
              <Icon name="whatsapp" size={15} className="me-1" /> Hubungi Kami
            </a>
            <ThemeToggle className="ms-2" />
          </div>

          <button
            className="navbar-toggler-eluzai d-lg-none"
            onClick={() => setOpen((v) => !v)}
            aria-label="Buka menu"
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} size={22} />
          </button>
        </div>

      </nav>

      {/* Menu mobile: overlay menimpa konten (bukan mendorong konten ke bawah) */}
      {open && (
        <div className="nav-mobile-menu d-lg-none">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={hrefFor(l.id)}
              onClick={(e) => scrollToSection(e, l.id)}
              className={`nav-link ${active === l.id ? 'active' : ''}`}
              aria-current={active === l.id ? 'true' : undefined}
            >
              {l.label}
            </a>
          ))}
          <div className="d-flex gap-2 mt-2">
            <a
              href={hrefFor('kontak')}
              onClick={(e) => scrollToSection(e, 'kontak')}
              className="btn btn-eluzai flex-fill"
            >
              <Icon name="whatsapp" size={16} className="me-1" /> Hubungi Kami
            </a>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
