interface QuoteEmailData {
  quoteNumber: string
  customerName: string
  totalAmount: number
  currency: string
  validUntil: string | null
  lines: Array<{
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  notes: string | null
  companyName: string
  customMessage?: string
  signatureUrl?: string
}

export function generateQuoteProposalHtml(data: QuoteEmailData): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)

  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const productsRows = data.lines.map(line => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
        ${line.productName}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: center;">
        ${line.quantity}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right;">
        ${formatCurrency(line.unitPrice)}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 600; color: #1d4ed8; text-align: right;">
        ${formatCurrency(line.subtotal)}
      </td>
    </tr>
  `).join('')

  const signatureButton = data.signatureUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.signatureUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
        Ver y Firmar Cotización
      </a>
      <p style="margin-top: 12px; font-size: 12px; color: #9ca3af;">
        Haga clic en el botón para revisar y firmar la cotización digitalmente
      </p>
    </div>
  ` : ''

  const customMessageSection = data.customMessage ? `
    <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; color: #1e40af; font-style: italic;">
        ${data.customMessage.replace(/\n/g, '<br>')}
      </p>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${data.quoteNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 1px;">
        COTIZACIÓN
      </h1>
      <p style="margin: 8px 0 0; font-size: 18px; color: #93c5fd; font-family: monospace;">
        ${data.quoteNumber}
      </p>
    </div>

    <!-- Body -->
    <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">

      <p style="font-size: 16px; color: #374151; margin: 0 0 8px;">
        Estimado/a <strong>${data.customerName}</strong>,
      </p>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.6;">
        Le enviamos nuestra cotización con los detalles de los productos y precios acordados.
        Por favor revise la información a continuación.
      </p>

      ${customMessageSection}

      <!-- Products Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">
              Producto
            </th>
            <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">
              Cant
            </th>
            <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">
              P. Unit
            </th>
            <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          ${productsRows}
        </tbody>
      </table>

      <!-- Total -->
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px 24px; border-radius: 12px; margin: 24px 0; text-align: right;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Total</p>
        <p style="margin: 4px 0 0; font-size: 28px; font-weight: 700; color: #1e3a5f;">
          ${formatCurrency(data.totalAmount)}
        </p>
      </div>

      ${data.validUntil ? `
      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 16px 0;">
        Esta cotización es válida hasta el <strong style="color: #6b7280;">${formatDate(data.validUntil)}</strong>
      </p>
      ` : ''}

      ${data.notes ? `
      <div style="background-color: #fefce8; border: 1px solid #fde68a; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #92400e;">Notas:</p>
        <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">
          ${data.notes.replace(/\n/g, '<br>')}
        </p>
      </div>
      ` : ''}

      ${signatureButton}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        Enviado por <strong>${data.companyName}</strong> a través de LogiRapid
      </p>
      <p style="font-size: 11px; color: #d1d5db; margin: 8px 0 0;">
        Este es un mensaje automático. No responda a este correo.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
