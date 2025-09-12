function buildReturnLabelZpl(data, logo) {
  const {
    createDate,
    originalOrderNo,
    returnAsnId,
    returnOrderStatus,
    returnReason,
    returnCategory,
    instructions,
    returnItemReceiptId,
    sku,
    originalShippedQuantity,
    expectedReturnQuantity,
    actualReturnQuantity,
    returnOrderLineInspectionStatus,
    ivcStatus,
  } = data;

  // format date as MM/DD/YYYY
  const date = new Date(createDate).toLocaleDateString('en-US');

  // Start ZPL
  return `
^XA
^PW600
^LL0800
^LH0,0

${logo}

/* RETURNS Title */
^FO50,120^A0N,45,45^FDRETURNS^FS

/* Key Info */
^FO50,180^A0N,28,28^FDDate: ${date}^FS
^FO300,180^A0N,28,28^FDOrder #: ${originalOrderNo}^FS
^FO50,220^A0N,28,28^FDASN #: ${returnAsnId}^FS
^FO300,220^A0N,28,28^FDReceipt Id: ${returnItemReceiptId}^FS

^FO50,260^A0N,28,28^FDStatus: ${returnOrderStatus}^FS
^FO300,260^A0N,28,28^FDReason: ${returnReason}^FS


^FO50,300^A0N,28,28^FDCategory: ${returnCategory}^FS
^FO300,300^A0N,28,28^FDIVC Status: ${ivcStatus}^FS
^FO50,340^A0N,28,28^FDCondition: ${returnOrderLineInspectionStatus}^FS

/* Divider */
^FO40,380^GB520,2,2^FS

/* SKU above barcode */
^FO50,420^A0N,45,45^FD${sku}^FS

/* Barcode (shorter height) */
^FO50,470^BY2
^BCN,80,Y,N,N
^FD${sku}^FS

/* Quantities row (Shp, Exp, Act) */
^FO50,580^A0N,28,28^FDShp: ${originalShippedQuantity}^FS
^FO220,580^A0N,28,28^FDExp: ${expectedReturnQuantity}^FS
^FO390,580^A0N,28,28^FDAct: ${actualReturnQuantity}^FS


/* Instructions big & bold below barcode, max width, fit on one line */
^FO50,560^A0N,44,44^FD${data.instructionDetails || data.instructions || ''}^FS

^XZ
`;
}

module.exports = { buildReturnLabelZpl };
