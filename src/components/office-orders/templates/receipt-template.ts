/**
 * Template de Recibo Térmico POS 80mm
 * Diseño moderno para impresoras térmicas de 80mm
 * Tipografía: Monospace para números, Sans-serif para texto
 */

export interface ReceiptData {
  companyName: string
  orderNumber: string
  timestamp: string
  sender: {
    name: string
    phone: string
  }
  recipient: {
    name: string
    phone: string
    city?: string
    state?: string
  }
  services: Array<{
    name: string
    quantity: number
    price: number
  }>
  payments: Array<{
    method: string
    amount: number
  }>
  subtotal: number
  total: number
  paid: number
  change?: number
  remaining?: number
}

/**
 * Genera el HTML completo para imprimir un recibo térmico 80mm
 */
export function generateReceiptHTML(data: ReceiptData): string {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const servicesHTML = data.services.map(service => `
    <div class="service-item">
      <div class="service-name">${service.name}</div>
      <div class="service-qty-price">
        <span>${service.quantity}x</span>
        <span class="service-price">${formatCurrency(service.price)}</span>
      </div>
    </div>
  `).join('')

  const paymentsHTML = data.payments.map(payment => `
    <div class="payment-item">
      <span>${payment.method}</span>
      <span class="payment-amount">${formatCurrency(payment.amount)}</span>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo ${data.orderNumber}</title>

  <style>
    /* Configuración de página para impresoras térmicas 80mm */
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      width: 80mm;
      margin: 0;
      padding: 10mm 5mm;
      background: white;
      color: black;
      font-size: 11px;
      line-height: 1.4;
    }

    .receipt-container {
      width: 100%;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 2px dashed #000;
    }

    .company-name {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }

    .order-number {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .timestamp {
      font-size: 10px;
      color: #333;
    }

    /* Info Section */
    .info-section {
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px dashed #666;
    }

    .info-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 2px;
    }

    .info-value {
      font-size: 11px;
      margin-bottom: 4px;
    }

    /* Services Section */
    .services-section {
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 2px solid #000;
    }

    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
      text-align: center;
      letter-spacing: 0.5px;
    }

    .service-item {
      margin-bottom: 6px;
    }

    .service-name {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .service-qty-price {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
    }

    .service-price {
      font-family: 'Courier New', monospace;
      font-weight: 700;
    }

    /* Payments Section */
    .payments-section {
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px dashed #666;
    }

    .payment-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 10px;
    }

    .payment-amount {
      font-family: 'Courier New', monospace;
      font-weight: 600;
    }

    /* Totals Section */
    .totals-section {
      margin: 8px 0;
      padding: 8px 0;
    }

    .total-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .total-label {
      font-weight: 600;
    }

    .total-value {
      font-family: 'Courier New', monospace;
      font-weight: 700;
    }

    .grand-total {
      border-top: 2px solid #000;
      padding-top: 6px;
      margin-top: 6px;
    }

    .grand-total .total-label {
      font-size: 13px;
      font-weight: 800;
    }

    .grand-total .total-value {
      font-size: 14px;
    }

    .change {
      background: #000;
      color: #fff;
      padding: 6px;
      margin-top: 6px;
      border-radius: 4px;
    }

    .change .total-label {
      font-size: 12px;
    }

    .change .total-value {
      font-size: 14px;
    }

    .remaining {
      background: #f44336;
      color: #fff;
      padding: 6px;
      margin-top: 6px;
      border-radius: 4px;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 2px dashed #000;
      font-size: 10px;
    }

    .footer-message {
      margin-bottom: 4px;
      font-weight: 600;
    }

    .footer-note {
      font-size: 9px;
      color: #666;
    }

    /* Optimizaciones para impresión */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="header">
      <div class="company-name">${data.companyName}</div>
      <div class="order-number">Orden: ${data.orderNumber}</div>
      <div class="timestamp">${data.timestamp}</div>
    </div>

    <!-- Sender Info -->
    <div class="info-section">
      <div class="info-label">De (Remitente):</div>
      <div class="info-value">${data.sender.name}</div>
      <div class="info-value">${data.sender.phone}</div>
    </div>

    <!-- Recipient Info -->
    <div class="info-section">
      <div class="info-label">Para (Destinatario):</div>
      <div class="info-value">${data.recipient.name}</div>
      ${data.recipient.phone ? `<div class="info-value">${data.recipient.phone}</div>` : ''}
      ${data.recipient.city || data.recipient.state ? `
        <div class="info-value">${[data.recipient.city, data.recipient.state].filter(Boolean).join(', ')}</div>
      ` : ''}
    </div>

    <!-- Services -->
    <div class="services-section">
      <div class="section-title">Servicios</div>
      ${servicesHTML}
    </div>

    <!-- Payments -->
    ${data.payments.length > 0 ? `
    <div class="payments-section">
      <div class="section-title">Pagos Recibidos</div>
      ${paymentsHTML}
    </div>
    ` : ''}

    <!-- Totals -->
    <div class="totals-section">
      <div class="total-item">
        <span class="total-label">Subtotal:</span>
        <span class="total-value">${formatCurrency(data.subtotal)}</span>
      </div>

      <div class="total-item grand-total">
        <span class="total-label">TOTAL:</span>
        <span class="total-value">${formatCurrency(data.total)}</span>
      </div>

      <div class="total-item">
        <span class="total-label">Pagado:</span>
        <span class="total-value">${formatCurrency(data.paid)}</span>
      </div>

      ${data.change && data.change > 0 ? `
      <div class="total-item change">
        <span class="total-label">Cambio:</span>
        <span class="total-value">${formatCurrency(data.change)}</span>
      </div>
      ` : ''}

      ${data.remaining && data.remaining > 0 ? `
      <div class="total-item remaining">
        <span class="total-label">Restante:</span>
        <span class="total-value">${formatCurrency(data.remaining)}</span>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">¡Gracias por su preferencia!</div>
      <div class="footer-note">Conserve este recibo como comprobante</div>
    </div>
  </div>

  <script>
    // Auto-imprimir cuando se carga la página
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>
  `.trim()
}

/**
 * Genera una vista previa del recibo (sin auto-print)
 */
export function generateReceiptPreviewHTML(data: ReceiptData): string {
  const html = generateReceiptHTML(data)
  // Remover el script de auto-print para la vista previa
  return html.replace(/<script>[\s\S]*?<\/script>/g, '')
}
