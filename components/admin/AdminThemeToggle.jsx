'use client';

import Icon from '../ui/Icons';
import useSiteTheme from '../ui/useSiteTheme';

// Tombol mode gelap/terang AREA ADMIN — independen dari tema situs publik
// (kunci 'eluzai-admin-theme', default light). Dipakai di AdminShell
// (sidebar desktop & topbar mobile).
export default function AdminThemeToggle({ compact = false }) {
  const { dark, toggle } = useSiteTheme('eluzai-admin-theme');

  return (
    <button
      type="button"
      className={compact ? 'icon-btn' : 'btn btn-sm w-100 d-flex align-items-center gap-2 justify-content-start px-3'}
      onClick={toggle}
      aria-label={dark ? 'Aktifkan mode terang (admin)' : 'Aktifkan mode gelap (admin)'}
      title={dark ? 'Mode terang admin' : 'Mode gelap admin'}
      style={
        compact
          ? { border: '1px solid var(--eluzai-border)' }
          : { color: 'var(--eluzai-muted)', border: '1px solid var(--eluzai-border)', borderRadius: 10 }
      }
    >
      <Icon name={dark ? 'sun' : 'moon'} size={17} />
      {!compact && (dark ? 'Mode Terang' : 'Mode Gelap')}
    </button>
  );
}
