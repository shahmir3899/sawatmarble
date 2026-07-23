import PDFDocument from "pdfkit";
import type { Response } from "express";
import { formatMoney } from "./format";

// Same red/black palette as the Receipt PDF, matching the paper invoice
// book's branding (see receiptPdf.ts for the fuller rationale).
const RED = "#c0392b";
const BLACK = "#1a1a1a";
const GRAY = "#555555";
const LINE = "#cccccc";
const ZEBRA = "#f7f7f7";

export type QuotationForPdf = {
  quotationNo: string;
  date: Date;
  status: string;
  itemsTotal: string;
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
  { label: "#", widthFrac: 0.05 },
  { label: "Description", widthFrac: 0.25 },
  { label: "Size", widthFrac: 0.15 },
  { label: "Qty", widthFrac: 0.09 },
  { label: "Sq.ft", widthFrac: 0.12 },
  { label: "Rate/Sq.ft", widthFrac: 0.15 },
  { label: "Amount", widthFrac: 0.19 },
] as const;

export function streamQuotationPdf(quotation: QuotationForPdf, res: Response) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="quotation-${quotation.quotationNo}.pdf"`);
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
  doc
    .fillColor(GRAY)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("QUOTATION", left + pageWidth - 100, y + 6, { width: 100, align: "right", lineBreak: false });
  y += 32;
  doc.strokeColor(LINE).moveTo(left, y).lineTo(left + pageWidth, y).stroke();
  y += 14;

  // --- Info boxes: customer (left) + quotation meta (right) ---
  const boxTop = y;
  const boxHeight = 78;
  const leftBoxWidth = pageWidth * 0.6;
  const rightBoxWidth = pageWidth * 0.37;
  const rightBoxX = left + pageWidth - rightBoxWidth;

  doc.strokeColor("#999999").roundedRect(left, boxTop, leftBoxWidth, boxHeight, 4).stroke();
  const custLines: [string, string][] = [
    ["M/S Name", quotation.customer.name],
    ["Address", quotation.customer.address ?? ""],
    ["Phone", quotation.customer.phone ?? ""],
  ];
  custLines.forEach(([label, value], i) => {
    const rowY = boxTop + 10 + i * 20;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, left + 10, rowY, { lineBreak: false });
    doc.font("Helvetica").text(value, left + 80, rowY, { width: leftBoxWidth - 90, lineBreak: false });
  });

  doc.strokeColor("#999999").roundedRect(rightBoxX, boxTop, rightBoxWidth, boxHeight, 4).stroke();
  const metaLines: [string, string][] = [
    ["Quotation No:", quotation.quotationNo],
    ["Date:", quotation.date.toLocaleDateString()],
    ["Status:", quotation.status.toUpperCase()],
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
  quotation.items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.rect(left, rowY, pageWidth, rowHeight).fill(ZEBRA);
    }
    x = left;
    const qtyDisplay = Number(item.qty) > 0 ? item.qty : "1";
    const values = [
      String(idx + 1),
      item.description,
      item.size ?? "",
      qtyDisplay,
      item.sqft,
      formatMoney(item.ratePerSqft),
      formatMoney(item.amount),
    ];
    doc.fillColor(BLACK);
    values.forEach((val, i) => {
      doc.text(val, x + 4, rowY + 6, { width: colWidths[i]! - 8, lineBreak: false });
      x += colWidths[i]!;
    });
    doc.strokeColor(LINE).rect(left, rowY, pageWidth, rowHeight).stroke();
    rowY += rowHeight;
  });
  doc.strokeColor("#999999").rect(left, tableTop, pageWidth, rowY - tableTop).stroke();

  y = rowY + 10;

  // --- Total ---
  doc
    .fillColor(BLACK)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`Total: ${formatMoney(quotation.itemsTotal)}`, left, y, { width: pageWidth, align: "right", lineBreak: false });
  y += 26;

  // --- Terms ---
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text("Terms & Conditions", left, y, { lineBreak: false });
  y += 14;
  doc.fillColor(GRAY).font("Helvetica").fontSize(8);
  const terms = (quotation.termsSnapshot ?? "").split("\n").filter(Boolean);
  let termsY = y;
  for (const term of terms) {
    doc.text(`• ${term}`, left, termsY, { width: pageWidth });
    termsY += doc.heightOfString(`• ${term}`, { width: pageWidth }) + 3;
  }

  y = termsY + 20;

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
  const sigWidth = pageWidth / 2;
  doc
    .fillColor(BLACK)
    .font("Helvetica")
    .fontSize(9)
    .text("Customer Signature: ________________________", left, y, { width: sigWidth, lineBreak: false });
  doc
    .fillColor(BLACK)
    .font("Helvetica")
    .fontSize(9)
    .text("Authorized Signature: ________________________", left + sigWidth, y, {
      width: sigWidth,
      lineBreak: false,
    });

  doc.end();
}
