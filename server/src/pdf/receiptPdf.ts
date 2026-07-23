import PDFDocument from "pdfkit";
import type { Response } from "express";
import { formatMoney, formatDate } from "./format";
import { drawLetterhead, drawFooter, ensureSpaceAboveFooter, drawTable } from "./layout";

// Palette matches the physical paper invoice book (red/black), not the
// gold app-chrome branding — per the confirmed decision that documents
// need to be recognizable as "theirs", not a generic redesign.
const BLACK = "#1a1a1a";
const GRAY = "#555555";
const LINE = "#cccccc";

const CURRENCY = "Rs.";

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
  { label: "#", key: "no", widthFrac: 0.05 },
  { label: "Description", key: "description", widthFrac: 0.25 },
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
  y = drawLetterhead(doc, left, y, pageWidth);

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
    ["Invoice No:", `INV-${receipt.invoiceNo}`],
    ["Date:", formatDate(receipt.date)],
    // No deliveryDate field exists on Receipt yet — this line has always
    // been a static placeholder, never a real per-order date. Until that
    // field exists, "To be confirmed" is the honest state to print.
    ["Delivery:", "To be confirmed"],
  ];
  metaLines.forEach(([label, value], i) => {
    const rowY = boxTop + 10 + i * 20;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, rightBoxX + 10, rowY, { lineBreak: false });
    doc.font("Helvetica").text(value, rightBoxX + 85, rowY, { width: rightBoxWidth - 95, lineBreak: false });
  });

  y = boxTop + boxHeight + 20;

  // --- Line item table ---
  const rows = receipt.items.map((item, idx) => {
    // Older rows may still carry a stored qty of 0 from before pieces-count
    // was a required field — treat that the same as "1 piece" on paper.
    const qtyDisplay = Number(item.qty) > 0 ? item.qty : "1";
    return [
      String(idx + 1),
      item.description,
      item.size ?? "",
      qtyDisplay,
      item.sqft,
      `${CURRENCY} ${formatMoney(item.ratePerSqft)}`,
      `${CURRENCY} ${formatMoney(item.amount)}`,
    ];
  });
  y = drawTable(doc, left, y, pageWidth, COLUMNS, rows) + 20;

  // --- Footer: terms (left) + ledger box (right) ---
  // Reserve enough room for the terms heading + ledger box + bank block as
  // a unit; if it won't fit, start a fresh page instead of letting pdfkit
  // auto-paginate mid-block (which fragments it across many near-blank pages).
  y = ensureSpaceAboveFooter(doc, y, 230);
  const footerTop = y;
  const termsWidth = pageWidth * 0.56;
  const ledgerWidth = pageWidth * 0.4;
  const ledgerX = left + pageWidth - ledgerWidth;

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text("Terms & Conditions", left, footerTop, {
    lineBreak: false,
  });
  doc.fillColor(GRAY).font("Helvetica").fontSize(8);
  const terms = (receipt.termsSnapshot ?? "").split("\n").filter(Boolean);
  let termsY = footerTop + 14;
  for (const term of terms) {
    doc.text(`• ${term}`, left, termsY, { width: termsWidth });
    termsY += doc.heightOfString(`• ${term}`, { width: termsWidth }) + 3;
  }

  const ledgerRows: [string, string][] = [
    ["Previous Balance", `${CURRENCY} ${formatMoney(receipt.previousBalance)}`],
    ["Total", `${CURRENCY} ${formatMoney(receipt.total)}`],
    ["Advance", `${CURRENCY} ${formatMoney(receipt.advance)}`],
    ["Balance", `${CURRENCY} ${formatMoney(receipt.balance)}`],
  ];
  const ledgerRowHeight = 18;
  const ledgerBoxHeight = ledgerRowHeight * ledgerRows.length;
  doc.strokeColor("#999999").rect(ledgerX, footerTop, ledgerWidth, ledgerBoxHeight).stroke();
  ledgerRows.forEach(([label, value], i) => {
    const rowTop = footerTop + i * ledgerRowHeight;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9).text(label, ledgerX + 8, rowTop + 5, {
      width: ledgerWidth * 0.5,
      lineBreak: false,
    });
    doc.font("Helvetica").text(value, ledgerX + 8 + ledgerWidth * 0.5, rowTop + 5, {
      width: ledgerWidth * 0.45,
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

  // --- Bank / Payment details — sits directly under the ledger box ---
  const bankTop = footerTop + ledgerBoxHeight + 10;
  const bankHeadingHeight = 18;
  const bankRowHeight = 16;
  const bankRows: [string, string][] = [
    ["Bank Name", "____________________"],
    ["Account Title", "____________________"],
    ["Account No / IBAN", "____________________"],
  ];
  const bankBoxHeight = bankHeadingHeight + bankRowHeight * bankRows.length + 4;
  doc.strokeColor("#999999").rect(ledgerX, bankTop, ledgerWidth, bankBoxHeight).stroke();
  doc
    .fillColor(BLACK)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("Bank / Payment Details", ledgerX + 8, bankTop + 6, { lineBreak: false });
  bankRows.forEach(([label, value], i) => {
    const rowTop = bankTop + bankHeadingHeight + i * bankRowHeight;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8).text(label, ledgerX + 8, rowTop, {
      width: ledgerWidth * 0.45,
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(8).text(value, ledgerX + 8 + ledgerWidth * 0.45, rowTop, {
      width: ledgerWidth * 0.47,
      lineBreak: false,
    });
  });

  y = Math.max(termsY, bankTop + bankBoxHeight) + 40;

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
