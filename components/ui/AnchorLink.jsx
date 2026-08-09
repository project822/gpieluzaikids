'use client';

import { usePathname } from 'next/navigation';
import { scrollToAnchor } from './scrollToAnchor';

// Anchor link dengan pendaratan PRESISI (offset navbar aktual).
// Di halaman beranda (/) scroll langsung dengan scrollToAnchor;
// di halaman lain (mis. /event/[id]) berperilaku seperti link biasa
// ke "/#id" agar navigasi antar-halaman tetap berjalan normal.
export default function AnchorLink({ id, className = '', children, ...rest }) {
  const pathname = usePathname();
  const href = pathname === '/' ? `#${id}` : `/#${id}`;

  const onClick = (e) => {
    if (pathname !== '/') return; // navigasi antar-halaman: biarkan default
    e.preventDefault();
    history.replaceState(null, '', `#${id}`);
    scrollToAnchor(id);
  };

  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  );
}
