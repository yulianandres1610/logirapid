/**
 * Componente para generar etiquetas de cajas vacías
 * Diseño: 4x6 pulgadas
 * Contenido:
 * - Logo de la empresa (arriba)
 * - Código del empaque
 * - Almacén de creación
 * - Almacén de impresión
 * - Fecha/hora de creación
 * - Fecha/hora de impresión
 * - Código de barras del almacén (abajo)
 */

interface Empaque {
  id: number
  codigo: string
  warehouse_id: number
  warehouse_name: string
  created_at: string
  package_size_name?: string
  estado: string
}

interface Warehouse {
  id: number
  name: string
  code: string
  city: string
  address: string
}

interface Company {
  legalName: string
  logo?: string
  primary_color?: string
}

interface EmpaqueLabel {
  empaque: Empaque
  warehouseCreacion: Warehouse
  warehouseImpresion: Warehouse
  company: Company
  fechaImpresion: Date
}

/**
 * Genera el HTML para imprimir la etiqueta de caja vacía
 * Optimizado para impresora térmica (solo blanco y negro)
 */
export function generateEmpaqueLabel({
  empaque,
  warehouseCreacion,
  warehouseImpresion,
  company,
  fechaImpresion
}: EmpaqueLabel): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta - ${empaque.codigo}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          size: 4in 6in;
          margin: 0;
        }

        body {
          font-family: 'Arial', sans-serif;
          width: 4in;
          height: 6in;
          padding: 0.2in;
          background: white;
          color: #000000;
        }

        .label-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        /* Logo */
        .logo-section {
          width: 100%;
          text-align: center;
          margin-bottom: 0.08in;
          border-bottom: 2px solid #000000;
          padding-bottom: 0.08in;
        }

        .logo-section img {
          max-width: 100%;
          max-height: 0.7in;
          object-fit: contain;
        }

        .company-name {
          font-size: 32px;
          font-weight: bold;
          color: #000000;
          margin-top: 5px;
        }

        /* Código del empaque */
        .codigo-section {
          text-align: center;
          margin: 0.05in 0;
          padding: 0.08in 0.08in 0.05in 0.08in;
          background: white;
          border: 1px solid #000000;
          border-radius: 4px;
        }

        .codigo-label {
          font-size: 10px;
          color: #000000;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        #codigoBarcode {
          max-width: 100%;
          margin: 2px 0;
        }

        .codigo-text {
          font-size: 9px;
          color: #000000;
          font-family: 'Courier New', monospace;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Datos de almacenes */
        .warehouse-section {
          flex: 1;
          margin: 0.05in 0;
        }

        .warehouse-block {
          background: white;
          border: 1px solid #000000;
          border-radius: 4px;
          padding: 0.08in;
          margin-bottom: 0.05in;
        }

        .warehouse-title {
          font-size: 9px;
          color: #000000;
          text-transform: uppercase;
          margin-bottom: 3px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .warehouse-name {
          font-size: 12px;
          font-weight: bold;
          color: #000000;
          margin-bottom: 2px;
        }

        .warehouse-details {
          font-size: 9px;
          color: #000000;
          line-height: 1.3;
        }

        /* Fechas */
        .dates-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.05in;
          margin-bottom: 0.08in;
        }

        .date-block {
          background: white;
          padding: 6px;
          border-radius: 3px;
          border: 1px solid #000000;
        }

        .date-label {
          font-size: 8px;
          color: #000000;
          text-transform: uppercase;
          margin-bottom: 2px;
          font-weight: 600;
        }

        .date-value {
          font-size: 9px;
          font-weight: 700;
          color: #000000;
        }

        .time-value {
          font-size: 8px;
          color: #000000;
          margin-top: 1px;
        }

        /* Códigos QR de información */
        .qr-codes-section {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.04in;
          margin: 0.05in 0;
          padding: 0.06in;
          border: 1px solid #000000;
          border-radius: 3px;
        }

        .qr-item {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-container {
          width: 0.5in;
          height: 0.5in;
          margin: 0 auto 2px;
        }

        .qr-container canvas {
          width: 100% !important;
          height: 100% !important;
        }

        .qr-label {
          font-size: 7px;
          color: #000000;
          font-weight: 600;
          text-transform: uppercase;
        }

        /* Código de barras */
        .barcode-section {
          text-align: center;
          padding-top: 0.08in;
          border-top: 1px solid #000000;
          margin-top: auto;
        }

        .barcode-label {
          font-size: 8px;
          color: #000000;
          margin-bottom: 3px;
          text-transform: uppercase;
          font-weight: 600;
        }

        #warehouseBarcode {
          max-width: 100%;
        }

        .barcode-code {
          font-size: 9px;
          color: #000000;
          margin-top: 2px;
          font-family: 'Courier New', monospace;
          font-weight: 600;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .button-container {
            display: none !important;
          }
        }

        /* Botones de control */
        .button-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          gap: 10px;
          z-index: 9999;
        }

        button {
          padding: 12px 24px;
          font-size: 14px;
          cursor: pointer;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-print {
          background: #000000;
          color: white;
        }

        .btn-print:hover {
          opacity: 0.8;
          transform: translateY(-2px);
        }

        .btn-close {
          background: #666666;
          color: white;
        }

        .btn-close:hover {
          background: #444444;
        }
      </style>
    </head>
    <body>
      <div class="label-container">
        <!-- Logo de la empresa -->
        <div class="logo-section">
          ${company.logo
            ? `<img src="${company.logo}" alt="${company.legalName}">`
            : `<div class="company-name">${company.legalName}</div>`
          }
        </div>

        <!-- Código del empaque con código de barras -->
        <div class="codigo-section">
          <div class="codigo-label">Código de Empaque</div>
          <svg id="codigoBarcode"></svg>
          <div class="codigo-text">${empaque.codigo}</div>
        </div>

        <!-- Datos de almacenes -->
        <div class="warehouse-section">
          <!-- Almacén de creación -->
          <div class="warehouse-block">
            <div class="warehouse-title">ALMACEN DE CREACION</div>
            <div class="warehouse-name">${warehouseCreacion.name}</div>
            <div class="warehouse-details">
              Código: ${warehouseCreacion.code} | ${warehouseCreacion.city}
            </div>
          </div>

          <!-- Almacén de impresión -->
          <div class="warehouse-block">
            <div class="warehouse-title">ALMACEN DE IMPRESION</div>
            <div class="warehouse-name">${warehouseImpresion.name}</div>
            <div class="warehouse-details">
              Código: ${warehouseImpresion.code} | ${warehouseImpresion.city}
            </div>
          </div>
        </div>

        <!-- Códigos QR de información -->
        <div class="qr-codes-section">
          <div class="qr-item">
            <div class="qr-container" id="qr-web"></div>
            <div class="qr-label">Web</div>
          </div>
          <div class="qr-item">
            <div class="qr-container" id="qr-phone"></div>
            <div class="qr-label">Teléfono</div>
          </div>
          <div class="qr-item">
            <div class="qr-container" id="qr-address"></div>
            <div class="qr-label">Dirección</div>
          </div>
        </div>

        <!-- Fechas -->
        <div class="dates-section">
          <div class="date-block">
            <div class="date-label">Creación</div>
            <div class="date-value">${formatDate(new Date(empaque.created_at))}</div>
            <div class="time-value">${formatTime(new Date(empaque.created_at))}</div>
          </div>

          <div class="date-block">
            <div class="date-label">Impresión</div>
            <div class="date-value">${formatDate(fechaImpresion)}</div>
            <div class="time-value">${formatTime(fechaImpresion)}</div>
          </div>
        </div>

        <!-- Código de barras del almacén de impresión -->
        <div class="barcode-section">
          <div class="barcode-label">Código de Almacén</div>
          <svg id="warehouseBarcode"></svg>
          <div class="barcode-code">${warehouseImpresion.code}</div>
        </div>
      </div>

      <!-- Botones de control -->
      <div class="button-container">
        <button class="btn-print" onclick="window.print()">Imprimir</button>
        <button class="btn-close" onclick="window.close()">Cerrar</button>
      </div>

      <script>
        // Esperar a que carguen las librerías
        window.onload = function() {
          try {
            // Generar código de barras para el código del empaque
            JsBarcode("#codigoBarcode", "${empaque.codigo}", {
              format: "CODE128",
              width: 2,
              height: 60,
              displayValue: false,
              margin: 5
            });

            // Generar código de barras para el código del almacén
            JsBarcode("#warehouseBarcode", "${warehouseImpresion.code}", {
              format: "CODE128",
              width: 2,
              height: 50,
              displayValue: false,
              margin: 5
            });

            // Generar códigos QR
            new QRCode(document.getElementById("qr-web"), {
              text: "https://logirapid.com/ventas",
              width: 48,
              height: 48,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.M
            });

            new QRCode(document.getElementById("qr-phone"), {
              text: "tel:6452432403",
              width: 48,
              height: 48,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.M
            });

            new QRCode(document.getElementById("qr-address"), {
              text: "Miami, FL",
              width: 48,
              height: 48,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.M
            });

            // Auto-abrir el diálogo de impresión después de generar todos los códigos
            setTimeout(function() {
              window.print();
            }, 800);
          } catch (error) {
            console.error('Error generando códigos:', error);
          }
        };
      </script>
    </body>
    </html>
  `
}

/**
 * Formatea una fecha en formato dd/mm/yyyy
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Formatea una hora en formato HH:mm:ss
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
