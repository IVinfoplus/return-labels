const form = document.getElementById('search-form');
const output = document.getElementById('json-output');
const resultsDiv = document.getElementById('results');
const toggleRawBtn = document.getElementById('toggle-raw');
const pdfAllBtn = document.getElementById('pdf-all');
// const zplAllBtn = document.getElementById('zpl-all');
// const printAllBtn = document.getElementById('print-all');
const printAllPdfBtn = document.getElementById('print-all-pdf');
const printerSelect = document.getElementById('printerName');

let lastData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Populate OS printers dropdown
  try {
    const res = await fetch('/api/labels/printers');
    const data = await res.json();
    if (data.ok && Array.isArray(data.printers)) {
      const def = data.defaultPrinter;
      for (const p of data.printers) {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name + (p.name === def ? ' (default)' : '');
        // If you want to automatically select the default printer, uncomment the next line:
        // if (!printerSelect.value && p.name === def) printerSelect.value = p.name;
        printerSelect.appendChild(opt);
      }
    }
  } catch (err) {
    console.error('Failed to fetch printers:', err);
    // ignore; user can still print to default
  }

  toggleRawBtn.addEventListener('click', () => {
    if (!output.hasAttribute('hidden')) {
      output.setAttribute('hidden', '');
    } else {
      output.removeAttribute('hidden');
    }
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const originalOrderNo = document
    .getElementById('originalOrderNo')
    .value.trim();
  if (!originalOrderNo) return;

  resultsDiv.innerHTML = '<div class="small">Loading…</div>';
  output.textContent = '// Loading…';

  try {
    const res = await fetch(
      `/api/returns/search?originalOrderNo=${encodeURIComponent(
        originalOrderNo
      )}`
    );
    const data = await res.json();
    lastData = data;
    output.textContent = JSON.stringify(data, null, 2);
    renderResults(data);
  } catch (err) {
    output.textContent = JSON.stringify(
      { ok: false, message: err.message },
      null,
      2
    );
    resultsDiv.innerHTML = '<div class="small">Error loading results.</div>';
  }
});

function renderResults(data) {
  if (!data.ok || !Array.isArray(data.results) || data.results.length === 0) {
    resultsDiv.innerHTML = '<div class="small">No results.</div>';
    return;
  }

  const rows = data.results
    .map((r, idx) => {
      const qty = Number(r['Actual']) || 1;
      const company =
        Number(r._meta?._lobId) !== 19816
          ? 'Modern Mirrors'
          : 'Impressions Vanity';
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
          <div class="small">Cond: ${safe(r['Condition'])} • IVC: ${safe(
        r['IVC Status']
      )}</div>
        </td>
        <td>
          <div class="small">Shp: ${safe(r['Shipped'])}</div>
          <div class="small">Exp: ${safe(r['Expected'])}</div>
          <div class="small">Act: ${safe(r['Actual'])}</div>
          <div>
            <label for="instructions-${idx}" class="small">Instructions:</label>
            <select id="instructions-${idx}" class="instructions-dropdown">
              <option value="">(Select)</option>
              <option value="Dispose">Dispose</option>
              <option value="Reship">Reship</option>
              <option value="Return to Stock">Return to Stock</option>
              <option value="Warehouse Sale">Warehouse Sale</option>
            </select>
          </div>
        </td>
        <td>
          <div class="action-bar">
            <button data-action="pdf" data-idx="${idx}">Preview PDF (${qty})</button>
            <!-- <button data-action="zpl" data-idx="${idx}">Download ZPL (${qty})</button> -->
            <!-- <button data-action="print-os" data-idx="${idx}">Print</button> -->
            <!-- <button data-action="print-ip" data-idx="${idx}">Print (Zebra IP)</button> -->
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

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

  // Add event listeners to instruction dropdowns to update the right-side list
  data.results.forEach((r, idx) => {
    const dropdown = document.getElementById(`instructions-${idx}`);
    if (dropdown) {
      dropdown.addEventListener('change', () =>
        updateInstructionsList(data.results)
      );
    }
  });
  // Initial list render
  updateInstructionsList(data.results);

  function updateInstructionsList(results) {
    const list = document.getElementById('instructions-list');
    if (!list) return;
    list.innerHTML = '';
    results.forEach((item, idx) => {
      const dropdown = document.getElementById(`instructions-${idx}`);
      const instruction = dropdown
        ? dropdown.value
        : item['Instructions'] || '';
      if (instruction) {
        const sku = item['SKU'] || '';
        const li = document.createElement('li');
        li.textContent = `${idx + 1}) ${sku} - ${instruction}`;
        list.appendChild(li);
      }
    });
  }

  document
    .getElementById('update-instructions-btn')
    .addEventListener('click', async () => {
      // Get selected instruction and SKU from dropdowns (first non-empty)
      const results = lastData?.results || [];
      const originalOrderNo = document
        .getElementById('originalOrderNo')
        .value.trim();
      let selectedInstruction = '';
      let selectedSku = '';
      for (let idx = 0; idx < results.length; idx++) {
        const dropdown = document.getElementById(`instructions-${idx}`);
        if (dropdown && dropdown.value) {
          selectedInstruction = dropdown.value;
          selectedSku = results[idx]['SKU'] || '';
          break;
        }
      }
      if (!originalOrderNo || !selectedInstruction || !selectedSku) {
        alert('Please search and select an instruction before updating.');
        return;
      }
      try {
        const res = await fetch('/api/returns/updateInstructions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalOrderNo,
            instructions: `${selectedSku} - ${selectedInstruction}`,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          alert('Instructions updated!');
        } else {
          alert('Update failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Update failed: ' + err.message);
      }
    });
}

function safe(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function onActionClick(e) {
  const idx = Number(e.currentTarget.getAttribute('data-idx'));
  const action = e.currentTarget.getAttribute('data-action');
  const zebraHostElem = document.getElementById('zebraHost');
  // zebraHost will be declared and used later in the function
  if (
    !lastData ||
    !Array.isArray(lastData.results) ||
    idx < 0 ||
    idx >= lastData.results.length
  ) {
    alert('Invalid item index.');
    return;
  }

  const item = { ...lastData.results[idx] };
  // Get selected instructions value from dropdown
  const dropdown = document.getElementById(`instructions-${idx}`);
  if (dropdown) {
    item['Instructions'] = dropdown.value;
  }
  const count = Number(item['Actual']) || 1;

  // Build update payload for this line
  const updatePayload = [
    {
      lineItemId: item['LineItemId'] || item['lineItemId'],
      sku: item['SKU'],
      instruction: item['Instructions'],
    },
  ];

  if (action === 'pdf') {
    const res = await fetch('/api/labels/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count }),
    });
    if (!res.ok) return alert('Failed to render PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Update instructions for this line
    await fetch('/api/labels/update-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatePayload }),
    });
  } else if (action === 'zpl') {
    const res = await fetch('/api/labels/zpl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count }),
    });
    if (!res.ok) return alert('Failed to build ZPL');
    const zpl = await res.text();
    const blob = new Blob([zpl], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    function sanitizeFilename(str) {
      return String(str).replace(/[^a-z0-9_\-\.]/gi, '_');
    }
    a.download = `label_${sanitizeFilename(item['SKU'] || 'item')}_${
      idx + 1
    }.zpl`;
    a.click();
    // Update instructions for this line
    await fetch('/api/labels/update-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatePayload }),
    });
  } else if (action === 'print-os') {
    const selectedPrinter = printerSelect.value;
    const bodyData = { item, count };
    if (selectedPrinter) {
      bodyData.printerName = selectedPrinter;
    }
    const res = await fetch('/api/labels/print-pdf-os', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    });
    const data = await res.json();
    if (!data.ok) return alert('OS print failed: ' + (data.error || 'Unknown'));
    // Update instructions for this line
    await fetch('/api/labels/update-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatePayload }),
    });
  } else if (action === 'print-ip') {
    const zebraHost = zebraHostElem.value.trim();
    if (!zebraHost) return alert('Enter Zebra IP first');
    const res = await fetch('/api/labels/print-zpl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, count, zebraHost }),
    });
    const data = await res.json();
    if (!data.ok)
      return alert('Print (IP) failed: ' + (data.error || 'Unknown'));
    // Update instructions for this line
    await fetch('/api/labels/update-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatePayload }),
    });
  }
}

