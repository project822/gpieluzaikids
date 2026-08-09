// Validasi tanggal jadwal mingguan — dipakai bersama oleh POST & PUT
// (app/api/schedules) agar definisi tidak terduplikasi/drifting.

// Tanggal wajib berupa YYYY-MM-DD dan jatuh pada HARI MINGGU.
export function isValidScheduleDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 0;
}
