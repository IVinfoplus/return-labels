const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const bwipjs = require('bwip-js');
const fs = require('fs');

function formatDateMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Portrait-only 4x6 PDF label with:
 * - Title "RETURNS" (ALL CAPS) top-right
 * - Date as MM/DD/YYYY
 * - Extra space between rule and SKU
 * - SKU centered, bigger, bold-ish (size bump) above barcode
 * - Barcode of SKU
 * - IVC Status centered, HUGE, bold, last element on label (wrapped, no label)
 * - Footer text removed
 */
async function drawLabel(doc, item) {
  const { width } = doc.page;

  const LEFT = 12;
  const RIGHT = width - 12;
  const LINE_W = width - 24;

  // Pick logo by lobId -> load SVG -> PNG buffer
  const useModern = Number(item.lobId) !== 19816;
  const logoSvgPath = path.join(
    __dirname, '..', 'public', 'images',
    useModern ? 'modernMirrors-logo.svg' : 'impressions-logo.svg'
  );

  let logoPng = null;
  try { logoPng = await sharp(logoSvgPath).png().toBuffer(); } catch {}

  // Barcode buffer for SKU (Code128)
  const bcBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: String(item.sku || ''),
    scale: 2,
    height: 18,
    includetext: false,
    textxalign: 'center'
  });

  // Header
  const headerTop = 10;
  if (logoPng) {
    const logoW = 120;
    doc.image(logoPng, LEFT, headerTop, { width: logoW });
  }
  // Title on right (ALL CAPS)
  doc.fontSize(16).text('RETURNS', LEFT, headerTop, { width: LINE_W, align: 'right' });

  // Divider under header
  doc.moveTo(LEFT, 78).lineTo(RIGHT, 78).stroke();

  // Fields
  let y = 86;
  const dateStr = formatDateMMDDYYYY(item.createDate);
  doc.fontSize(9);

  const line = (k, v) => {
    doc.text(`${k}: ${v ?? ''}`, LEFT, y, { width: LINE_W });
    y += 14;
  };

  line('Date', dateStr);
  line('Order #', item.originalOrderNo);
  line('ASN #', item.returnAsnId);

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke(); y += 8;

  line('Return Status', item.returnOrderStatus);
  line('Reason', item.returnReason);
  line('Category', item.returnCategory);
  line('Instructions', item.returnInstructions);

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke(); y += 8;

  line('Rcpt Id', item.returnItemReceiptId);
  line('Shipped Qty', item.originalShippedQuantity);
  line('Expected Qty', item.expectedReturnQuantity);
  line('Actual Qty', item.actualReturnQuantity);
  line('Condition', item.returnOrderLineInspectionStatus);

  // Horizontal rule then EXTRA spacing before SKU
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke(); 
  y += 16; // extra gap (was 8)

  // SKU centered, bigger
  doc.fontSize(14).text(String(item.sku ?? ''), LEFT, y, { width: LINE_W, align: 'center' });
  y += 20;

  // Barcode
  const bcW = LINE_W;
  doc.image(bcBuffer, LEFT, y, { width: bcW });
  y += 72;

  // IVC Status: last thing, HUGE, bold, centered, wrapped, no label
  if (item.ivcStatus) {
    doc.font('Helvetica-Bold').fontSize(18)
      .text(String(item.ivcStatus), LEFT, y, { width: LINE_W, align: 'center' });
    // no further footer so it stays the last element
  }

  // Reset font to default for next page
  doc.font('Helvetica').fontSize(9);
}

/**
 * Build a PDF for a single item repeated "count" times. Portrait only (4x6).
 */
async function buildReturnLabelPdf(item, count = 1) {
  const pageSize = [288, 432]; // 4x6 at 72dpi
  const filename = `return-label-${item.originalOrderNo}-${item.sku}-portrait.pdf`;

  try { fs.mkdirSync(path.join(__dirname, '..', '..', 'tmp'), { recursive: true }); } catch {}

  const outPath = path.join(__dirname, '..', '..', 'tmp', filename);
  const doc = new PDFDocument({ size: pageSize, margin: 12, autoFirstPage: false });

  for (let i = 0; i < count; i++) {
    doc.addPage();
    // eslint-disable-next-line no-await-in-loop
    await drawLabel(doc, item);
  }

  const fileStream = fs.createWriteStream(outPath);
  const writeStream = doc.pipe(fileStream);
  doc.end();

  return await new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve({ stream: fs.createReadStream(outPath), filename }));
    writeStream.on('error', reject);
  });
}

/**
 * Build a single multi-page PDF for many items. Portrait only (4x6).
 */
async function buildReturnLabelPdfMulti(items) {
  const pageSize = [288, 432];
  const filename = `return-labels-batch-portrait.pdf`;

  try { fs.mkdirSync(path.join(__dirname, '..', '..', 'tmp'), { recursive: true }); } catch {}

  const outPath = path.join(__dirname, '..', '..', 'tmp', filename);
  const doc = new PDFDocument({ size: pageSize, margin: 12, autoFirstPage: false });

  for (const item of items) {
    const count = Math.max(1, Number(item.actualReturnQuantity) || 1);
    for (let i = 0; i < count; i++) {
      doc.addPage();
      // eslint-disable-next-line no-await-in-loop
      await drawLabel(doc, item);
    }
  }

  const fileStream = fs.createWriteStream(outPath);
  const writeStream = doc.pipe(fileStream);
  doc.end();

  return await new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve({ stream: fs.createReadStream(outPath), filename }));
    writeStream.on('error', reject);
  });
}

module.exports = { buildReturnLabelPdf, buildReturnLabelPdfMulti };
