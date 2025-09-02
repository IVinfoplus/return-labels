const express = require('express');
const { fetchReturnOrders } = require('../lib/infoplus');

const router = express.Router();

/**
 * Map raw Infoplus order objects to your requested fields and flatten to lines.
 * Output keys (exact labels you requested):
 *  Date, Order #, ASN #, Return Status, Reason, Category, Instructions,
 *  Rcpt Id, SKU, Shipped, Expected, Actual, Condition, IVC Status
 *
 * We also include a private _meta object with _lobId for logo selection.
 */
function shapeToLabelLines(rawOrders) {
  const lines = [];
  for (const order of rawOrders) {
    const base = {
      _meta: { _lobId: order.lobId }
    };

    const origNum =
      typeof order.originalOrderNo === 'number'
        ? Math.trunc(order.originalOrderNo)
        : order.originalOrderNo;

    for (const li of order.returnOrderLineItemList || []) {
      lines.push({
        ...base,
        'Date': order.createDate,
        'Order #': origNum,
        'ASN #': order.returnAsnId,
        'Return Status': order.returnOrderStatus,
        'Reason': order.returnReason,
        'Category': order.returnCategory,
        'Instructions': order.returnInstructions,
        'Rcpt Id': li.returnItemReceiptId,
        'SKU': li.sku,
        'Shipped': li.originalShippedQuantity,
        'Expected': li.expectedReturnQuantity,
        'Actual': li.actualReturnQuantity,
        'Condition': li.returnOrderLineInspectionStatus,
        'IVC Status': (li.customFields && li.customFields.ivcStatus) ?? null
      });
    }
  }
  return lines;
}

/**
 * GET /api/returns/search?originalOrderNo=NNN
 * Returns flattened & filtered lines.
 */
router.get('/search', async (req, res) => {
  try {
    const { originalOrderNo } = req.query;
    if (!originalOrderNo) {
      return res
        .status(400)
        .json({ ok: false, error: 'Query param "originalOrderNo" is required' });
    }

    const raw = await fetchReturnOrders(originalOrderNo);
    const lines = shapeToLabelLines(Array.isArray(raw) ? raw : []);
    return res.json({ ok: true, count: lines.length, results: lines });
  } catch (err) {
    console.error('Error searching return orders:', err?.details || err.message);
    return res.status(502).json({
      ok: false,
      message: 'Infoplus request failed',
      details: err?.details || err.message
    });
  }
});

module.exports = router;
