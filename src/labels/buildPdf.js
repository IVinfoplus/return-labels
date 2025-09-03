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

// --- draw a single portrait 4x6 page ---
async function drawLabel(doc, item) {
  const { width, height } = doc.page;

  const LEFT = 12;
  const RIGHT = width - 12;
  const LINE_W = width - 24;
  const BOTTOM_PAD = 18; // reserved bottom pad for preprinted text

  const useModern = Number(item.lobId) !== 19816;
  const logoSvgPath = path.join(
    __dirname,
    '..',
    'public',
    'images',
    useModern ? 'modernMirrors-logo.svg' : 'impressions-logo.svg'
  );

  let logoPng = null;
  try {
    logoPng = await sharp(logoSvgPath).png().toBuffer();
  } catch {}

  // Shorter barcode to keep space for IVC
  const bcBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: String(item.sku || ''),
    scale: 2,
    height: 16,
    includetext: false,
    textxalign: 'center',
  });

  // Header — logo moved *up* slightly so it doesn't overlap the rule
  const headerTop = 22;
  if (logoPng) {
    const logoW = 118;
    doc.image(logoPng, LEFT, headerTop, { width: logoW });
  }
  doc
    .fontSize(18)
    .text('RETURNS', LEFT, headerTop, { width: LINE_W, align: 'right' });

  // First divider just below logo
  doc.moveTo(LEFT, 86).lineTo(RIGHT, 86).stroke();

  // Fields
  let y = 96;
  const dateStr = formatDateMMDDYYYY(item.createDate);
  doc.fontSize(10);

  const line = (k, v) => {
    doc.text(`${k}: ${v ?? ''}`, LEFT, y, { width: LINE_W });
    y += 16;
  };

  line('Date', dateStr);
  line('Order #', item.originalOrderNo);
  line('ASN #', item.returnAsnId);

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  y += 10;

  line('Return Status', item.returnOrderStatus);
  line('Reason', item.returnReason);
  line('Category', item.returnCategory);
  line('Instructions', item.returnInstructions);

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  y += 10;

  line('Receipt Id', item.returnItemReceiptId);
  line('Condition', item.returnOrderLineInspectionStatus);

  // Compact qty row (Shp / Exp / Act)
  const qtyY = y;
  const colW = Math.floor(LINE_W / 3);
  doc
    .fontSize(10)
    .text(`Shp: ${item.originalShippedQuantity ?? ''}`, LEFT + 0 * colW, qtyY, {
      width: colW,
      align: 'center',
    })
    .text(`Exp: ${item.expectedReturnQuantity ?? ''}`, LEFT + 1 * colW, qtyY, {
      width: colW,
      align: 'center',
    })
    .text(`Act: ${item.actualReturnQuantity ?? ''}`, LEFT + 2 * colW, qtyY, {
      width: colW,
      align: 'center',
    });

  y = qtyY + 18;

  // Divider before SKU
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  y += 16;

  // SKU (centered)
  doc
    .fontSize(16)
    .text(String(item.sku ?? ''), LEFT, y, { width: LINE_W, align: 'center' });
  y += 24;

  // Barcode (shorter)
  doc.image(bcBuffer, LEFT, y, { width: LINE_W });
  y += 68;

  // Push IVC to near-bottom with safe padding
  const spaceLeft = height - BOTTOM_PAD - y;
  if (spaceLeft > 0) y += spaceLeft - 6;

  if (item.ivcStatus) {
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(String(item.ivcStatus), LEFT, y, {
        width: LINE_W,
        align: 'center',
      });
  }

  doc.font('Helvetica').fontSize(10); // reset for next page
}

// Build a single-label PDF, saved to tmp, and return its file path
async function buildReturnLabelPdf(item, count = 1) {
  const pageSize = [288, 432]; // 4x6 at 72dpi
  const filename = `return-label-${item.originalOrderNo}-${item.sku}-portrait.pdf`;
  const outPath = path.join(__dirname, '..', '..', 'tmp', filename);

  fs.mkdirSync(path.join(__dirname, '..', '..', 'tmp'), { recursive: true });

  const doc = new PDFDocument({
    size: pageSize,
    margin: 12,
    autoFirstPage: false,
  });
  const fileStream = fs.createWriteStream(outPath);
  doc.pipe(fileStream);

  for (let i = 0; i < count; i++) {
    doc.addPage();
    // eslint-disable-next-line no-await-in-loop
    await drawLabel(doc, item);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  return { path: outPath, filename };
}

// Build a multi-label PDF (batch), saved to tmp, and return its file path
async function buildReturnLabelPdfMulti(items) {
  const pageSize = [288, 432];
  const filename = `return-labels-batch-portrait.pdf`;
  const outPath = path.join(__dirname, '..', '..', 'tmp', filename);

  fs.mkdirSync(path.join(__dirname, '..', '..', 'tmp'), { recursive: true });

  const doc = new PDFDocument({
    size: pageSize,
    margin: 12,
    autoFirstPage: false,
  });
  const fileStream = fs.createWriteStream(outPath);
  doc.pipe(fileStream);

  for (const item of items) {
    const count = Math.max(1, Number(item.actualReturnQuantity) || 1);
    for (let i = 0; i < count; i++) {
      doc.addPage();
      // eslint-disable-next-line no-await-in-loop
      await drawLabel(doc, item);
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  return { path: outPath, filename };
}

module.exports = { buildReturnLabelPdf, buildReturnLabelPdfMulti };
