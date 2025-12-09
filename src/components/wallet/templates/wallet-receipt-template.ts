/**
 * Wallet Receipt Template for 80mm Thermal Printers
 * Generates HTML for wallet recharge receipts
 */

export interface WalletReceiptData {
  transactionNumber: string
  date: Date
  recipientName: string
  walletNumber: string
  amount: number
  fee: number
  totalCharged: number
  cardBrand: string
  cardLast4: string
  newBalance: number
  companyName?: string
  companyLogo?: string
}

const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

export function generateWalletReceiptHTML(data: WalletReceiptData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo - ${data.transactionNumber}</title>
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
      font-size: 12px;
      line-height: 1.4;
      width: 80mm;
      padding: 5mm;
      background: white;
      color: black;
    }

    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }

    .logo {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .title {
      font-size: 14px;
      font-weight: bold;
      margin: 10px 0 5px 0;
    }

    .subtitle {
      font-size: 10px;
      color: #666;
    }

    .section {
      margin: 10px 0;
      padding: 10px 0;
      border-bottom: 1px dashed #000;
    }

    .row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }

    .label {
      color: #666;
    }

    .value {
      font-weight: bold;
      text-align: right;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: bold;
      margin: 8px 0;
    }

    .success-badge {
      text-align: center;
      background: #f0f9f4;
      border: 1px solid #22c55e;
      border-radius: 4px;
      padding: 8px;
      margin: 10px 0;
    }

    .success-text {
      color: #16a34a;
      font-weight: bold;
    }

    .footer {
      text-align: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px dashed #000;
    }

    .footer-text {
      font-size: 10px;
      color: #666;
    }

    .barcode {
      text-align: center;
      margin: 10px 0;
      font-family: 'Libre Barcode 39', monospace;
      font-size: 24px;
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
    <div class="logo">LogiRapid</div>
    <div class="subtitle">Sistema de Wallet</div>
  </div>

  <div class="success-badge">
    <div class="success-text">RECARGA EXITOSA</div>
  </div>

  <div class="section">
    <div class="title">RECIBO DE RECARGA</div>

    <div class="row">
      <span class="label">Transaccion:</span>
      <span class="value">#${data.transactionNumber}</span>
    </div>

    <div class="row">
      <span class="label">Fecha:</span>
      <span class="value">${formatDate(data.date)}</span>
    </div>
  </div>

  <div class="section">
    <div class="row">
      <span class="label">Destinatario:</span>
      <span class="value">${data.recipientName}</span>
    </div>

    <div class="row">
      <span class="label">Wallet:</span>
      <span class="value">${data.walletNumber}</span>
    </div>
  </div>

  <div class="section">
    <div class="row">
      <span class="label">Monto Recargado:</span>
      <span class="value">${formatCurrency(data.amount)}</span>
    </div>

    <div class="row">
      <span class="label">Fee (3.5%):</span>
      <span class="value">${formatCurrency(data.fee)}</span>
    </div>

    <div class="divider"></div>

    <div class="total-row">
      <span>TOTAL COBRADO:</span>
      <span>${formatCurrency(data.totalCharged)}</span>
    </div>
  </div>

  <div class="section">
    <div class="row">
      <span class="label">Metodo de Pago:</span>
      <span class="value">${data.cardBrand} ****${data.cardLast4}</span>
    </div>

    <div class="row">
      <span class="label">Nuevo Balance:</span>
      <span class="value" style="color: #2563eb; font-size: 14px;">${formatCurrency(data.newBalance)}</span>
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">Gracias por usar LogiRapid</div>
    <div class="footer-text" style="margin-top: 5px;">www.logirapid.com</div>
    <div class="footer-text" style="margin-top: 10px;">Este recibo es su comprobante de pago</div>
  </div>
</body>
</html>
`
}

/**
 * Generate plain text receipt message for SMS/WhatsApp
 */
export function generateWalletReceiptText(data: WalletReceiptData): string {
  return `RECARGA EXITOSA - LogiRapid

Transaccion: #${data.transactionNumber}
Fecha: ${formatDate(data.date)}

Destinatario: ${data.recipientName}
Wallet: ${data.walletNumber}

Monto Recargado: ${formatCurrency(data.amount)}
Fee: ${formatCurrency(data.fee)}
Total Cobrado: ${formatCurrency(data.totalCharged)}

Metodo: ${data.cardBrand} ****${data.cardLast4}
Nuevo Balance: ${formatCurrency(data.newBalance)}

Gracias por usar LogiRapid!`
}
