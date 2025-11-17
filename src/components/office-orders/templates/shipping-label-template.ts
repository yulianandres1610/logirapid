/**
 * Template de Etiqueta de Envío 4x6 para Impresoras Térmicas
 * Optimizado para impresoras térmicas de 4 pulgadas x 6 pulgadas (101.6mm x 152.4mm)
 * Incluye generación de código de barras CODE128 y código QR
 * Tipografía: Montserrat
 */

export interface ShippingLabelData {
  companyName: string
  boxNumber: number
  totalBoxes: number
  boxCode: string
  sender: {
    name: string
    address: string
    phone: string
  }
  recipient: {
    name: string
    address: string
    phone: string
    city?: string
    state?: string
  }
  service: {
    name: string
    weight: string
    weightKg?: string
  }
  warehouse: {
    code: string
    name?: string
    city?: string
  }
  barcodeDataUrl: string
  qrCodeDataUrl?: string
  warehouseBarcodeDataUrl?: string
  printTimestamp?: string
}

/**
 * Genera el HTML completo para imprimir una etiqueta 4x6
 */
export function generateShippingLabelHTML(data: ShippingLabelData): string {
  const timestamp = data.printTimestamp || new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Etiqueta ${data.boxCode}</title>

  <!-- Google Fonts: Montserrat -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">

  <style>
    /* Configuración de página para impresoras térmicas 4x6 */
    @page {
      size: 4in 6in;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      width: 4in;
      height: 6in;
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      position: relative;
    }

    .label-container {
      width: 4in;
      height: 6in;
      padding: 0.12in;
      display: flex;
      flex-direction: column;
      background: white;
      position: relative;
    }

    /* Header de la Compañía */
    .company-header {
      text-align: center;
      color: #000;
      padding: 6px;
      margin-bottom: 2px;
      background: white;
    }

    .company-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    /* Información de Caja */
    .box-info {
      text-align: center;
      color: #000;
      padding: 5px;
      margin-bottom: 2px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.8px;
      background: white;
    }

    /* Contenedor de Direcciones + QR (Dos columnas) */
    .address-qr-container {
      display: flex;
      gap: 6px;
      margin-bottom: 2px;
      background: white;
      padding: 5px 6px;
    }

    .addresses-column {
      flex: 0 0 70%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .qr-column {
      flex: 0 0 calc(30% - 6px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .qr-column-image {
      width: 0.9in;
      height: 0.9in;
      display: block;
      margin-bottom: 2px;
    }

    .qr-column-label {
      font-size: 8px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      text-align: center;
    }

    /* Secciones de Remitente y Destinatario */
    .address-section {
      padding: 4px 0;
      background: white;
    }

    .section-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }

    .section-content {
      font-size: 11px;
      line-height: 1.2;
    }

    .name {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 1px;
    }

    .address {
      margin: 1px 0;
      max-height: 0.4in;
      overflow: hidden;
      word-wrap: break-word;
    }

    .phone {
      font-size: 10px;
      margin-top: 1px;
    }

    /* Provincia/Municipio Grande */
    .location-section {
      text-align: center;
      padding: 8px 6px;
      margin-bottom: 2px;
      background: white;
    }

    .location-city {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      line-height: 1;
      color: #000;
    }

    .location-state {
      font-size: 12px;
      font-weight: 600;
      margin-top: 2px;
      color: #000;
    }

    /* Información de Servicio */
    .service-info {
      background: white;
      padding: 4px 6px;
      margin-bottom: 0;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .service-info strong {
      font-weight: 700;
    }

    .service-name {
      flex: 1 1 100%;
      margin-bottom: 3px;
      font-size: 12px;
    }

    .service-weight {
      flex: 1 1 100%;
      font-size: 12px;
      font-weight: 700;
    }

    /* Sección de Códigos de Barra Apilados */
    .barcodes-section {
      margin-top: auto;
      padding: 3px 6px;
      text-align: center;
      background: white;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .barcode-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .barcode-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1px;
    }

    .barcode-image {
      width: 100%;
      max-width: 2.5in;
      height: auto;
      display: block;
      margin: 0 auto;
    }

    .barcode-label {
      font-size: 11px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      margin-top: 1px;
    }

    /* Metadata de Impresión */
    .print-metadata {
      font-size: 8px;
      text-align: center;
      padding: 3px;
      color: #666;
      margin-top: 2px;
      font-weight: 400;
      background: white;
    }

    /* Optimizaciones para impresión */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .label-container {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="label-container">
    <!-- Header de Compañía -->
    <div class="company-header">
      <div class="company-name">${data.companyName}</div>
    </div>

    <!-- Información de Caja -->
    <div class="box-info">
      CAJA ${data.boxNumber} DE ${data.totalBoxes}
    </div>

    <!-- Direcciones + QR Code (Dos columnas) -->
    <div class="address-qr-container">
      <!-- Columna de Direcciones (70%) -->
      <div class="addresses-column">
        <!-- Remitente -->
        <div class="address-section">
          <div class="section-title">DE (REMITENTE):</div>
          <div class="section-content">
            <div class="name">${data.sender.name}</div>
            <div class="address">${data.sender.address.replace(/\n/g, '<br>')}</div>
            <div class="phone">Tel: ${data.sender.phone}</div>
          </div>
        </div>

        <!-- Destinatario -->
        <div class="address-section">
          <div class="section-title">PARA (DESTINATARIO):</div>
          <div class="section-content">
            <div class="name">${data.recipient.name}</div>
            <div class="address">${data.recipient.address.replace(/\n/g, '<br>')}</div>
            ${data.recipient.phone ? `<div class="phone">Tel: ${data.recipient.phone}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Columna de QR Code (30%) -->
      ${data.qrCodeDataUrl ? `
      <div class="qr-column">
        <img src="${data.qrCodeDataUrl}" alt="QR Code" class="qr-column-image" />
        <div class="qr-column-label">SCAN</div>
      </div>
      ` : ''}
    </div>

    <!-- Provincia/Municipio -->
    ${(data.recipient.city || data.recipient.state) ? `
    <div class="location-section">
      ${data.recipient.city ? `<div class="location-city">${data.recipient.city}</div>` : ''}
      ${data.recipient.state ? `<div class="location-state">${data.recipient.state}</div>` : ''}
    </div>
    ` : ''}

    <!-- Información de Servicio con peso en lb y kg -->
    <div class="service-info">
      <div class="service-name"><strong>Servicio:</strong> ${data.service.name}</div>
      <div class="service-weight">
        <strong>Peso:</strong> ${data.service.weight}${data.service.weightKg ? ` (${data.service.weightKg})` : ''}
      </div>
    </div>

    <!-- Códigos de Barra Apilados (Almacén + Empaque) -->
    <div class="barcodes-section">
      <!-- Código de Almacén (Arriba) -->
      ${data.warehouseBarcodeDataUrl ? `
      <div class="barcode-item">
        <div class="barcode-title">ALMACÉN</div>
        <img src="${data.warehouseBarcodeDataUrl}" alt="Warehouse Barcode" class="barcode-image" />
        <div class="barcode-label">${data.warehouse.code}</div>
      </div>
      ` : ''}

      <!-- Código de Empaque (Abajo) -->
      <div class="barcode-item">
        <div class="barcode-title">CÓDIGO DE EMPAQUE</div>
        <img src="${data.barcodeDataUrl}" alt="Tracking Barcode" class="barcode-image" />
        <div class="barcode-label">${data.boxCode}</div>
      </div>
    </div>

    <!-- Timestamp de impresión -->
    <div class="print-metadata">
      Impreso: ${timestamp}
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
 * Genera una vista previa de la etiqueta (sin auto-print)
 */
export function generateShippingLabelPreviewHTML(data: ShippingLabelData): string {
  const html = generateShippingLabelHTML(data)
  // Remover el script de auto-print para la vista previa
  return html.replace(/<script>[\s\S]*?<\/script>/g, '')
}
