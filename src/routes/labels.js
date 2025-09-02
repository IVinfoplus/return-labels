const express = require('express');
const { buildReturnLabelZPL } = require('../labels/zplTemplate');
const { buildReturnLabelPdf, buildReturnLabelPdfMulti } = require('../labels/buildPdf');
const { sendZplToZebra } = require('../print/zebraRaw9100');

const router = express.Router();

// Convert filtered API shape (with label-keys) back to internal shape for builders
function normalizeItem(item) {
  return {
    createDate: item['Date'],
    originalOrderNo: item['Order #'],
    returnAsnId: item['ASN #'],
    returnOrderStatus: item['Return Status'],
    returnReason: item['Reason'],
    returnCategory: item['Category'],
    returnInstructions: item['Instructions'],
    returnItemReceiptId: item['Rcpt Id'],
    sku: item['SKU'],
    originalShippedQuantity: item['Shipped'],
    expectedReturnQuantity: item['Expected'],
    actualReturnQuantity: item['Actual'],
    returnOrderLineInspectionStatus: item['Condition'],
    ivcStatus: item['IVC Status'],
    lobId: item._meta?._lobId
  };
}

/**
 * POST /api/labels/zpl
 * Body: { item, count }
 * Returns ZPL string (portrait-only, count copies)
 */
router.post('/zpl', async (req, res) => {
  try {
    const { item, count = 1 } = req.body || {};
    if (!item || !item['SKU']) {
      return res.status(400).json({ ok: false, error: 'Body must include item with SKU' });
    }
    const norm = normalizeItem(item);
    const c = Math.max(1, Number(count) || Number(norm.actualReturnQuantity) || 1);

    let payload = '';
    for (let i = 0; i < c; i++) {
      payload += buildReturnLabelZPL(norm) + '\n';
    }

    res.type('text/plain').send(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/labels/print-zpl
 * Body: { item, count, zebraHost, port }
 * Sends ZPL to printer via RAW 9100 (portrait only)
 */
router.post('/print-zpl', async (req, res) => {
  try {
    const { item, count = 1, zebraHost, port = 9100 } = req.body || {};
    if (!item || !item['SKU']) return res.status(400).json({ ok: false, error: 'Missing item.SKU' });
    if (!zebraHost) return res.status(400).json({ ok: false, error: 'Missing zebraHost' });

    const norm = normalizeItem(item);
    const c = Math.max(1, Number(count) || Number(norm.actualReturnQuantity) || 1);

    let payload = '';
    for (let i = 0; i < c; i++) {
      payload += buildReturnLabelZPL(norm) + '\n';
    }

    const result = await sendZplToZebra(zebraHost, Number(port) || 9100, payload);
    res.json({ ok: true, sent: c, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/labels/preview-pdf
 * Body: { item, count }
 * Streams a multi-page PDF, one label per page (portrait only)
 */
router.post('/preview-pdf', async (req, res) => {
  try {
    const { item, count = 1 } = req.body || {};
    if (!item || !item['SKU']) {
      return res.status(400).json({ ok: false, error: 'Body must include item with SKU' });
    }
    const norm = normalizeItem(item);
    const c = Math.max(1, Number(count) || Number(norm.actualReturnQuantity) || 1);

    const { stream, filename } = await buildReturnLabelPdf(norm, c);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/labels/zpl-all
 * Body: { items }
 * Returns combined ZPL payload for all lines; each repeated by "Actual" (portrait only)
 */
router.post('/zpl-all', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'items[] required' });
    }
    let payload = '';
    let total = 0;
    for (const item of items) {
      const norm = normalizeItem(item);
      const c = Math.max(1, Number(norm.actualReturnQuantity) || 1);
      total += c;
      for (let i = 0; i < c; i++) {
        payload += buildReturnLabelZPL(norm) + '\n';
      }
    }
    res.setHeader('X-Label-Count', String(total));
    res.type('text/plain').send(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/labels/print-all
 * Body: { items, zebraHost, port }
 */
router.post('/print-all', async (req, res) => {
  try {
    const { items, zebraHost, port = 9100 } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'items[] required' });
    }
    if (!zebraHost) return res.status(400).json({ ok: false, error: 'Missing zebraHost' });

    let payload = '';
    let total = 0;
    for (const item of items) {
      const norm = normalizeItem(item);
      const c = Math.max(1, Number(norm.actualReturnQuantity) || 1);
      total += c;
      for (let i = 0; i < c; i++) {
        payload += buildReturnLabelZPL(norm) + '\n';
      }
    }
    const result = await sendZplToZebra(zebraHost, Number(port) || 9100, payload);
    res.json({ ok: true, total, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/labels/preview-pdf-all
 * Body: { items }
 * Streams a single multi-page PDF with all labels (portrait only)
 */
router.post('/preview-pdf-all', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'items[] required' });
    }
    const normalized = items.map(normalizeItem);
    const { stream, filename } = await buildReturnLabelPdfMulti(normalized);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