// ---- "ALL" buttons (unchanged; IP batch uses Zebra RAW 9100) ----
pdfAllBtn.addEventListener('click', async () => {
  if (
    !lastData?.ok ||
    !Array.isArray(lastData.results) ||
    !lastData.results.length
  )
    return alert('Search first');
  // Build items array with current dropdown selections
  const results = lastData?.results || [];
  const itemsWithInstructions = results.map((item, idx) => {
    const dropdown = document.getElementById(`instructions-${idx}`);
    return {
      ...item,
      Instructions: dropdown ? dropdown.value : item['Instructions'] || '',
    };
  });
  const res = await fetch('/api/labels/preview-pdf-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: itemsWithInstructions }),
  });
  if (!res.ok) return alert('Failed to render batch PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Build update payload for all lines
  const updatePayload = itemsWithInstructions
    .map((item, idx) => ({
      lineItemId: item['LineItemId'] || item['lineItemId'],
      sku: item['SKU'],
      instruction: item['Instructions'],
    }))
    .filter((i) => i.instruction);
  await fetch('/api/labels/update-instructions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: updatePayload }),
  });
});

// zplAllBtn.addEventListener('click', async () => {
//   if (
//     !lastData?.ok ||
//     !Array.isArray(lastData.results) ||
//     !lastData.results.length
//   )
//     return alert('Search first');
//   const res = await fetch('/api/labels/zpl-all', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ items: lastData.results }),
//   });
//   if (!res.ok) return alert('Failed to build batch ZPL');
//   const zpl = await res.text();
//   const blob = new Blob([zpl], { type: 'text/plain' });
//   const a = document.createElement('a');
//   a.href = URL.createObjectURL(blob);
//   a.download = `labels-batch.zpl`;
//   a.click();
// });

// printAllBtn.addEventListener('click', async () => {
//   if (
//     !lastData?.ok ||
//     !Array.isArray(lastData.results) ||
//     !lastData.results.length
//   )
//     return alert('Search first');
//   const zebraHost = document.getElementById('zebraHost').value.trim();
//   if (!zebraHost) return alert('Enter Zebra IP first');
//   const res = await fetch('/api/labels/print-all', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ items: lastData.results, zebraHost }),
//   });
//   const data = await res.json();
//   if (!data.ok)
//     return alert('Batch print failed: ' + (data.error || 'Unknown'));
//   alert(`Sent ${data.total} label(s) to ${zebraHost}`);
// });

// Print All (PDF) button logic
printAllPdfBtn.addEventListener('click', async () => {
  if (
    !lastData?.ok ||
    !Array.isArray(lastData.results) ||
    !lastData.results.length
  )
    return alert('Search first');
  const res = await fetch('/api/labels/print-pdf-all-os', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: lastData.results }),
  });
  const data = await res.json();
  if (!data.ok)
    return alert('Batch print failed: ' + (data.error || 'Unknown'));
  // No confirmation alert after printing
});
