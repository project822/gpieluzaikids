'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '../ui/Icons';
import ChurchLogo from '../ui/ChurchLogo';
import AdminThemeToggle from './AdminThemeToggle';
import useSiteTheme from '../ui/useSiteTheme';
import { csrfFetch } from '@/lib/csrfClient';

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Halaman login memakai tema ADMIN (independen dari situs publik).
  useSiteTheme('eluzai-admin-theme');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await csrfFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="position-relative card-lift p-4 p-md-5">
      <div className="position-absolute" style={{ top: 12, right: 12 }}>
        <AdminThemeToggle compact />
      </div>
      <div className="text-center mb-4">
        <ChurchLogo size={56} className="mx-auto mb-3" style={{ width: 56, height: 56 }} />
        <h4 className="mb-1">Admin Eluzai Kids</h4>
        <p className="text-sm text-secondary mb-0">
          {searchParams.get('from') ? 'Silakan login untuk melanjutkan.' : 'Masuk untuk mengelola situs.'}
        </p>
      </div>

      {error && (
        <div className="alert alert-danger py-2 px-3" role="alert" style={{ fontSize: '0.9rem', borderRadius: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            placeholder="admin"
          />
        </div>
        <div className="mb-4">
          <label className="form-label">Password</label>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="btn btn-eluzai w-100" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
              Memeriksa...
            </>
          ) : (
            <>
              <Icon name="logout" size={17} className="me-2" style={{ transform: 'rotate(180deg)' }} />
              Masuk
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4">
        <Link href="/" className="text-sm text-secondary text-decoration-none">
          ← Kembali ke situs
        </Link>
      </div>
    </div>
  );
}
