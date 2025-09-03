const printer = require('printer');
const fs = require('fs');

function listPrinters() {
  // Returns an array of installed printers with details
  return printer.getPrinters();
}

function getDefaultPrinterName() {
  try {
    return printer.getDefaultPrinterName();
  } catch {
    return null;
  }
}

/**
 * Print a PDF file via the OS spooler.
 * @param {string} filePath absolute path to a PDF
 * @param {string} [printerName] optional printer name; defaults to OS default
 */
function printPdf(filePath, printerName) {
  const target = printerName || getDefaultPrinterName();
  if (!target) {
    throw new Error('No printer specified and no default printer is set.');
  }

  return new Promise((resolve, reject) => {
    // read the PDF as a buffer and send via printDirect
    fs.readFile(filePath, (err, data) => {
      if (err) return reject(err);

      printer.printDirect({
        data,
        type: 'PDF', // Let the OS driver handle the PDF
        printer: target,
        success: (jobId) => resolve({ ok: true, jobId, printer: target }),
        error: (e) => reject(e),
      });
    });
  });
}

module.exports = { listPrinters, printPdf, getDefaultPrinterName };
