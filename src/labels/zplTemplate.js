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
 * Portrait 4x6 @ 203dpi (Zebra).
 * - Title "RETURNS" (ALL CAPS) top-right
 * - Date MM/DD/YYYY
 * - Horizontal line, then extra spacing before SKU block
 * - SKU centered, large, above barcode
 * - Barcode of SKU
 * - IVC Status centered, HUGE (last thing on label, no label text)
 * - Removed "4x6 Portrait" footer
 */
function buildReturnLabelZPL(item) {
  const useModern = Number(item.lobId) !== 19816;
  const logoName = useModern ? 'MODERN.GRF' : 'IVC.GRF';

  // 4x6 portrait @ 203dpi
  const PW = 812;
  const LL = 1218;

  const LEFT = 40;
  const TOP = 40;
  const LINE_W = PW - 80;
  const RIGHT_TITLE_X = PW - 300;

  const s = (v) => (v == null ? '' : String(v));
  const dateStr = formatDateMMDDYYYY(item.createDate);

  // Y positions
  const yLogo = TOP;
  const yTitle = TOP;
  const yDate = TOP + 100;
  const yOrder = yDate + 40;
  const yAsn = yOrder + 40;

  const yHr1 = yAsn + 40;            // first horizontal rule
  const yBlock1 = yHr1 + 30;         // block after rule

  const yStatus = yBlock1;
  const yReason = yStatus + 40;
  const yCat = yReason + 40;
  const yInstr = yCat + 40;

  const yHr2 = yInstr + 40;          // second horizontal rule
  const yBlock2 = yHr2 + 30;

  const yRcpt = yBlock2;
  const yShip = yRcpt + 40;
  const yExp  = yShip + 40;          // Expected directly under Shipped
  const yAct  = yExp + 40;
  const yCond = yAct + 40;

  const yHr3 = yCond + 40;           // third horizontal rule
  const ySkuTop = yHr3 + 50;         // EXTRA space before SKU (was +30)

  const BARCODE_HEIGHT = 200;
  const yBarcode = ySkuTop + 60;     // SKU text above barcode

  // IVC status at very bottom (centered, large). We’ll print near bottom margin.
  const yIvc = yBarcode + BARCODE_HEIGHT + 70; // gives room under barcode

  let ivcBlock = '';
  if (item.ivcStatus) {
    // HUGE by using a much larger font size.
    // ^FB centers/wraps across full width.
    ivcBlock = `
^CF0,80
^FO${LEFT},${yIvc}^FB${LINE_W},3,8,C,0^FD${s(item.ivcStatus)}^FS`;
  }

  return `
^XA
^PW${PW}
^LL${LL}
^POI

^CF0,36
^FO${LEFT},${yLogo}^XGR:${logoName},1,1^FS

^CF0,44
^FO${RIGHT_TITLE_X},${yTitle}^FDRETURNS^FS

^CF0,30
^FO${LEFT},${yDate}^FDDate: ${s(dateStr)}^FS
^FO${LEFT},${yOrder}^FDOrder #: ${s(item.originalOrderNo)}^FS
^FO${LEFT},${yAsn}^FDASN #: ${s(item.returnAsnId)}^FS

^FO${LEFT},${yHr1}^GB${LINE_W},2,2^FS

^CF0,28
^FO${LEFT},${yStatus}^FDReturn Status: ${s(item.returnOrderStatus)}^FS
^FO${LEFT},${yReason}^FDReason: ${s(item.returnReason)}^FS
^FO${LEFT},${yCat}^FDCategory: ${s(item.returnCategory)}^FS
^FO${LEFT},${yInstr}^FDInstructions: ${s(item.returnInstructions)}^FS

^FO${LEFT},${yHr2}^GB${LINE_W},2,2^FS

^CF0,28
^FO${LEFT},${yRcpt}^FDRcpt Id: ${s(item.returnItemReceiptId)}^FS
^FO${LEFT},${yShip}^FDShipped Qty: ${s(item.originalShippedQuantity)}^FS
^FO${LEFT},${yExp}^FDExpected Qty: ${s(item.expectedReturnQuantity)}^FS
^FO${LEFT},${yAct}^FDActual Qty: ${s(item.actualReturnQuantity)}^FS
^FO${LEFT},${yCond}^FDCondition: ${s(item.returnOrderLineInspectionStatus)}^FS

^FO${LEFT},${yHr3}^GB${LINE_W},2,2^FS

^CF0,56
^FO${LEFT},${ySkuTop}^FB${LINE_W},1,0,C,0^FD${s(item.sku)}^FS

^FO${LEFT},${yBarcode}^BCN,${BARCODE_HEIGHT},N,N,N^FD${s(item.sku)}^FS
${ivcBlock}

^XZ
`.trim();
}

module.exports = { buildReturnLabelZPL };
