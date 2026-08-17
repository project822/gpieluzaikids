// ============================================================
// Export Rekap Kehadiran (Excel & PDF)
// Semua kelas digabung menjadi SATU dokumen berjudul:
//   "Rekap Kehadiran Minggu, <tanggal Minggu>"
// Dipakai oleh route /api/attendance/export (runtime Node).
// ============================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CLASSES,
  classLabel,
  formatDateLabel,
  formatMonthLabel,
} from './attendanceValidation.js';

export const CHURCH_LINE = 'GPI Eluzai Kids — Sekolah Minggu';

// Susun baris data gabungan (semua kelas) + ringkasan per kelas.
function buildRows(sessions) {
  const rows = [];
  const summary = [];
  let grandTotal = 0;
  let grandHadir = 0;

  for (const c of CLASSES) {
    const session = sessions.find((s) => s.className === c.value);
    const entries = [...(session?.entries || [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'id')
    );
    const hadir = entries.filter((e) => e.present === true).length;
    grandTotal += entries.length;
    grandHadir += hadir;
    if (entries.length > 0) {
      summary.push(`${classLabel(c.value)}: ${hadir} hadir / ${entries.length} anak`);
    }
    entries.forEach((e) => {
      rows.push([
        0,
        classLabel(c.value),
        e.name,
        e.present === true ? 'Hadir' : e.present === false ? 'Tidak' : 'Belum',
      ]);
    });
  }
  summary.push(`Total: ${grandHadir} hadir / ${grandTotal} anak`);
  return { rows, summary };
}

function exportTitle(dateStr) {
  return `Rekap Kehadiran Minggu, ${formatDateLabel(dateStr)}`;
}

// ---------- Rows bulanan (semua sesi dalam satu bulan) ----------
// Menambah kolom Tanggal: [No, Tanggal, Kelas, Nama Anak, Hadir], diurutkan
// per tanggal lalu kelas. Ringkasan dibuat per tanggal + total bulan.
function buildMonthRows(sessions) {
  const sorted = [...sessions].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      classLabel(a.className).localeCompare(classLabel(b.className))
  );
  const rows = [];
  const byDate = new Map();
  let grandTotal = 0;
  let grandHadir = 0;
  for (const s of sorted) {
    const entries = [...(s.entries || [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'id')
    );
    const hadir = entries.filter((e) => e.present === true).length;
    grandTotal += entries.length;
    grandHadir += hadir;
    const cur = byDate.get(s.date) || { total: 0, hadir: 0 };
    cur.total += entries.length;
    cur.hadir += hadir;
    byDate.set(s.date, cur);
    entries.forEach((e) => {
      rows.push([
        0,
        formatDateLabel(s.date),
        classLabel(s.className),
        e.name,
        e.present === true ? 'Hadir' : e.present === false ? 'Tidak' : 'Belum',
      ]);
    });
  }
  const summary = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => `${formatDateLabel(date)}: ${v.hadir} hadir / ${v.total} anak`);
  summary.push(`Total: ${grandHadir} hadir / ${grandTotal} anak`);
  return { rows, summary };
}

// ---------- Excel (.xlsx) ----------
// Dipakai exceljs (pengganti sheetjs/xlsx yang sudah tidak dipatch di npm —
// ada advisory High tanpa fix). Layout & gaya dibuat menyerupai versi lama.

// Anti formula injection: sel yang diawali = + - @ atau memuat tab/baris baru
// di-escape dengan kutip awal agar Excel memperlakukan sebagai teks biasa.
export function excelSafe(value) {
  const s = String(value ?? '');
  return /^[=+\-@]/.test(s) || /[\t\r\n]/.test(s) ? `'${s}` : s;
}

