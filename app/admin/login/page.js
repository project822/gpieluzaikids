import { Suspense } from 'react';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

export const metadata = { title: 'Login Admin' };

export default function AdminLoginPage() {
  return (
    <main
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh', background: 'var(--eluzai-bg)' }}
    >
      <div className="container" style={{ maxWidth: 440 }}>
        <Suspense
          fallback={
            <div className="card-lift p-5 text-center">
              <div className="spinner-border text-primary mb-3" role="status" />
              <p className="text-sm text-secondary mb-0">Memuat halaman login...</p>
            </div>
          }
        >
          <AdminLoginForm />
        </Suspense>
        <p className="text-center text-sm text-secondary mt-3 mb-0">
          {process.env.NODE_ENV === 'production' ? (
            <>Area terbatas — hubungi administrator gereja.</>
          ) : (
            <>Kredensial default tersedia di file <code>.env.local</code></>
          )}
        </p>
      </div>
    </main>
  );
}
