// Standalone script to update Infoplus return order line item custom field 'instructions'
// Usage: node updateReturnOrderInstructions.js <orderLineItems.json>
// orderLineItems.json should be an array of objects: [{ lineItemId, sku, instruction }]

require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.API_KEY;
const BASE_URL =
  process.env.BASE_URL ||
  'https://impressionsvanity.infopluswms.com/infoplus-wms/api/beta';

if (!API_KEY) {
  console.error('Missing API_KEY in environment.');
  process.exit(1);
}

async function updateInstructionsOnReturnOrderLine(
  lineItemId,
  sku,
  instruction
) {
  const apiUrl = `${BASE_URL}/returnOrderLineItem/${lineItemId}`;
  const payload = {
    customFields: {
      instructions: `${sku} - ${instruction}`,
    },
  };
  try {
    const res = await axios.patch(apiUrl, payload, {
      headers: { 'API-Key': API_KEY },
    });
    if (res.status >= 200 && res.status < 300) {
      console.log(`Updated lineItemId ${lineItemId}: ${sku} - ${instruction}`);
    } else {
      console.error(
        `Failed to update lineItemId ${lineItemId}:`,
        res.status,
        res.data
      );
    }
  } catch (err) {
    console.error(`Error updating lineItemId ${lineItemId}:`, err.message);
  }
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error(
      'Usage: node updateReturnOrderInstructions.js <orderLineItems.json>'
    );
    process.exit(1);
  }
  let items;
  try {
    items = require(inputFile);
  } catch (err) {
    console.error('Failed to read input file:', err.message);
    process.exit(1);
  }
  if (!Array.isArray(items)) {
    console.error(
      'Input file must be an array of { lineItemId, sku, instruction }'
    );
    process.exit(1);
  }
  for (const { lineItemId, sku, instruction } of items) {
    if (!lineItemId || !sku || !instruction) {
      console.error('Missing required fields in item:', {
        lineItemId,
        sku,
        instruction,
      });
      continue;
    }
    await updateInstructionsOnReturnOrderLine(lineItemId, sku, instruction);
  }
}

main();
