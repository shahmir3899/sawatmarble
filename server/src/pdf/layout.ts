import path from "path";
import PDFDocument from "pdfkit";

type PDFDoc = InstanceType<typeof PDFDocument>;

// Palette matches the physical paper invoice book (red/black), not the
// gold app-chrome branding — see receiptPdf.ts for the fuller rationale.
// The logo image itself is the one piece of real brand gold allowed in —
// the app's own logo (client/src/assets/logo.jpeg), resized to a compact
// square for the header.
export const LOGO_PATH = path.join(__dirname, "assets", "logo-full.jpg");
export const LOGO_ASPECT = 1; // logo-full.jpg is square

const RED = "#c0392b";
const BLACK = "#1a1a1a";
const GRAY = "#555555";
const LINE = "#cccccc";
const ZEBRA = "#f7f7f7";

const LOGO_HEIGHT = 72; // 1 inch square
const CONTACT_BAND_HEIGHT = 46;
// Space reserved above the bottom margin for the separator line + red
// contact band, so content never gets drawn underneath the footer.
const FOOTER_RESERVE = CONTACT_BAND_HEIGHT + 14;

/** Bottom y beyond which content must not be drawn — the footer starts right below it. */
export function contentBottom(doc: PDFDoc) {
  return doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
}

/** Logo + company name, followed by the divider line. Returns the y position to continue drawing from. */
export function drawLetterhead(doc: PDFDoc, left: number, y: number, pageWidth: number, badge?: string) {
  doc.image(LOGO_PATH, left, y, { width: LOGO_HEIGHT, height: LOGO_HEIGHT });
  const textX = left + LOGO_HEIGHT * LOGO_ASPECT + 14;

  // Company name as one line, sized to fill the space next to the logo
  // without running into the badge (DELIVERY CHALLAN / QUOTATION) on the right.
  const name = "SAWAT MARBLE STONE & GRANITE";
  const badgeReserve = badge ? 150 : 0;
  const availableWidth = pageWidth - (textX - left) - badgeReserve;
  doc.font("Helvetica-Bold");
  let fontSize = 24;
  while (fontSize > 12 && doc.fontSize(fontSize).widthOfString(name) > availableWidth) {
    fontSize -= 1;
  }
  doc
    .fillColor(BLACK)
    .font("Helvetica-Bold")
    .fontSize(fontSize)
    .text(name, textX, y + (LOGO_HEIGHT - fontSize) / 2, { lineBreak: false });

  if (badge) {
    const badgeWidth = 140;
    doc
      .fillColor(GRAY)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(badge, left + pageWidth - badgeWidth, y + LOGO_HEIGHT / 2 - 5, {
        width: badgeWidth,
        align: "right",
        lineBreak: false,
      });
  }

  let newY = y + LOGO_HEIGHT + 10;
  doc.strokeColor(LINE).moveTo(left, newY).lineTo(left + pageWidth, newY).stroke();
  newY += 14;
  return newY;
}

/**
 * If there isn't room left on the page for a block of the given height
 * before the footer, start a fresh page and return its top margin instead.
 */
export function ensureSpaceAboveFooter(doc: PDFDoc, y: number, blockHeight: number) {
  if (y + blockHeight > contentBottom(doc)) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

/** Separator line + red contact band, pinned to the bottom of the current page. */
export function drawFooter(doc: PDFDoc, left: number, pageWidth: number) {
  const bandTop = doc.page.height - doc.page.margins.bottom - CONTACT_BAND_HEIGHT;
  doc.strokeColor(LINE).moveTo(left, bandTop - 14).lineTo(left + pageWidth, bandTop - 14).stroke();
  doc.rect(left, bandTop, pageWidth, CONTACT_BAND_HEIGHT).fill(RED);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  doc.text("Gangal West Service Road, Rawalpindi", left + 10, bandTop + 6, { lineBreak: false });
  doc.text("Zulfiqar Ali | 0311-5290097, 0304-9420334    Iftikhar Ali | 0316-5619196", left + 10, bandTop + 20, {
    lineBreak: false,
  });
  doc.text("sawatmarblestone4684@yahoo.com", left + 10, bandTop + 34, { lineBreak: false });
}

export type TableColumn = { label: string; widthFrac: number };

/**
 * Row-based table starting at (left, y). Breaks to a new page (redrawing
 * the red header row there too) whenever the next row would collide with
 * the footer's reserved space, instead of letting rows silently run off
 * the bottom of the page. Returns the y position just below the table.
 */
export function drawTable(
  doc: PDFDoc,
  left: number,
  y: number,
  pageWidth: number,
  columns: readonly TableColumn[],
  rows: readonly (readonly string[])[],
  rowHeight = 22
) {
  const colWidths = columns.map((c) => c.widthFrac * pageWidth);

  function drawHeaderRow(top: number) {
    doc.rect(left, top, pageWidth, rowHeight).fill(RED);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    let x = left;
    columns.forEach((col, i) => {
      doc.text(col.label, x + 4, top + 6, { width: colWidths[i]! - 8, lineBreak: false });
      x += colWidths[i]!;
    });
  }

  let tableTop = y;
  drawHeaderRow(tableTop);
  let rowY = tableTop + rowHeight;
  doc.font("Helvetica").fontSize(9);

  rows.forEach((values, idx) => {
    if (rowY + rowHeight > contentBottom(doc)) {
      doc.strokeColor("#999999").rect(left, tableTop, pageWidth, rowY - tableTop).stroke();
      doc.addPage();
      tableTop = doc.page.margins.top;
      drawHeaderRow(tableTop);
      rowY = tableTop + rowHeight;
    }
    if (idx % 2 === 1) {
      doc.rect(left, rowY, pageWidth, rowHeight).fill(ZEBRA);
    }
    let x = left;
    doc.fillColor(BLACK).font("Helvetica").fontSize(9);
    values.forEach((val, i) => {
      doc.text(val, x + 4, rowY + 6, { width: colWidths[i]! - 8, lineBreak: false });
      x += colWidths[i]!;
    });
    doc.strokeColor(LINE).rect(left, rowY, pageWidth, rowHeight).stroke();
    rowY += rowHeight;
  });
  doc.strokeColor("#999999").rect(left, tableTop, pageWidth, rowY - tableTop).stroke();

  return rowY;
}
