'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '../ui/Icons';
import { csrfFetch } from '@/lib/csrfClient';

export default function LogoutButton({ compact = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await csrfFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  }

  if (compact) {
    return (
      <button
        onClick={logout}
        disabled={loading}
        className="icon-btn"
        aria-label="Keluar"
        title="Keluar"
        style={{ border: '1px solid rgba(220,38,38,0.4)', color: 'var(--eluzai-rose)' }}
      >
        <Icon name="logout" size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="btn btn-sm w-100 d-flex align-items-center gap-2 justify-content-start px-3"
      style={{
        color: 'var(--eluzai-rose)',
        border: '1px solid rgba(220,38,38,0.4)',
        borderRadius: 10,
        background: 'transparent',
      }}
    >
      <Icon name="logout" size={17} />
      {loading ? 'Keluar...' : 'Keluar'}
    </button>
  );
}
