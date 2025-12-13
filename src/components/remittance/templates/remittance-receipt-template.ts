/**
 * Remittance Receipt Template for 80mm Thermal Printers
 * Generates HTML for family coupon / remittance receipts
 */

export interface RemittanceReceiptData {
  orderNumber: string
  date: Date
  // Sender info
  senderName: string
  senderPhone: string
  // Recipient info
  recipientName: string
  recipientPhone: string
  recipientIdNumber?: string
  recipientAddress: string
  recipientMunicipality: string
  recipientProvince: string
  // Amounts
  sendAmount: number
  sendCurrency: string
  receiveAmount: number
  receiveCurrency: string
  serviceFee: number
  deliveryFee: number
  totalCharged: number
  // Delivery
  estimatedDelivery: string
  serviceType: string // 'usd_cash', 'cup_cash', 'mlc_card'
  // Payment
  paymentMethod: string
  paymentReference?: string
  // Company
  companyName?: string
  companyLogo?: string
  sellingCompanyName?: string
}

const formatCurrency = (amount: number, currency?: string): string => {
  if (currency === 'CUP') {
    return `${amount.toLocaleString('en-US')} CUP`
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getServiceLabel = (serviceType: string): string => {
  const labels: Record<string, string> = {
    'usd_cash': 'USD Efectivo',
    'cup_cash': 'CUP Efectivo',
    'mlc_card': 'MLC Tarjeta',
    'eur_cash': 'EUR Efectivo'
  }
  return labels[serviceType] || serviceType
}

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    'cash': 'Efectivo',
    'zelle': 'Zelle',
    'card': 'Tarjeta',
    'transfer': 'Transferencia'
  }
  return labels[method] || method
}

