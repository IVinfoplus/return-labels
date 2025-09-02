const form = document.getElementById('search-form');
const output = document.getElementById('json-output');
const resultsDiv = document.getElementById('results');
const toggleRawBtn = document.getElementById('toggle-raw');
const pdfAllBtn = document.getElementById('pdf-all');
const zplAllBtn = document.getElementById('zpl-all');
const printAllBtn = document.getElementById('print-all');

let lastData = null;

toggleRawBtn.addEventListener('click', () => {
  if (!output.hasAttribute('hidden')) output.setAttribute('hidden', 'hidden');
  else output.removeAttribute('hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const originalOrderNo = document.getElementById('originalOrderNo').value.trim();
  if (!originalOrderNo) return;

  resultsDiv.innerHTML = '<div class="small">Loading…</div>';
  output.textContent = '// Loading…';

  try {
    const res = await fetch(`/api/returns/search?originalOrderNo=${encodeURIComponent(originalOrderNo)}`);
    const data = await res.json();
    lastData = data;
    output.textContent = JSON.stringify(data, null, 2);
    renderResults(data);
  } catch (err) {
    output.textContent = JSON.stringify({ ok: false, message: err.message }, null, 2);
    resultsDiv.innerHTML = '<div class="small">Error loading results.</div>';
  }
});

function renderResults(data) {
  if (!data.ok || !Array.isArray(data.results) || data.results.length === 0) {
    resultsDiv.innerHTML = '<div class="small">No results.</div>';
    return;
  }

  const rows = data.results.map((r, idx) => {
    const qty = Number(r['Actual']) || 1;
    const company = Number(r._meta?._lobId) !== 19816 ? 'Modern Mirrors' : 'Impressions Vanity';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div><strong>SKU:</strong> ${safe(r['SKU'])}</div>
          <div class="small">${company}</div>
        </td>
        <td>
          <div><strong>Order #:</strong> ${safe(r['Order #'])}</div>
          <div>ASN: ${safe(r['ASN #'])}</div>
        </td>
        <td>
          <div>${safe(r['Return Status'])}</div>
          <div class="small">${safe(r['Reason'])} • ${safe(r['Category'])}</div>
          <div class="small">Cond: ${safe(r['Condition'])} • IVC: ${safe(r['IVC Status'])}</div>
        </td>
        <td>
          <div class="small">Shipped Qty: ${safe(r['Shipped'])}</div>
          <div class="small">Expected Qty: ${safe(r['Expected'])}</div>
          <div class="small">Actual Qty: ${safe(r['Actual'])}</div>
          <div class="small">${safe(r['Instructions'])}</div>
        </td>
        <td>
          <div class="action-bar">
            <button data-action="pdf" data-idx="${idx}">Preview PDF (${qty})</button>
            <button data-action="zpl" data-idx="${idx}">Download ZPL (${qty})</button>
            <button data-action="print" data-idx="${idx}">Print to Zebra (${qty})</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  resultsDiv.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Order</th>
          <th>Status</th>
          <th>Details</th>
          <th>Label</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  resultsDiv.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', onActionClick);
  });
}

function safe(v) { return v == null ? '' : String(v); }

async function onActionClick(e) {
  const idx = Number(e.currentTarget.getAttribute('data-idx'));
  const action = e.currentTarget.getAttribute('data-action');
  const zebraHost = document.getElementById('zebraHost').value.trim();
  const item = lastData.results[idx];
  const count = Number(item['Actual']) || 1;

  if (action === 'pdf') {
    const res = await fetch('/api/labels/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count })
    });
    if (!res.ok) return alert('Failed to render PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  if (action === 'zpl') {
    const res = await fetch('/api/labels/zpl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count })
    });
    if (!res.ok) return alert('Failed to build ZPL');
    const zpl = await res.text();
    const blob = new Blob([zpl], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `label-${item['Order #']}-${item['SKU']}.zpl`;
    a.click();
  }

  if (action === 'print') {
    if (!zebraHost) return alert('Enter Zebra IP first');
    const res = await fetch('/api/labels/print-zpl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count, zebraHost })
    });
    const data = await res.json();
    if (!data.ok) return alert('Print failed: ' + (data.error || 'Unknown'));
    alert(`Sent ${count} label(s) to ${zebraHost}`);
  }
}

// ---- "ALL" buttons ----
pdfAllBtn.addEventListener('click', async () => {
  if (!lastData?.ok || !Array.isArray(lastData.results) || !lastData.results.length) return alert('Search first');
  const res = await fetch('/api/labels/preview-pdf-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: lastData.results })
  });
  if (!res.ok) return alert('Failed to render batch PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});

zplAllBtn.addEventListener('click', async () => {
  if (!lastData?.ok || !Array.isArray(lastData.results) || !lastData.results.length) return alert('Search first');
  const res = await fetch('/api/labels/zpl-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: lastData.results })
  });
  if (!res.ok) return alert('Failed to build batch ZPL');
  const zpl = await res.text();
  const blob = new Blob([zpl], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `labels-batch.zpl`;
  a.click();
});

printAllBtn.addEventListener('click', async () => {
  if (!lastData?.ok || !Array.isArray(lastData.results) || !lastData.results.length) return alert('Search first');
  const zebraHost = document.getElementById('zebraHost').value.trim();
  if (!zebraHost) return alert('Enter Zebra IP first');
  const res = await fetch('/api/labels/print-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: lastData.results, zebraHost })
  });
  const data = await res.json();
  if (!data.ok) return alert('Batch print failed: ' + (data.error || 'Unknown'));
  alert(`Sent ${data.total} label(s) to ${zebraHost}`);
});
