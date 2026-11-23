/**
 * Invoice / receipt generator for AASRA.
 *
 * Produces HTML invoices that the customer can print or save as PDF.
 * Cloudflare Workers has no native PDF library, so HTML + browser print is the
 * portable approach (and print CSS targets @page for clean output).
 *
 * All amounts are integers (whole PKR). No floats.
 *
 * TAX (Pakistan): verify the applicable sales tax / GST rate and your tax
 * registration number with an accountant before launch. The defaults below are
 * placeholders and must be replaced with real values.
 */

// ---- Tax configuration (VERIFY before launch) ----
// Default 0% — replace with the actual sales-tax rate applicable to your goods.
export const TAX_RATE_PCT = Number(process.env.TAX_RATE_PCT || 0);
// Your business tax / GST registration number (shown on invoices).
const TAX_REGISTRATION_NO = process.env.TAX_REGISTRATION_NO || '';
// Business name / address shown on invoices — replace with real details.
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'AASRA';
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || '';
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'orders@aasra.shop';

/**
 * Money formatting for invoices (whole PKR).
 */
function money(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function moneyPlain(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compute tax from an amount (integer PKR, floored).
 */
export function taxAmount(amount) {
  return Math.floor((amount * TAX_RATE_PCT) / 100);
}

/**
 * Build the full HTML invoice document.
 *
 * @param {object} opts
 * @param {object} opts.order - DB order row
 * @param {object} opts.items - parsed items array [{name, sku, qty, unit_price_pkr, line_total_pkr}]
 * @param {string} opts.type - 'deposit' | 'balance' | 'final'
 * @param {object} opts.payment - the payment record for this receipt (optional)
 * @param {string} opts.baseUrl - public site URL
 * @param {string} opts.generatedAt - ISO timestamp
 * @returns {string} HTML document
 */
export function buildInvoiceHtml(opts) {
  const {
    order,
    items,
    type = 'final',
    payment,
    baseUrl = 'https://aasra.shop',
    generatedAt = new Date().toISOString(),
  } = opts;

  const subtotal = order.subtotal;
  const discount = order.discount || 0;
  const shipping = order.shipping_fee || 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const taxableAmount = subtotalAfterDiscount; // VERIFY: whether shipping is taxable
  const tax = taxAmount(taxableAmount);
  const total = order.total;

  // Payment breakdown per type
  let paidLabel, paidAmount, remainingLabel, remainingAmount, receiptTitle, docTitle;
  if (type === 'deposit') {
    docTitle = 'Deposit Receipt';
    receiptTitle = 'Deposit Receipt';
    paidLabel = 'Deposit paid';
    paidAmount = order.deposit_amount;
    remainingLabel = 'Balance due';
    remainingAmount = order.balance_amount;
  } else if (type === 'balance') {
    docTitle = 'Balance Receipt';
    receiptTitle = 'Balance Payment Receipt';
    paidLabel = 'Balance paid';
    paidAmount = order.balance_amount;
    remainingLabel = 'Amount outstanding';
    remainingAmount = 0;
  } else {
    docTitle = 'Tax Invoice';
    receiptTitle = 'Tax Invoice';
    paidLabel = 'Total paid';
    paidAmount = total;
    remainingLabel = 'Amount due';
    remainingAmount = 0;
  }

  const paymentDate = payment ? new Date(payment.updated_at).toLocaleDateString('en-PK') : '';
  const gatewayRef = payment ? (payment.tracker_token || '') : '';
  const orderDate = new Date(order.created_at).toLocaleDateString('en-PK');

  const itemsHtml = items
    .map(
      (it) => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td class="mono">${escapeHtml(it.sku)}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${moneyPlain(it.unit_price_pkr)}</td>
      <td class="num">${moneyPlain(it.line_total_pkr)}</td>
    </tr>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${receiptTitle} — ${order.id} — ${BUSINESS_NAME}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 9.5pt; color: #1a1a1a; line-height: 1.45; margin: 0;
  }
  .invoice { max-width: 740px; margin: 0 auto; padding: 0 4mm; }
  .brand {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 17pt; letter-spacing: 0.06em; margin-bottom: 2mm;
  }
  .doc-title {
    font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.16em;
    color: #666; margin-bottom: 6mm;
  }
  .header-block { display: flex; justify-content: space-between; margin-bottom: 7mm; }
  .business, .customer { flex: 1; font-size: 8.5pt; }
  .business p, .customer p { margin: 0 0 1.2mm; }
  .business .label, .customer .label {
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 7pt; color: #666;
  }
  .meta {
    display: flex; justify-content: space-between; font-size: 8.5pt; margin-bottom: 5mm;
    border-top: 0.6pt solid #000; border-bottom: 0.6pt solid #000; padding: 2mm 0;
  }
  .meta div { margin: 0.6mm 0; }
  .meta .label { color: #666; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.1em; }
  table.invoice-items { width: 100%; border-collapse: collapse; margin-bottom: 5mm; font-size: 8.5pt; }
  table.invoice-items th {
    text-align: left; border-bottom: 1pt solid #000; padding: 1.5mm 1mm; font-size: 7.5pt;
    text-transform: uppercase; letter-spacing: 0.1em; color: #666;
  }
  table.invoice-items td { border-bottom: 0.4pt solid #d9d9d9; padding: 1.5mm 1mm; vertical-align: top; }
  table.invoice-items td.num, table.invoice-items th.num { text-align: right; }
  .totals { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 8.5pt; }
  .totals td { padding: 1mm 2mm; }
  .totals .label { text-align: right; width: 52%; color: #333; }
  .totals .val { text-align: right; font-variant-numeric: tabular-nums; }
  .totals .grand td { border-top: 1pt solid #000; font-weight: 600; font-size: 9.5pt; }
  .footer {
    margin-top: 8mm; font-size: 7pt; color: #666; border-top: 0.4pt solid #d9d9d9;
    padding-top: 2mm;
  }
  .footer p { margin: 0 0 1mm; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 7.5pt; }
  .no-print { margin-top: 5mm; text-align: center; }
  .no-print button {
    font-family: inherit; font-size: 8pt; padding: 1.5mm 4mm; cursor: pointer;
    border: 0.6pt solid #1a1a1a; background: #fff; cursor: pointer;
  }
  .no-print button:hover { background: #f5f5f5; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="invoice">
    <div class="brand">${escapeHtml(BUSINESS_NAME)}</div>
    <div class="doc-title">${docTitle}</div>

    <div class="header-block">
      <div class="business">
        <div class="label">From</div>
        <p>${escapeHtml(BUSINESS_NAME)}</p>
        ${BUSINESS_ADDRESS ? `<p>${escapeHtml(BUSINESS_ADDRESS)}</p>` : ''}
        ${BUSINESS_PHONE ? `<p>${escapeHtml(BUSINESS_PHONE)}</p>` : ''}
        <p>${escapeHtml(BUSINESS_EMAIL)}</p>
        ${TAX_REGISTRATION_NO ? `<p><span class="label">Tax registration:</span> ${escapeHtml(TAX_REGISTRATION_NO)}</p>` : ''}
      </div>
      <div class="customer">
        <div class="label">Customer</div>
        <p>${escapeHtml(order.customer_name)}</p>
        <p>${escapeHtml(order.city)}, Pakistan</p>
        <p class="mono">${escapeHtml(order.email)}</p>
        <p class="mono">${maskPhone(order.phone)}</p>
      </div>
    </div>

    <div class="meta">
      <div>
        <div class="label">Invoice / Order number</div>
        <div><strong>${escapeHtml(order.id)}</strong></div>
        <div class="label">Order date</div>
        <div>${orderDate}</div>
      </div>
      <div style="text-align: right;">
        <div class="label">Document date</div>
        <div>${new Date(generatedAt).toLocaleDateString('en-PK')}</div>
        ${paymentDate ? `<div class="label">${paidLabel} date</div><div>${paymentDate}</div>` : ''}
        ${gatewayRef ? `<div class="label">Payment reference</div><div class="mono">${escapeHtml(gatewayRef)}</div>` : ''}
      </div>
    </div>

    <table class="invoice-items">
      <thead>
        <tr>
          <th style="width: 42%">Item</th>
          <th class="num" style="width: 16%">SKU</th>
          <th class="num" style="width: 10%">Qty</th>
          <th class="num" style="width: 16%">Unit price</th>
          <th class="num" style="width: 16%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <table class="totals">
      <tr><td class="label">Subtotal</td><td class="val">${moneyPlain(subtotal)}</td></tr>
      ${discount > 0 ? `<tr><td class="label">Discount</td><td class="val">- ${moneyPlain(discount)}</td></tr>` : ''}
      <tr><td class="label">Shipping</td><td class="val">${moneyPlain(shipping)}</td></tr>
      ${TAX_RATE_PCT > 0 ? `<tr><td class="label">Sales tax (${TAX_RATE_PCT}%)</td><td class="val">${moneyPlain(tax)}</td></tr>` : ''}
      <tr class="grand"><td class="label">Total ${type === 'final' ? '(incl. tax)' : ''}</td><td class="val">${moneyPlain(total)}</td></tr>
      <tr><td class="label">${paidLabel}</td><td class="val">${moneyPlain(paidAmount)}</td></tr>
      <tr><td class="label">${remainingLabel}</td><td class="val">${moneyPlain(remainingAmount)}</td></tr>
    </table>

    <div class="footer">
      <p><strong>Payment method:</strong> Online payment via hosted gateway (card data never stored by ${escapeHtml(BUSINESS_NAME)}).</p>
      <p><strong>Currency:</strong> PKR. All amounts are in whole Pakistani Rupees.</p>
      <p>This is a computer-generated document. No signature required.</p>
      <p style="margin-top:4mm;">Track this order: <a href="${baseUrl}/order-lookup">${baseUrl}/order-lookup</a></p>
    </div>

    <div class="no-print">
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Mask a phone number for display (show last 2 digits only).
 */
function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  return '••••••' + digits.slice(-2);
}

/**
 * Escape HTML to prevent XSS in invoice rendering.
 */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
