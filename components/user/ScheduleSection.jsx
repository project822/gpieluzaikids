import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icons';
import SectionHeading from '@/components/ui/SectionHeading';
import { CHURCH } from '@/lib/data';
import { formatEventDate } from '@/lib/format';

// Kartu status jadwal — hijau bila ADA (centang), merah bila TIDAK (silang).
function ScheduleCard({ title, ada, time, descAda, descTidak, icon, date, delay }) {
  const desc = ada ? descAda : descTidak;
  return (
    <Reveal delay={delay} className="h-100">
      <div className={`schedule-card ${ada ? 'is-ada' : 'is-tidak'}`}>
        <div className="schedule-card-head">
          <span className={`schedule-icon ${ada ? 'ok' : 'no'}`}>{icon}</span>
          <div className="flex-grow-1">
            <div className="schedule-title">{title}</div>
            <div className={`schedule-desc ${ada ? 'ok' : 'no'}`}>{desc}</div>
          </div>
          <span
            className={`schedule-status ${ada ? 'ok' : 'no'}`}
            title={ada ? 'Ada' : 'Tidak ada'}
            aria-label={ada ? `${title}: ada` : `${title}: tidak ada`}
          >
            <Icon name={ada ? 'check' : 'x'} size={18} />
          </span>
        </div>
        <div className="schedule-meta">
          <div className="schedule-meta-item">
            <Icon name="clock" size={15} />
            <span>{ada && time ? time : '—'}</span>
          </div>
          <div className="schedule-meta-item">
            <Icon name="calendar" size={15} />
            <span>{formatEventDate(date)}</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// Hanya menampilkan jadwal Minggu TERDEKAT (tanggal sudah dihitung server).
// Jika admin belum mengisinya, `schedule` bernilai null → kedua kartu tampil
// merah ("Tidak ada") sebagai status default.
export default function ScheduleSection({ date, schedule }) {
  // Kedua kartu wajib konsisten: hanya hijau bila data benar-benar "ada"
  // (=== true). Saat jadwal belum diisi (null), keduanya tampil merah.
  const ibadahAda = schedule?.ibadahAda === true;
  const latihanAda = schedule?.latihanAda === true;

  const updatedAt = schedule?.updatedAt;

  return (
    <section id="schedule" className="section section-alt">
      <div className="container" style={{ maxWidth: 980 }}>
        <Reveal>
          <SectionHeading
            center
            title="Jadwal Minggu Ini"
            sub={`Kegiatan ${CHURCH.shortName} setiap Hari Minggu.`}
          />
        </Reveal>

        <div className="row g-4">
          <div className="col-md-6">
            <ScheduleCard
              title="Ibadah Sekolah Minggu"
              ada={ibadahAda}
              time={schedule?.ibadahTime || ''}
              descAda="Selamat Beribadah"
              descTidak="Tidak ada ibadah"
              icon={<Icon name="cross" size={22} />}
              date={date}
              delay={0}
            />
          </div>
          <div className="col-md-6">
            <ScheduleCard
              title="Latihan"
              ada={latihanAda}
              time={schedule?.latihanTime || ''}
              descAda="Latihan Musik/Vocal"
              descTidak="Tidak ada latihan"
              icon={<Icon name="sparkle" size={22} />}
              date={date}
              delay={120}
            />
          </div>
        </div>

        {updatedAt && (
          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--eluzai-muted)' }}>
            Diperbarui {new Date(updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </section>
  );
}
