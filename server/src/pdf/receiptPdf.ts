import PDFDocument from "pdfkit";
import type { Response } from "express";

// Palette matches the physical paper invoice book (red/black), not the
// gold app-chrome branding — per the confirmed decision that documents
// need to be recognizable as "theirs", not a generic redesign. No vector
// asset exists for the paper's script "Sm" mark, so the letterhead is
// recreated in styled base-14 PDF fonts (no custom font embedded yet).
const RED = "#c0392b";
const BLACK = "#1a1a1a";
const GRAY = "#555555";
const LINE = "#cccccc";

export type ReceiptForPdf = {
  invoiceNo: number;
  date: Date;
  previousBalance: string;
  itemsTotal: string;
  total: string;
  advance: string;
  balance: string;
  termsSnapshot: string | null;
  customer: { name: string; address: string | null; phone: string | null };
  items: {
    description: string;
    size: string | null;
    qty: string;
    sqft: string;
    ratePerSqft: string;
    amount: string;
  }[];
};

const COLUMNS = [
  { label: "Description", key: "description", widthFrac: 0.3 },
  { label: "Size", key: "size", widthFrac: 0.15 },
  { label: "Qty", key: "qty", widthFrac: 0.09 },
  { label: "Sq.ft", key: "sqft", widthFrac: 0.12 },
  { label: "Rate/Sq.ft", key: "ratePerSqft", widthFrac: 0.15 },
  { label: "Amount", key: "amount", widthFrac: 0.19 },
] as const;

export function streamReceiptPdf(receipt: ReceiptForPdf, res: Response) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="invoice-${receipt.invoiceNo}.pdf"`);
  doc.pipe(res);

  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;

  // --- Letterhead ---
  doc.fillColor(RED).font("Helvetica-BoldOblique").fontSize(24).text("Sm", left, y, { lineBreak: false });
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(24).text("SAWAT", left + 34, y, { lineBreak: false });
  doc
    .fillColor(BLACK)
    .font("Helvetica")
    .fontSize(13)
    .text("MARBLE STONE & GRANITE", left + 118, y + 5, { lineBreak: false });
  y += 32;
  doc.strokeColor(LINE).moveTo(left, y).lineTo(left + pageWidth, y).stroke();
  y += 14;

  // --- Info boxes: customer (left) + invoice meta (right) ---
  const boxTop = y;
  const boxHeight = 78;
  const leftBoxWidth = pageWidth * 0.6;
  const rightBoxWidth = pageWidth * 0.37;
  const rightBoxX = left + pageWidth - rightBoxWidth;

  doc.strokeColor("#999999").roundedRect(left, boxTop, leftBoxWidth, boxHeight, 4).stroke();
  const custLines: [string, string][] = [
    ["M/S Name", receipt.customer.name],
    ["Address", receipt.customer.address ?? ""],
    ["Phone", receipt.customer.phone ?? ""],
  ];
  custLines.forEach(([label, value], i) => {
    const rowY = boxTop + 10 + i * 20;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, left + 10, rowY, { lineBreak: false });
    doc.font("Helvetica").text(value, left + 80, rowY, { width: leftBoxWidth - 90, lineBreak: false });
  });

  doc.strokeColor("#999999").roundedRect(rightBoxX, boxTop, rightBoxWidth, boxHeight, 4).stroke();
  const metaLines: [string, string][] = [
    ["Invoice No:", String(receipt.invoiceNo)],
    ["Date:", receipt.date.toLocaleDateString()],
    ["Delivery:", "(Expected) ____________"],
  ];
  metaLines.forEach(([label, value], i) => {
    const rowY = boxTop + 10 + i * 20;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, rightBoxX + 10, rowY, { lineBreak: false });
    doc.font("Helvetica").text(value, rightBoxX + 85, rowY, { width: rightBoxWidth - 95, lineBreak: false });
  });

  y = boxTop + boxHeight + 20;

  // --- Line item table ---
  const colWidths = COLUMNS.map((c) => c.widthFrac * pageWidth);
  const rowHeight = 22;
  const tableTop = y;

  doc.rect(left, tableTop, pageWidth, rowHeight).fill(RED);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  let x = left;
  COLUMNS.forEach((col, i) => {
    doc.text(col.label, x + 4, tableTop + 6, { width: colWidths[i]! - 8, lineBreak: false });
    x += colWidths[i]!;
  });

  let rowY = tableTop + rowHeight;
  doc.font("Helvetica").fontSize(9);
  for (const item of receipt.items) {
    x = left;
    const values = [item.description, item.size ?? "", item.qty, item.sqft, item.ratePerSqft, item.amount];
    doc.fillColor(BLACK);
    values.forEach((val, i) => {
      doc.text(val, x + 4, rowY + 6, { width: colWidths[i]! - 8, lineBreak: false });
      x += colWidths[i]!;
    });
    doc.strokeColor(LINE).rect(left, rowY, pageWidth, rowHeight).stroke();
    rowY += rowHeight;
  }
  doc.strokeColor("#999999").rect(left, tableTop, pageWidth, rowY - tableTop).stroke();

  y = rowY + 20;

  // --- Footer: terms (left) + ledger box (right) ---
  const footerTop = y;
  const termsWidth = pageWidth * 0.56;
  const ledgerWidth = pageWidth * 0.4;
  const ledgerX = left + pageWidth - ledgerWidth;

  doc.fillColor(GRAY).font("Helvetica").fontSize(8);
  const terms = (receipt.termsSnapshot ?? "").split("\n").filter(Boolean);
  let termsY = footerTop;
  for (const term of terms) {
    doc.text(`• ${term}`, left, termsY, { width: termsWidth });
    termsY += doc.heightOfString(`• ${term}`, { width: termsWidth }) + 3;
  }

  const ledgerRows: [string, string][] = [
    ["Previous Balance", receipt.previousBalance],
    ["Total", receipt.total],
    ["Advance", receipt.advance],
    ["Balance", receipt.balance],
  ];
  const ledgerRowHeight = 18;
  doc.strokeColor("#999999").rect(ledgerX, footerTop, ledgerWidth, ledgerRowHeight * ledgerRows.length).stroke();
  ledgerRows.forEach(([label, value], i) => {
    const rowTop = footerTop + i * ledgerRowHeight;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, ledgerX + 8, rowTop + 5, {
      width: ledgerWidth * 0.55,
      lineBreak: false,
    });
    doc.font("Helvetica").text(value, ledgerX + 8 + ledgerWidth * 0.55, rowTop + 5, {
      width: ledgerWidth * 0.4,
      align: "right",
      lineBreak: false,
    });
    if (i > 0) {
      doc
        .strokeColor(LINE)
        .moveTo(ledgerX, rowTop)
        .lineTo(ledgerX + ledgerWidth, rowTop)
        .stroke();
    }
  });

  y = Math.max(termsY, footerTop + ledgerRowHeight * ledgerRows.length) + 24;

  // --- Contact band ---
  const bandHeight = 46;
  doc.rect(left, y, pageWidth, bandHeight).fill(RED);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  doc.text("Gangal West Service Road, Rawalpindi", left + 10, y + 6, { lineBreak: false });
  doc.text("Zulfiqar Ali | 0311-5290097, 0304-9420334    Iftikhar Ali | 0316-5619196", left + 10, y + 20, {
    lineBreak: false,
  });
  doc.text("sawatmarblestone4684@yahoo.com", left + 10, y + 34, { lineBreak: false });

  y += bandHeight + 24;
  doc.fillColor(BLACK).font("Helvetica").fontSize(9).text("Signature: ______________________________", left, y, {
    lineBreak: false,
  });

  doc.end();
}
