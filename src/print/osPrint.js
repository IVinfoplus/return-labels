// Cross-platform PDF printing via OS spooler using pdf-to-printer
// Works on Windows/macOS/Linux and with modern Node versions.
const fs = require('fs');
const { getPrinters, getDefaultPrinter, print } = require('pdf-to-printer');

async function listPrinters() {
  try {
    // returns [{name, status, options...}, ...] (shape varies by OS)
    return await getPrinters();
  } catch (e) {
    // If not supported on this OS, return empty list
    return [];
  }
}

async function getDefaultPrinterName() {
  try {
    const p = await getDefaultPrinter();
    return p?.name || null;
  } catch {
    return null;
  }
}

/**
 * Print a PDF file via the OS spooler.
 * @param {string} filePath absolute path to a PDF
 * @param {string} [printerName] optional; use OS default if omitted
 */
async function printPdf(filePath, printerName) {
  // Ensure file exists before calling the OS
  await fs.promises.access(filePath, fs.constants.R_OK);

  const opts = {};
  if (printerName) opts.printer = printerName;

  // You can set copies here if desired: opts.copies = 1;
  await print(filePath, opts);

  return {
    ok: true,
    printer: printerName || (await getDefaultPrinterName()) || '(default)',
  };
}

module.exports = { listPrinters, printPdf, getDefaultPrinterName };
