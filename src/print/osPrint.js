const printer = require('printer');
const fs = require('fs');

function listPrinters() {
  return printer.getPrinters();
}

function printPdf(filePath, printerName) {
  return new Promise((resolve, reject) => {
    const options = {
      printer: printerName || printer.getDefaultPrinterName(),
      type: 'PDF',
      options: {},
    };

    fs.readFile(filePath, (err, data) => {
      if (err) return reject(err);

      printer.printDirect({
        data,
        type: 'PDF',
        printer: options.printer,
        success: (jobId) =>
          resolve({ ok: true, jobId, printer: options.printer }),
        error: reject,
      });
    });
  });
}

module.exports = { listPrinters, printPdf };
