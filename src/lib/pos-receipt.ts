/**
 * POS Receipt Printing Utilities
 * Supports thermal printers (80mm) and regular printers
 */

interface ReceiptLine {
  productName: string
  quantity: number
  unitPrice: number
  originalPrice?: number
  total: number
  discount?: number
}

interface ReceiptPayment {
  method: string
  amount: number
  currency: string
}

interface ReceiptData {
  // Business info
  businessName: string
  businessAddress?: string
  businessPhone?: string
  businessRNC?: string

  // Order info
  orderNumber: string
  terminalName: string
  cashierName: string
  createdAt: Date

  // Lines
  lines: ReceiptLine[]

  // Totals
  subtotal: number
  discount: number
  tax: number
  total: number

  // Payment
  payments: ReceiptPayment[]
  amountTendered?: number
  changeAmount?: number

  // Currency
  currency: string

  // Customer
  customerName?: string

  // Footer
  footerMessage?: string
}

/**
 * Format currency amount
 * CUP is formatted as integer (no decimals) - requirement for Cuba
 */
function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    CUP: '$',
    MLC: '€'
  }
  const symbol = symbols[currency] || '$'
  // CUP must be integer (no decimals) - Cuban requirement
  if (currency === 'CUP') {
    return `${symbol}${Math.round(amount).toLocaleString('es-ES')}`
  }
  return `${symbol}${amount.toFixed(2)}`
}

/**
 * Format date for receipt
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Pad string to fixed width
 */
function padString(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  if (str.length >= width) {
    return str.substring(0, width)
  }

  const padding = width - str.length
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str
    case 'center':
      const leftPad = Math.floor(padding / 2)
      const rightPad = padding - leftPad
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad)
    default:
      return str + ' '.repeat(padding)
  }
}

/**
 * Generate receipt content for thermal printer (80mm, ~48 chars per line)
 */
export function generateThermalReceipt(data: ReceiptData): string {
  const LINE_WIDTH = 48
  const SEPARATOR = '='.repeat(LINE_WIDTH)
  const DASHED = '-'.repeat(LINE_WIDTH)

  const lines: string[] = []

  // Header
  lines.push(SEPARATOR)
  lines.push(padString(data.businessName.toUpperCase(), LINE_WIDTH, 'center'))
  if (data.businessAddress) {
    lines.push(padString(data.businessAddress, LINE_WIDTH, 'center'))
  }
  if (data.businessPhone) {
    lines.push(padString(`Tel: ${data.businessPhone}`, LINE_WIDTH, 'center'))
  }
  if (data.businessRNC) {
    lines.push(padString(`RNC: ${data.businessRNC}`, LINE_WIDTH, 'center'))
  }
  lines.push(SEPARATOR)

  // Order info
  lines.push(`Fecha: ${formatDate(data.createdAt)}`)
  lines.push(`Ticket: ${data.orderNumber}`)
  lines.push(`Terminal: ${data.terminalName}`)
  lines.push(`Cajero: ${data.cashierName}`)
  if (data.customerName) {
    lines.push(`Cliente: ${data.customerName}`)
  }
  lines.push(DASHED)

  // Products
  for (const line of data.lines) {
    // Product name (first line)
    const name = line.productName.length > LINE_WIDTH - 2
      ? line.productName.substring(0, LINE_WIDTH - 5) + '...'
      : line.productName
    lines.push(name)

    // Quantity x Price = Total (second line, indented)
    const qty = line.quantity.toString()
    const price = formatCurrency(line.unitPrice, data.currency)
    const total = formatCurrency(line.total, data.currency)
    const detail = `  ${qty} x ${price}`
    const remaining = LINE_WIDTH - detail.length - total.length
    lines.push(detail + ' '.repeat(Math.max(1, remaining)) + total)

    // Wholesale price info
    if (line.originalPrice && line.originalPrice > line.unitPrice) {
      const savings = (line.originalPrice - line.unitPrice) * line.quantity
      lines.push(`  Mayorista (antes ${formatCurrency(line.originalPrice, data.currency)}, ahorro ${formatCurrency(savings, data.currency)})`)
    }

    // Discount if any
    if (line.discount && line.discount > 0) {
      const discountStr = `  Descuento: -${formatCurrency(line.discount, data.currency)}`
      lines.push(discountStr)
    }
  }
  lines.push(DASHED)

  // Totals
  const addTotal = (label: string, amount: number, bold: boolean = false) => {
    const amountStr = formatCurrency(amount, data.currency)
    const remaining = LINE_WIDTH - label.length - amountStr.length
    lines.push(label + ' '.repeat(Math.max(1, remaining)) + amountStr)
  }

  addTotal('Subtotal:', data.subtotal)
  if (data.discount > 0) {
    addTotal('Descuento:', -data.discount)
  }
  if (data.tax > 0) {
    addTotal('Impuesto:', data.tax)
  }
  lines.push(DASHED)
  addTotal('TOTAL:', data.total, true)
  lines.push(DASHED)

  // Payments
  for (const payment of data.payments) {
    const methodNames: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
    }
    const methodName = methodNames[payment.method] || payment.method
    addTotal(`${methodName} (${payment.currency}):`, payment.amount)
  }

  if (data.amountTendered) {
    addTotal('Recibido:', data.amountTendered)
  }
  if (data.changeAmount && data.changeAmount > 0) {
    addTotal('Cambio:', data.changeAmount)
  }
  lines.push(SEPARATOR)

  // Footer
  lines.push(padString('¡Gracias por su compra!', LINE_WIDTH, 'center'))
  if (data.footerMessage) {
    lines.push(padString(data.footerMessage, LINE_WIDTH, 'center'))
  }
  lines.push(SEPARATOR)
  lines.push('') // Extra line for paper cutter

  return lines.join('\n')
}