export function generateRemittanceReceiptHTML(data: RemittanceReceiptData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo Remesa - ${data.orderNumber}</title>
  <style>
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
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.3;
      width: 80mm;
      padding: 4mm;
      background: white;
      color: black;
    }

    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .logo {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 3px;
    }

    .subtitle {
      font-size: 10px;
      color: #555;
    }

    .company-name {
      font-size: 9px;
      color: #666;
      margin-top: 3px;
    }

    .title {
      font-size: 12px;
      font-weight: bold;
      margin: 8px 0 5px 0;
      text-transform: uppercase;
    }

    .order-badge {
      text-align: center;
      background: #000;
      color: #fff;
      padding: 6px;
      margin: 8px 0;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
    }

    .section {
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px dashed #000;
    }

    .section-title {
      font-size: 10px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
      text-transform: uppercase;
      border-bottom: 1px solid #ccc;
      padding-bottom: 2px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }

    .label {
      color: #555;
      flex: 1;
    }

    .value {
      font-weight: bold;
      text-align: right;
      flex: 1;
    }

    .value-full {
      font-weight: bold;
      margin-top: 2px;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: bold;
      margin: 6px 0;
      background: #f5f5f5;
      padding: 5px;
    }

    .receive-amount {
      text-align: center;
      background: #e8f5e9;
      border: 2px solid #4caf50;
      padding: 10px;
      margin: 10px 0;
    }

    .receive-label {
      font-size: 10px;
      color: #2e7d32;
    }

    .receive-value {
      font-size: 18px;
      font-weight: bold;
      color: #1b5e20;
    }

    .delivery-badge {
      text-align: center;
      background: #fff3e0;
      border: 1px solid #ff9800;
      padding: 6px;
      margin: 8px 0;
    }

    .delivery-text {
      color: #e65100;
      font-weight: bold;
      font-size: 11px;
    }

    .address-box {
      background: #fafafa;
      padding: 6px;
      margin: 5px 0;
      border-left: 3px solid #666;
    }

    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 2px dashed #000;
    }

    .footer-text {
      font-size: 9px;
      color: #666;
      margin: 2px 0;
    }

    .qr-placeholder {
      text-align: center;
      margin: 10px 0;
      padding: 15px;
      border: 1px dashed #ccc;
    }

    .important-note {
      background: #ffebee;
      border: 1px solid #f44336;
      padding: 5px;
      margin: 8px 0;
      font-size: 9px;
      text-align: center;
      color: #c62828;
    }

    @media print {
      body {
        width: 80mm;
        padding: 2mm;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${data.companyName || 'LogiRapid'}</div>
    <div class="subtitle">CUPON FAMILIAR / REMESA</div>
    ${data.sellingCompanyName ? `<div class="company-name">Vendido por: ${data.sellingCompanyName}</div>` : ''}
  </div>

  <div class="order-badge">
    ${data.orderNumber}
  </div>

  <div class="row">
    <span class="label">Fecha:</span>
    <span class="value">${formatDate(data.date)}</span>
  </div>
  <div class="row">
    <span class="label">Servicio:</span>
    <span class="value">${getServiceLabel(data.serviceType)}</span>
  </div>

  <div class="section">
    <div class="section-title">REMITENTE (Quien Envia)</div>
    <div class="row">
      <span class="label">Nombre:</span>
      <span class="value">${data.senderName}</span>
    </div>
    <div class="row">
      <span class="label">Telefono:</span>
      <span class="value">${data.senderPhone}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">DESTINATARIO (Recibe en Cuba)</div>
    <div class="row">
      <span class="label">Nombre:</span>
      <span class="value">${data.recipientName}</span>
    </div>
    <div class="row">
      <span class="label">Telefono:</span>
      <span class="value">${data.recipientPhone}</span>
    </div>
    ${data.recipientIdNumber ? `
    <div class="row">
      <span class="label">CI:</span>
      <span class="value">${data.recipientIdNumber}</span>
    </div>
    ` : ''}
    <div class="address-box">
      <div class="value-full">${data.recipientAddress}</div>
      <div style="margin-top: 3px;">${data.recipientMunicipality}, ${data.recipientProvince}</div>
    </div>
  </div>

  <div class="receive-amount">
    <div class="receive-label">EL DESTINATARIO RECIBIRA</div>
    <div class="receive-value">${formatCurrency(data.receiveAmount, data.receiveCurrency)}</div>
  </div>

  <div class="delivery-badge">
    <div class="delivery-text">ENTREGA ESTIMADA: ${data.estimatedDelivery}</div>
  </div>

  <div class="section">
    <div class="section-title">DESGLOSE DE PAGO</div>
    <div class="row">
      <span class="label">Monto enviado:</span>
      <span class="value">${formatCurrency(data.sendAmount, data.sendCurrency)}</span>
    </div>
    ${data.serviceFee > 0 ? `
    <div class="row">
      <span class="label">Comision servicio:</span>
      <span class="value">${formatCurrency(data.serviceFee, data.sendCurrency)}</span>
    </div>
    ` : ''}
    ${data.deliveryFee > 0 ? `
    <div class="row">
      <span class="label">Entrega domicilio:</span>
      <span class="value">${formatCurrency(data.deliveryFee, data.sendCurrency)}</span>
    </div>
    ` : ''}
    <div class="divider"></div>
    <div class="total-row">
      <span>TOTAL COBRADO:</span>
      <span>${formatCurrency(data.totalCharged, data.sendCurrency)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">METODO DE PAGO</div>
    <div class="row">
      <span class="label">Forma:</span>
      <span class="value">${getPaymentMethodLabel(data.paymentMethod)}</span>
    </div>
    ${data.paymentReference ? `
    <div class="row">
      <span class="label">Referencia:</span>
      <span class="value">${data.paymentReference}</span>
    </div>
    ` : ''}
  </div>

  <div class="important-note">
    CONSERVE ESTE RECIBO COMO COMPROBANTE DE SU TRANSACCION
  </div>

  <div class="footer">
    <div class="footer-text">Gracias por usar nuestro servicio</div>
    <div class="footer-text">${data.companyName || 'LogiRapid'} - Cupones Familiares</div>
    <div class="footer-text" style="margin-top: 8px;">Para consultas: contacto@logirapid.com</div>
    <div class="footer-text">Orden: ${data.orderNumber}</div>
  </div>
</body>
</html>
`
}

/**
 * Generate plain text receipt message for SMS
 */
export function generateRemittanceSMSText(data: RemittanceReceiptData): string {
  return `CUPON FAMILIAR ${data.orderNumber}

Enviado por: ${data.senderName}
Para: ${data.recipientName}
Monto: ${formatCurrency(data.receiveAmount, data.receiveCurrency)}
Ubicacion: ${data.recipientMunicipality}, ${data.recipientProvince}
Entrega: ${data.estimatedDelivery}

Total cobrado: ${formatCurrency(data.totalCharged, data.sendCurrency)}

Gracias por usar ${data.companyName || 'LogiRapid'}!`
}

/**
 * Generate WhatsApp message
 */
export function generateRemittanceWhatsAppText(data: RemittanceReceiptData): string {
  return `*CUPON FAMILIAR - ${data.orderNumber}*

*Remitente:*
${data.senderName}
${data.senderPhone}

*Destinatario:*
${data.recipientName}
${data.recipientPhone}
${data.recipientAddress}
${data.recipientMunicipality}, ${data.recipientProvince}

*Monto a recibir:* ${formatCurrency(data.receiveAmount, data.receiveCurrency)}
*Entrega estimada:* ${data.estimatedDelivery}

*Desglose:*
Enviado: ${formatCurrency(data.sendAmount, data.sendCurrency)}
${data.serviceFee > 0 ? `Comision: ${formatCurrency(data.serviceFee, data.sendCurrency)}` : ''}
${data.deliveryFee > 0 ? `Delivery: ${formatCurrency(data.deliveryFee, data.sendCurrency)}` : ''}
*TOTAL: ${formatCurrency(data.totalCharged, data.sendCurrency)}*

Pago: ${getPaymentMethodLabel(data.paymentMethod)}${data.paymentReference ? ` (${data.paymentReference})` : ''}

Gracias por usar ${data.companyName || 'LogiRapid'}!`
}

/**
 * Print receipt using browser print dialog
 */
export function printRemittanceReceipt(data: RemittanceReceiptData): void {
  const html = generateRemittanceReceiptHTML(data)
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}
