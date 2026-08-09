import Link from 'next/link';
import Icon from '@/components/ui/Icons';
import { getStats } from '@/lib/repo';
import { getSecurityStats } from '@/lib/securityLog';

export const metadata = { title: 'Dashboard Admin' };

export const dynamic = 'force-dynamic';

function StatCard({ icon, label, value, className }) {
  return (
    <div className={`stat-admin ${className}`}>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="num">{value}</div>
          <div className="lbl">{label}</div>
        </div>
        <Icon name={icon} size={26} style={{ opacity: 0.7 }} />
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const [stats, security] = await Promise.all([getStats(), getSecurityStats()]);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h4 className="mb-1">Dashboard</h4>
          <p className="text-sm text-secondary mb-0">Ringkasan konten situs GPI Eluzai.</p>
        </div>
        <span className="badge-soft badge-green">
          <Icon name="check" size={14} /> Semua sistem normal
        </span>
      </div>

      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <StatCard icon="calendar" label="Event" value={stats.events} className="stat-blue" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard icon="clock" label="Jadwal" value={stats.schedules} className="stat-green" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard icon="info" label="Banner Informasi" value={stats.banners} className="stat-green" />
        </div>
      </div>

      <div className="admin-card p-4">
        <h6 className="mb-3">Aksi Cepat</h6>
        <div className="d-flex flex-column gap-2">
          <Link href="/admin/jadwal" className="btn btn-eluzai-outline d-flex justify-content-between align-items-center">
            Kelola Jadwal Mingguan <Icon name="arrow-right" size={16} className="hover-arrow" />
          </Link>
          <Link href="/admin/absensi" className="btn btn-eluzai-outline d-flex justify-content-between align-items-center">
            Kelola Absensi & Anggota Kelas <Icon name="arrow-right" size={16} className="hover-arrow" />
          </Link>
          <Link href="/admin/events" className="btn btn-eluzai-outline d-flex justify-content-between align-items-center">
            Kelola Event <Icon name="arrow-right" size={16} className="hover-arrow" />
          </Link>
          <Link href="/admin/informasi" className="btn btn-eluzai-outline d-flex justify-content-between align-items-center">
            Kelola Banner Informasi <Icon name="arrow-right" size={16} className="hover-arrow" />
          </Link>
        </div>
      </div>

      <div className="admin-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">Ringkasan Keamanan</h6>
          <span className="text-sm text-secondary" style={{ fontSize: '0.78rem' }}>
            24 jam terakhir
          </span>
        </div>
        <div className="row g-2">
          <div className="col-6 col-lg">
            <div className="p-2 rounded" style={{ background: 'var(--eluzai-bg)' }}>
              <div className="fw-bold">{security.events24h}</div>
              <div className="text-sm text-secondary">Event keamanan</div>
            </div>
          </div>
          <div className="col-6 col-lg">
            <div className="p-2 rounded" style={{ background: 'var(--eluzai-bg)' }}>
              <div className="fw-bold">{security.blocked}</div>
              <div className="text-sm text-secondary">IP diblokir</div>
            </div>
          </div>
          <div className="col-6 col-lg">
            <div className="p-2 rounded" style={{ background: 'var(--eluzai-bg)' }}>
              <div className="fw-bold">{security.rateLimited}</div>
              <div className="text-sm text-secondary">Rate limit</div>
            </div>
          </div>
          <div className="col-6 col-lg">
            <div className="p-2 rounded" style={{ background: 'var(--eluzai-bg)' }}>
              <div className="fw-bold">{security.csrf}</div>
              <div className="text-sm text-secondary">CSRF ditolak</div>
            </div>
          </div>
          <div className="col-6 col-lg">
            <div className="p-2 rounded" style={{ background: 'var(--eluzai-bg)' }}>
              <div className="fw-bold">{security.failedLogin}</div>
              <div className="text-sm text-secondary">Login gagal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