export async function buildExcel(sessions, dateStr, opts = {}) {
  const { rows, summary } = buildRows(sessions);
  const title = opts?.title || exportTitle(dateStr);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Kehadiran');
  ws.columns = [{ width: 6 }, { width: 12 }, { width: 30 }, { width: 12 }];

  const titleRow = ws.addRow([title]);
  const churchRow = ws.addRow([CHURCH_LINE]);
  ws.addRow([]);
  const headerRow = ws.addRow(['No', 'Kelas', 'Nama Anak', 'Hadir']);
  rows.forEach((r, i) => ws.addRow([i + 1, r[1], excelSafe(r[2]), r[3]]));
  ws.addRow([]);
  const summaryHeaderRow = ws.addRow(['Ringkasan Kehadiran']);
  const firstSummaryRow = summaryHeaderRow.number + 1;
  summary.forEach((line) => ws.addRow([line]));

  // Judul & baris ringkasan melebar di kolom A–D.
  ws.mergeCells(titleRow.number, 1, titleRow.number, 4);
  ws.mergeCells(churchRow.number, 1, churchRow.number, 4);
  ws.mergeCells(summaryHeaderRow.number, 1, summaryHeaderRow.number, 4);

  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0D6EFD' } };
  churchRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });
  summaryHeaderRow.getCell(1).font = { bold: true };
  summary.forEach((line, i) => {
    if (line.startsWith('Total:')) {
      ws.getRow(firstSummaryRow + i).getCell(1).font = { bold: true };
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- Excel bulanan ----------
export async function buildMonthExcel(sessions, monthKey, opts = {}) {
  const { rows, summary } = buildMonthRows(sessions);
  const title = opts?.title || `Rekap Kehadiran ${formatMonthLabel(monthKey)}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Kehadiran');
  ws.columns = [{ width: 6 }, { width: 26 }, { width: 12 }, { width: 30 }, { width: 12 }];

  const titleRow = ws.addRow([title]);
  const churchRow = ws.addRow([CHURCH_LINE]);
  ws.addRow([]);
  const headerRow = ws.addRow(['No', 'Tanggal', 'Kelas', 'Nama Anak', 'Hadir']);
  rows.forEach((r, i) =>
    ws.addRow([i + 1, r[1], r[2], excelSafe(r[3]), r[4]])
  );
  ws.addRow([]);
  const summaryHeaderRow = ws.addRow(['Ringkasan Kehadiran']);
  const firstSummaryRow = summaryHeaderRow.number + 1;
  summary.forEach((line) => ws.addRow([line]));

  ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
  ws.mergeCells(churchRow.number, 1, churchRow.number, 5);
  ws.mergeCells(summaryHeaderRow.number, 1, summaryHeaderRow.number, 5);

  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0D6EFD' } };
  churchRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });
  summaryHeaderRow.getCell(1).font = { bold: true };
  summary.forEach((line, i) => {
    if (line.startsWith('Total:')) {
      ws.getRow(firstSummaryRow + i).getCell(1).font = { bold: true };
    }
  });

  // chartOnly: tambahkan grafik bar per tanggal
  if (opts?.chartOnly) {
    const byDate = new Map();
    for (const r of rows) {
      const dateLabel = r[1];
      if (!byDate.has(dateLabel)) {
        byDate.set(dateLabel, { hadir: 0, total: 0 });
      }
      const d = byDate.get(dateLabel);
      if (r[4] === 'Hadir') d.hadir++;
      d.total++;
    }
    const chartData = [...byDate.entries()].map(([date, v]) => ({
      Tanggal: date,
      Hadir: v.hadir,
      Total: v.total,
    }));
    if (chartData.length > 0) {
      const chartWs = wb.addWorksheet('Data Grafik');
      chartWs.columns = [{ width: 26 }, { width: 10 }, { width: 10 }];
      const cHeader = chartWs.addRow(['Tanggal', 'Hadir', 'Total']);
      cHeader.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });
      chartData.forEach((d) => chartWs.addRow([d.Tanggal, d.Hadir, d.Total]));
      const firstRow = 2;
      const lastRow = firstRow + chartData.length - 1;
      ws.addChart(
        {
          type: 'bar',
          title: { text: title },
          legend: { position: 'bottom' },
          series: [
            {
              title: { text: 'Hadir' },
              cat: { f: `'Data Grafik'!A${firstRow}:A${lastRow}` },
              val: { f: `'Data Grafik'!B${firstRow}:B${lastRow}` },
            },
            {
              title: { text: 'Total' },
              cat: { f: `'Data Grafik'!A${firstRow}:A${lastRow}` },
              val: { f: `'Data Grafik'!C${firstRow}:C${lastRow}` },
            },
          ],
          plotArea: { border: { color: 'CCCCCC' } },
        },
        { tl: { col: 0, row: firstSummaryRow + summary.length + 2 }, cx: 20, cy: 12 }
      );
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- PDF ----------
export function buildPdf(sessions, dateStr, opts = {}) {
  const { rows, summary } = buildRows(sessions);
  const title = opts?.title || exportTitle(dateStr);

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 110, 253);
  doc.text(title, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(CHURCH_LINE, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['No', 'Kelas', 'Nama Anak', 'Hadir']],
    body: rows.map((r, i) => [String(i + 1), r[1], r[2], r[3]]),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 26 },
      3: { cellWidth: 26, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const value = String(data.cell.raw || '');
        if (value === 'Hadir') data.cell.styles.textColor = [25, 135, 84];
        else if (value === 'Tidak') data.cell.styles.textColor = [220, 53, 69];
        else data.cell.styles.textColor = [108, 117, 125]; // Belum
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const lastY = doc.lastAutoTable.finalY;
  let y = lastY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text('Ringkasan Kehadiran', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of summary) {
    if (y > pageHeight - 14) break; // batas bawah halaman (kelas kecil muat di satu halaman)
    if (line.startsWith('Total:')) {
      doc.setTextColor(13, 110, 253);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(73, 80, 87);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line, 16, y);
    y += 5.5;
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ---------- PDF bulanan ----------
export function buildMonthPdf(sessions, monthKey, opts = {}) {
  const { rows, summary } = buildMonthRows(sessions);
  const title = opts?.title || `Rekap Kehadiran ${formatMonthLabel(monthKey)}`;

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 110, 253);
  doc.text(title, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(CHURCH_LINE, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['No', 'Tanggal', 'Kelas', 'Nama Anak', 'Hadir']],
    body: rows.map((r, i) => [String(i + 1), r[1], r[2], r[3], r[4]]),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 24 },
      4: { cellWidth: 24, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const value = String(data.cell.raw || '');
        if (value === 'Hadir') data.cell.styles.textColor = [25, 135, 84];
        else if (value === 'Tidak') data.cell.styles.textColor = [220, 53, 69];
        else data.cell.styles.textColor = [108, 117, 125]; // Belum
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const lastY = doc.lastAutoTable.finalY;
  let y = lastY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text('Ringkasan Kehadiran', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of summary) {
    if (y > pageHeight - 14) break; // batas bawah halaman
    if (line.startsWith('Total:')) {
      doc.setTextColor(13, 110, 253);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(73, 80, 87);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line, 16, y);
    y += 5.5;
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ---------- Rows tahunan (semua sesi dalam satu tahun, dikelompokkan per bulan) ----------
function buildYearRows(sessions) {
  const byMonth = new Map();
  let grandTotal = 0;
  let grandHadir = 0;

  for (const s of sessions) {
    const monthKey = String(s.date || '').slice(0, 7);
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { sessions: 0, hadir: 0, totalEntries: 0 });
    }
    const m = byMonth.get(monthKey);
    m.sessions += 1;
    const entries = s.entries || [];
    const hadir = entries.filter((e) => e.present === true).length;
    m.hadir += hadir;
    m.totalEntries += entries.length;
    grandTotal += entries.length;
    grandHadir += hadir;
  }

  const rows = [];
  const sortedMonths = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [monthKey, m] of sortedMonths) {
    rows.push({
      Bulan: formatMonthLabel(monthKey),
      Sesi: m.sessions,
      Hadir: m.hadir,
      'Total Catatan': m.totalEntries,
      'Kehadiran (%)': m.totalEntries ? Math.round((m.hadir / m.totalEntries) * 100) : 0,
    });
  }

  const summary = sortedMonths.map(([monthKey, m]) =>
    `${formatMonthLabel(monthKey)}: ${m.hadir} hadir / ${m.totalEntries} anak (${m.sessions} sesi)`
  );
  summary.push(`Total: ${grandHadir} hadir / ${grandTotal} anak`);

  return { rows, summary };
}

// ---------- Excel tahunan ----------
export async function buildYearExcel(sessions, yearStr, opts = {}) {
  const { rows, summary } = buildYearRows(sessions);
  const title = opts?.title || `Rekap Kehadiran ${yearStr}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Kehadiran');
  ws.columns = [{ width: 24 }, { width: 8 }, { width: 8 }, { width: 14 }, { width: 16 }];

  const titleRow = ws.addRow([title]);
  const churchRow = ws.addRow([CHURCH_LINE]);
  ws.addRow([]);
  const headerRow = ws.addRow(['Bulan', 'Sesi', 'Hadir', 'Total Catatan', 'Kehadiran (%)']);
  rows.forEach((r) =>
    ws.addRow([r.Bulan, r.Sesi, r.Hadir, r['Total Catatan'], `${r['Kehadiran (%)']}%`])
  );
  ws.addRow([]);
  const summaryHeaderRow = ws.addRow(['Ringkasan Kehadiran']);
  const firstSummaryRow = summaryHeaderRow.number + 1;
  summary.forEach((line) => ws.addRow([line]));

  ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
  ws.mergeCells(churchRow.number, 1, churchRow.number, 5);
  ws.mergeCells(summaryHeaderRow.number, 1, summaryHeaderRow.number, 5);

  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0D6EFD' } };
  churchRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });
  summaryHeaderRow.getCell(1).font = { bold: true };
  summary.forEach((line, i) => {
    if (line.startsWith('Total:')) {
      ws.getRow(firstSummaryRow + i).getCell(1).font = { bold: true };
    }
  });

  // chartOnly: tambahkan grafik bar ke worksheet
  if (opts?.chartOnly && rows.length > 0) {
    const firstDataRow = 5;
    const lastDataRow = firstDataRow + rows.length - 1;
    ws.addChart(
      {
        type: 'bar',
        title: { text: title },
        legend: { position: 'bottom' },
        series: [
          {
            title: { text: 'Hadir' },
            cat: { f: `'Rekap Kehadiran'!A${firstDataRow}:A${lastDataRow}` },
            val: { f: `'Rekap Kehadiran'!C${firstDataRow}:C${lastDataRow}` },
          },
          {
            title: { text: 'Total Catatan' },
            cat: { f: `'Rekap Kehadiran'!A${firstDataRow}:A${lastDataRow}` },
            val: { f: `'Rekap Kehadiran'!D${firstDataRow}:D${lastDataRow}` },
          },
        ],
        plotArea: { border: { color: 'CCCCCC' } },
      },
      { tl: { col: 0, row: lastDataRow + 3 }, cx: 20, cy: 12 }
    );
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- PDF tahunan ----------
export function buildYearPdf(sessions, yearStr, opts = {}) {
  const { rows, summary } = buildYearRows(sessions);
  const title = opts?.title || `Rekap Kehadiran ${yearStr}`;

  const doc = new jsPDF({ orientation: 'landscape' });
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 110, 253);
  doc.text(title, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(CHURCH_LINE, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['Bulan', 'Sesi', 'Hadir', 'Total Catatan', 'Kehadiran (%)']],
    body: rows.map((r) => [r.Bulan, String(r.Sesi), String(r.Hadir), String(r['Total Catatan']), `${r['Kehadiran (%)']}%`]),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
    },
  });

  const lastY = doc.lastAutoTable.finalY;
  let y = lastY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.text('Ringkasan Kehadiran', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of summary) {
    if (y > pageHeight - 14) break;
    if (line.startsWith('Total:')) {
      doc.setTextColor(13, 110, 253);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(73, 80, 87);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line, 16, y);
    y += 5.5;
  }

  return Buffer.from(doc.output('arraybuffer'));
}
