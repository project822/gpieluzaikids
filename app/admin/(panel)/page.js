import Icon from '@/components/ui/Icons';
import { getStats } from '@/lib/repo';

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
  const stats = await getStats();

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
        <div className="col-6 col-lg-4">
          <StatCard icon="calendar" label="Event" value={stats.events} className="stat-blue" />
        </div>
        <div className="col-6 col-lg-4">
          <StatCard icon="clock" label="Jadwal" value={stats.schedules} className="stat-green" />
        </div>
        <div className="col-6 col-lg-4">
          <StatCard icon="info" label="Banner Informasi" value={stats.banners} className="stat-green" />
        </div>
      </div>
    </div>
  );
}
