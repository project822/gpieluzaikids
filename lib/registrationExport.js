// ============================================================
// Export Rekap Pendaftaran (Excel & PDF)
// Dipakai oleh route /api/registrations/export (runtime Node).
// ============================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CHURCH_LINE } from './attendanceExport.js';
import { excelSafe } from './attendanceExport.js';

function buildRows(registrations) {
  return registrations.map((r, i) => [
    i + 1,
    r.fullName || '',
    r.email || '',
    r.whatsapp || '',
    r.createdAt
      ? new Date(r.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '',
  ]);
}

export async function buildRegistrationExcel(registrations, eventName) {
  const title = `Rekap Pendaftaran ${eventName}`;
  const rows = buildRows(registrations);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Pendaftaran');
  ws.columns = [{ width: 6 }, { width: 30 }, { width: 30 }, { width: 18 }, { width: 22 }];

  const titleRow = ws.addRow([title]);
  const churchRow = ws.addRow([CHURCH_LINE]);
  const countRow = ws.addRow([`Total Pendaftar: ${registrations.length}`]);
  ws.addRow([]);
  const headerRow = ws.addRow(['No', 'Nama Lengkap', 'Email', 'No. WhatsApp', 'Tanggal Daftar']);
  rows.forEach((r) =>
    ws.addRow([r[0], excelSafe(r[1]), excelSafe(r[2]), excelSafe(r[3]), r[4]])
  );

  ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
  ws.mergeCells(churchRow.number, 1, churchRow.number, 5);
  ws.mergeCells(countRow.number, 1, countRow.number, 5);

  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0D6EFD' } };
  churchRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  countRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildRegistrationPdf(registrations, eventName) {
  const title = `Rekap Pendaftaran ${eventName}`;
  const rows = buildRows(registrations);

  const doc = new jsPDF();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 110, 253);
  doc.text(title, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(CHURCH_LINE, 14, 22);
  doc.text(`Total Pendaftar: ${registrations.length}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [['No', 'Nama Lengkap', 'Email', 'No. WhatsApp', 'Tanggal Daftar']],
    body: rows.map((r) => [String(r[0]), r[1], r[2], r[3], r[4]]),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 28 },
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}
