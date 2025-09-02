const axios = require('axios');

const BASE_URL =
  process.env.API_BASE_URL ||
  'https://impressionsvanity.infopluswms.com/infoplus-wms/api/beta';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn('⚠️ No API_KEY set. Add API_KEY=... to your .env');
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'API-Key': API_KEY
  },
  timeout: 20000,
  validateStatus: () => true
});

/**
 * Fetch return orders by originalOrderNo and return raw array.
 */
async function fetchReturnOrders(originalOrderNo) {
  const num = Number(originalOrderNo);
  const params = { filter: `originalOrderNo eq ${num}`, limit: 50 };

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await client.get('/returnOrder/search', { params });
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
      await wait(250 * Math.pow(2, attempt - 1));
      continue;
    }
    const details = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const err = new Error(`Infoplus error ${res.status}`);
    err.details = details;
    throw err;
  }
}

module.exports = {
  fetchReturnOrders
};
