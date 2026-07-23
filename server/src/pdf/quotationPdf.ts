import PDFDocument from "pdfkit";
import type { Response } from "express";
import { formatMoney, formatDate } from "./format";
import { drawLetterhead, drawFooter, ensureSpaceAboveFooter, drawTable } from "./layout";

// Same red/black palette as the Receipt PDF, matching the paper invoice
// book's branding (see receiptPdf.ts for the fuller rationale).
const BLACK = "#1a1a1a";
const GRAY = "#555555";

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
  y = drawLetterhead(doc, left, y, pageWidth, "QUOTATION");

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
    ["Date:", formatDate(quotation.date)],
    ["Status:", quotation.status.toUpperCase()],
  ];
  metaLines.forEach(([label, value], i) => {
    const rowY = boxTop + 10 + i * 20;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, rightBoxX + 10, rowY, { lineBreak: false });
    doc.font("Helvetica").text(value, rightBoxX + 85, rowY, { width: rightBoxWidth - 95, lineBreak: false });
  });

  y = boxTop + boxHeight + 20;

  // --- Line item table ---
  const rows = quotation.items.map((item, idx) => {
    const qtyDisplay = Number(item.qty) > 0 ? item.qty : "1";
    return [
      String(idx + 1),
      item.description,
      item.size ?? "",
      qtyDisplay,
      item.sqft,
      formatMoney(item.ratePerSqft),
      formatMoney(item.amount),
    ];
  });
  y = drawTable(doc, left, y, pageWidth, COLUMNS, rows) + 10;

  // Reserve room for the total + terms heading + bullet list as a unit,
  // rather than letting pdfkit auto-paginate mid-block.
  y = ensureSpaceAboveFooter(doc, y, 120);

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

  y = termsY + 36;

  // --- Signature lines ---
  y = ensureSpaceAboveFooter(doc, y, 20);
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

  // --- Footer: separator line + contact band, pinned to the bottom of the page ---
  drawFooter(doc, left, pageWidth);

  doc.end();
}
