// ============================================================
// Export Rekap Pendaftaran (Excel & PDF)
// Dipakai oleh route /api/registrations/export (runtime Node).
// ============================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CHURCH_LINE } from './attendanceExport.js';
import { excelSafe } from './attendanceExport.js';

function buildRows(registrations, customFields = []) {
  return registrations.map((r, i) => {
    const base = [
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
    ];
    const cf = r.customFields || {};
    const custom = customFields.map((f) => cf[f.label] || '');
    return [...base, ...custom];
  });
}

export async function buildRegistrationExcel(registrations, eventName, customFormFields = []) {
  const title = `Rekap Pendaftaran ${eventName}`;
  const cf = Array.isArray(customFormFields) ? customFormFields : [];
  const rows = buildRows(registrations, cf);
  const baseColCount = 5;
  const totalCols = baseColCount + cf.length;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Pendaftaran');
  const baseCols = [{ width: 6 }, { width: 30 }, { width: 30 }, { width: 18 }, { width: 22 }];
  const customCols = cf.map(() => ({ width: 24 }));
  ws.columns = [...baseCols, ...customCols];

  const titleRow = ws.addRow([title]);
  const churchRow = ws.addRow([CHURCH_LINE]);
  const countRow = ws.addRow([`Total Pendaftar: ${registrations.length}`]);
  ws.addRow([]);
  const headers = ['No', 'Nama Lengkap', 'Email', 'No. WhatsApp', 'Tanggal Daftar', ...cf.map((f) => f.label)];
  const headerRow = ws.addRow(headers);
  rows.forEach((r) =>
    ws.addRow(r.map((v, ci) => ci === 0 ? v : excelSafe(String(v ?? ''))))
  );

  ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
  ws.mergeCells(churchRow.number, 1, churchRow.number, totalCols);
  ws.mergeCells(countRow.number, 1, countRow.number, totalCols);

  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0D6EFD' } };
  churchRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  countRow.getCell(1).font = { size: 10, color: { argb: 'FF6C757D' } };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildRegistrationPdf(registrations, eventName, customFormFields = []) {
  const title = `Rekap Pendaftaran ${eventName}`;
  const cf = Array.isArray(customFormFields) ? customFormFields : [];
  const rows = buildRows(registrations, cf);
  const head = [['No', 'Nama Lengkap', 'Email', 'No. WhatsApp', 'Tanggal Daftar', ...cf.map((f) => f.label)]];

  const doc = new jsPDF({ orientation: cf.length > 3 ? 'landscape' : 'portrait' });

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
    head,
    body: rows.map((r) => r.map(String)),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}
