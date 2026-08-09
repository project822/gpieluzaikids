// ============================================================
// Export Rekap Kehadiran (Excel & PDF)
// Semua kelas digabung menjadi SATU dokumen berjudul:
//   "Rekap Kehadiran Minggu, <tanggal Minggu>"
// Dipakai oleh route /api/attendance/export (runtime Node).
// ============================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLASSES, classLabel } from './attendanceValidation.js';

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

// ---------- Excel (.xlsx) ----------
// Dipakai exceljs (pengganti sheetjs/xlsx yang sudah tidak dipatch di npm —
// ada advisory High tanpa fix). Layout & gaya dibuat menyerupai versi lama.

// Anti formula injection: sel yang diawali = + - @ atau memuat tab/baris baru
// di-escape dengan kutip awal agar Excel memperlakukan sebagai teks biasa.
export function excelSafe(value) {
  const s = String(value ?? '');
  return /^[=+\-@]/.test(s) || /[\t\r\n]/.test(s) ? `'${s}` : s;
}

export async function buildExcel(sessions, dateStr) {
  const { rows, summary } = buildRows(sessions);
  const title = exportTitle(dateStr);

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