/**
 * Generate HTML receipt for regular printing
 */
export function generateHTMLReceipt(data: ReceiptData): string {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        width: 80mm;
        padding: 10px;
        background: white;
      }
      .header { text-align: center; margin-bottom: 10px; }
      .header h1 { font-size: 16px; margin-bottom: 5px; }
      .header p { font-size: 11px; color: #666; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .divider-bold { border-top: 2px solid #000; margin: 8px 0; }
      .info { margin: 5px 0; }
      .info span { display: inline-block; }
      .line { margin: 5px 0; }
      .line-name { font-weight: bold; }
      .line-detail { display: flex; justify-content: space-between; padding-left: 10px; }
      .line-discount { color: #c00; padding-left: 10px; font-size: 11px; }
      .totals { margin-top: 10px; }
      .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
      .total-row.bold { font-weight: bold; font-size: 14px; }
      .payments { margin-top: 10px; }
      .footer { text-align: center; margin-top: 15px; font-size: 11px; }
      @media print {
        body { width: 100%; }
        @page { margin: 5mm; }
      }
    </style>
  `

  const linesHTML = data.lines.map(line => {
    const hasWholesale = line.originalPrice && line.originalPrice > line.unitPrice
    const savings = hasWholesale ? (line.originalPrice! - line.unitPrice) * line.quantity : 0
    return `
    <div class="line">
      <div class="line-name">${escapeHTML(line.productName)}</div>
      <div class="line-detail">
        <span>${line.quantity} x ${formatCurrency(line.unitPrice, data.currency)}</span>
        <span>${formatCurrency(line.total, data.currency)}</span>
      </div>
      ${hasWholesale ? `
        <div class="line-discount" style="color: #059669;">Mayorista (antes ${formatCurrency(line.originalPrice!, data.currency)}, ahorro ${formatCurrency(savings, data.currency)})</div>
      ` : ''}
      ${line.discount && line.discount > 0 ? `
        <div class="line-discount">Descuento: -${formatCurrency(line.discount, data.currency)}</div>
      ` : ''}
    </div>
  `}).join('')

  const paymentsHTML = data.payments.map(p => {
    const methodNames: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
    }
    return `
      <div class="total-row">
        <span>${methodNames[p.method] || p.method} (${p.currency}):</span>
        <span>${formatCurrency(p.amount, p.currency)}</span>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Recibo ${data.orderNumber}</title>
      ${styles}
    </head>
    <body>
      <div class="header">
        <h1>${escapeHTML(data.businessName)}</h1>
        ${data.businessAddress ? `<p>${escapeHTML(data.businessAddress)}</p>` : ''}
        ${data.businessPhone ? `<p>Tel: ${escapeHTML(data.businessPhone)}</p>` : ''}
        ${data.businessRNC ? `<p>RNC: ${escapeHTML(data.businessRNC)}</p>` : ''}
      </div>

      <div class="divider-bold"></div>

      <div class="info">
        <div><strong>Fecha:</strong> ${formatDate(data.createdAt)}</div>
        <div><strong>Ticket:</strong> ${data.orderNumber}</div>
        <div><strong>Terminal:</strong> ${escapeHTML(data.terminalName)}</div>
        <div><strong>Cajero:</strong> ${escapeHTML(data.cashierName)}</div>
        ${data.customerName ? `<div><strong>Cliente:</strong> ${escapeHTML(data.customerName)}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="lines">
        ${linesHTML}
      </div>

      <div class="divider"></div>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(data.subtotal, data.currency)}</span>
        </div>
        ${data.discount > 0 ? `
          <div class="total-row">
            <span>Descuento:</span>
            <span>-${formatCurrency(data.discount, data.currency)}</span>
          </div>
        ` : ''}
        ${data.tax > 0 ? `
          <div class="total-row">
            <span>Impuesto:</span>
            <span>${formatCurrency(data.tax, data.currency)}</span>
          </div>
        ` : ''}
        <div class="divider"></div>
        <div class="total-row bold">
          <span>TOTAL:</span>
          <span>${formatCurrency(data.total, data.currency)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="payments">
        ${paymentsHTML}
        ${data.amountTendered ? `
          <div class="total-row">
            <span>Recibido:</span>
            <span>${formatCurrency(data.amountTendered, data.currency)}</span>
          </div>
        ` : ''}
        ${data.changeAmount && data.changeAmount > 0 ? `
          <div class="total-row">
            <span>Cambio:</span>
            <span>${formatCurrency(data.changeAmount, data.currency)}</span>
          </div>
        ` : ''}
      </div>

      <div class="divider-bold"></div>

      <div style="text-align:center;margin:10px 0;">
        <canvas id="receipt-barcode"></canvas>
        <p style="font-size:10px;color:#666;margin-top:4px;">${escapeHTML(data.orderNumber)}</p>
      </div>

      <div class="footer">
        <p>¡Gracias por su compra!</p>
        ${data.footerMessage ? `<p>${escapeHTML(data.footerMessage)}</p>` : ''}
      </div>

      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>
        window.onload = function() {
          try {
            JsBarcode("#receipt-barcode", "${escapeHTML(data.orderNumber)}", {
              format: "CODE128",
              width: 1.5,
              height: 40,
              displayValue: false,
              margin: 0
            });
          } catch(e) { console.log('Barcode error:', e); }
          setTimeout(function() { window.print(); }, 200);
        }
      </script>
    </body>
    </html>
  `
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Print receipt using browser print dialog
 */
export function printReceipt(data: ReceiptData): void {
  const html = generateHTMLReceipt(data)
  const printWindow = window.open('', '_blank', 'width=400,height=600')

  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()

    // Close window after printing
    printWindow.onafterprint = () => {
      printWindow.close()
    }
  } else {
    console.error('Could not open print window')
  }
}

/**
 * Print receipt using ESC/POS commands (for direct printer connection)
 * This returns raw bytes that can be sent to a thermal printer
 */
export function generateESCPOSReceipt(data: ReceiptData): Uint8Array {
  const ESC = 0x1B
  const GS = 0x1D
  const LF = 0x0A

  const encoder = new TextEncoder()
  const commands: number[] = []

  // Initialize printer
  commands.push(ESC, 0x40) // ESC @ - Initialize

  // Center alignment
  commands.push(ESC, 0x61, 0x01) // ESC a 1 - Center

  // Bold on
  commands.push(ESC, 0x45, 0x01)

  // Business name
  commands.push(...encoder.encode(data.businessName + '\n'))

  // Bold off
  commands.push(ESC, 0x45, 0x00)

  if (data.businessAddress) {
    commands.push(...encoder.encode(data.businessAddress + '\n'))
  }
  if (data.businessPhone) {
    commands.push(...encoder.encode(`Tel: ${data.businessPhone}\n`))
  }

  // Separator
  commands.push(...encoder.encode('================================\n'))

  // Left alignment
  commands.push(ESC, 0x61, 0x00)

  // Order info
  commands.push(...encoder.encode(`Fecha: ${formatDate(data.createdAt)}\n`))
  commands.push(...encoder.encode(`Ticket: ${data.orderNumber}\n`))
  commands.push(...encoder.encode(`Cajero: ${data.cashierName}\n`))

  // Products
  commands.push(...encoder.encode('--------------------------------\n'))
  for (const line of data.lines) {
    commands.push(...encoder.encode(`${line.productName}\n`))
    commands.push(...encoder.encode(`  ${line.quantity} x ${formatCurrency(line.unitPrice)} = ${formatCurrency(line.total)}\n`))
  }

  // Total
  commands.push(...encoder.encode('--------------------------------\n'))
  commands.push(ESC, 0x45, 0x01) // Bold on
  commands.push(...encoder.encode(`TOTAL: ${formatCurrency(data.total)}\n`))
  commands.push(ESC, 0x45, 0x00) // Bold off

  // Footer
  commands.push(...encoder.encode('================================\n'))
  commands.push(ESC, 0x61, 0x01) // Center
  commands.push(...encoder.encode('Gracias por su compra!\n'))

  // Feed and cut
  commands.push(LF, LF, LF)
  commands.push(GS, 0x56, 0x00) // GS V 0 - Full cut

  return new Uint8Array(commands)
}

/**
 * Check if Web USB is supported for direct printer connection
 */
export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}
