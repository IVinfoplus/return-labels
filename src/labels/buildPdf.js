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
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const LEFT = 12;
  const RIGHT = pageW - 12;
  const LINE_W = pageW - 24;

  // === shift everything up 1/4" (18 pts) ===
  const yOffset = -18;

  const PREPRINT_PAD = 18;
  const IVC_BOX_H = 36;
  const IVC_Y = pageH - PREPRINT_PAD - IVC_BOX_H + yOffset;

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

  const bcBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: String(item.sku || ''),
    scale: 2,
    height: 14,
    includetext: false,
    textxalign: 'center',
  });

  // --- Header (logo + RETURNS) ---
  const headerTop = 20 + yOffset;
  if (logoPng) {
    const logoW = 118;
    doc.image(logoPng, LEFT, headerTop, { width: logoW });
  }
  doc
    .fontSize(18)
    .text('RETURNS', LEFT, headerTop, { width: LINE_W, align: 'right' });

  doc
    .moveTo(LEFT, 84 + yOffset)
    .lineTo(RIGHT, 84 + yOffset)
    .stroke();

  // --- Fields block ---
  let y = 94 + yOffset;
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
line('Instructions', item.customfields.get("instructions"));

// // --- Custom Instructions logic ---
// const customFieldLabels = {
//   warehouseSale: 'Warehouse Sale',
//   dispose: 'Dispose',
//   returnToStock: 'Return to Stock',
//   reship: 'Reship',
// };

// let instructionsValue = '';
// if (item.customFields) {
//   const trueFields = Object.entries(customFieldLabels)
//     .filter(([key]) => item.customFields[key])
//     .map(([key, label]) => label);

//   if (trueFields.length > 1) {
//     // In Node.js, you can't show a popup, but you can throw an error.
//     throw new Error(
//       'Multiple Return Instructions are marked true. Please edit so only one is marked true and try again.'
//     );
//   } else if (trueFields.length === 1) {
//     instructionsValue = trueFields[0];
//   }
// }
// if (!instructionsValue) instructionsValue = item.returnInstructions;

// line('Instructions', instructionsValue);

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  y += 10;

  line('Receipt Id', item.returnItemReceiptId);
  line('Condition', item.returnOrderLineInspectionStatus);

  // --- Qty row (Shp/Exp/Act) ---
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

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  y += 14;

  // --- SKU + barcode ---
  const CONTENT_BOTTOM = IVC_Y - 6;
  const skuText = String(item.sku ?? '');
  doc
    .fontSize(16)
    .text(skuText, LEFT, Math.min(y, CONTENT_BOTTOM - 90), {
      width: LINE_W,
      align: 'center',
    });
  y += 22;

  const bcY = Math.min(y, CONTENT_BOTTOM - 58);
  doc.image(bcBuffer, LEFT, bcY, { width: LINE_W });
  y = bcY + 58;

  // --- IVC footer ---
  if (item.ivcStatus) {
    const ivc = String(item.ivcStatus);
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(ivc, LEFT, IVC_Y + 4, { width: LINE_W, align: 'center' });
  }

  doc.font('Helvetica').fontSize(10);
}

async function buildReturnLabelPdf(item, count = 1) {
  const pageSize = [288, 432];
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
    await drawLabel(doc, item);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  return { path: outPath, filename };
}

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





