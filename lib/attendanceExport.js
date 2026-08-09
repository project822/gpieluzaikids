// ============================================================
// Export Rekap Kehadiran (Excel & PDF)
// Semua kelas digabung menjadi SATU dokumen berjudul:
//   "Rekap Kehadiran Minggu, <tanggal Minggu>"
// Dipakai oleh route /api/attendance/export (runtime Node).
// ============================================================

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLASSES, classLabel } from './attendanceValidation';

export const CHURCH_LINE = 'GPI Eluzai Kids — Sekolah Minggu';

// Tanggal tanpa nama hari → judul: "Rekap Kehadiran Minggu, 9 Agustus 2026"
// (bukan "Minggu, Minggu, 9 ..." — nama hari sudah terkandung di kata "Minggu").
function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr || ''}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr || '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Susun baris data gabungan (semua kelas) + ringkasan per kelas.
function buildRows(sessions) {
  const rows = [];
  const summary = [];
  let grandTotal = 0;
  let grandHadir = 0;

  for (const c of CLASSES) {
    const session = sessions.find((s) => s.className === c.value);
    const entries = session?.entries || [];
    const hadir = entries.filter((e) => e.present).length;
    grandTotal += entries.length;
    grandHadir += hadir;
    if (entries.length > 0) {
      summary.push(`${classLabel(c.value)}: ${hadir} hadir / ${entries.length} anak`);
    }
    entries.forEach((e) => {
      rows.push([0, classLabel(c.value), e.name, e.present ? 'Hadir' : 'Tidak']);
    });
  }
  summary.push(`Total: ${grandHadir} hadir / ${grandTotal} anak`);
  return { rows, summary };
}

function exportTitle(dateStr) {
  return `Rekap Kehadiran Minggu, ${formatDateLabel(dateStr)}`;
}

// ---------- Excel (.xlsx) ----------
export function buildExcel(sessions, dateStr) {
  const { rows, summary } = buildRows(sessions);
  const title = exportTitle(dateStr);

  const aoa = [
    [title],
    [CHURCH_LINE],
    [],
    ['No', 'Kelas', 'Nama Anak', 'Hadir'],
    ...rows.map((r, i) => [i + 1, r[1], r[2], r[3]]),
    [],
    ['Ringkasan Kehadiran'],
    ...summary.map((line) => [line]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Judul & baris ringkasan melebar di kolom A–D.
  // Susunan baris: 0 judul, 1 gereja, 2 kosong, 3 header,
  // 4..3+n data, 4+n kosong, 5+n "Ringkasan Kehadiran", 6+n.. baris ringkasan.
  const summaryHeaderRow = rows.length + 5;
  const firstSummaryRow = rows.length + 6;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: summaryHeaderRow, c: 0 }, e: { r: summaryHeaderRow, c: 3 } },
  ];
  ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];

  // Gaya sel (butuh opsi cellStyles saat write).
  const style = (r, c, font) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) cell.s = { font };
  };
  style(0, 0, { bold: true, sz: 14, color: { rgb: '0D6EFD' } });
  style(1, 0, { sz: 10, color: { rgb: '6C757D' } });
  const headerRow = 3;
  for (let c = 0; c < 4; c++) style(headerRow, c, { bold: true });
  style(summaryHeaderRow, 0, { bold: true });
  summary.forEach((line, i) => {
    if (line.startsWith('Total:')) style(firstSummaryRow + i, 0, { bold: true });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
}

// ---------- PDF ----------
export function buildPdf(sessions, dateStr) {
  const { rows, summary } = buildRows(sessions);
  const title = exportTitle(dateStr);

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
        data.cell.styles.textColor = value === 'Hadir' ? [25, 135, 84] : [220, 53, 69];
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
