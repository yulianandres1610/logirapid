/**
 * Componente para generar etiquetas de cajas vacías
 * Diseño: 4x6 pulgadas
 * Contenido:
 * - Logo de la empresa (arriba)
 * - Código del empaque con código de barras
 * - Sección promocional grande: "Puede llamarnos para recogida y entregas"
 * - Footer: Fechas de creación/impresión y marca de agua
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
  phone?: string
  customerServicePhone?: string
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
          font-size: 38px;
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

        /* Sección promocional de atención al cliente */
        .customer-service-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 0.2in 0.12in;
          background: white;
          border: 2px solid #000000;
          border-radius: 8px;
          margin: 0.1in 0;
        }

        .service-header {
          font-size: 16px;
          font-weight: 800;
          color: #000000;
          margin-bottom: 10px;
          letter-spacing: 0.8px;
          line-height: 1.3;
          max-width: 3.2in;
        }

        .service-phone {
          font-size: 28px;
          font-weight: 900;
          color: #000000;
          margin: 8px 0;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }

        /* Footer con fechas y marca de agua */
        .label-footer {
          border-top: 1px solid #000000;
          padding: 0.08in 0;
          margin-top: auto;
        }

        .footer-dates {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 8px;
          color: #000000;
        }

        .footer-date-item {
          display: flex;
          flex-direction: column;
        }

        .footer-date-label {
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 1px;
        }

        .footer-date-value {
          font-weight: 400;
        }

        .footer-watermark {
          text-align: center;
          font-size: 7px;
          color: #666666;
          font-weight: 600;
          margin-top: 4px;
          letter-spacing: 0.3px;
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

        <!-- Sección promocional de atención al cliente -->
        <div class="customer-service-section">
          <div class="service-header">Puede Llamarnos Para Solicitar<br>Entregas de Cajas Vacias o<br>Recogidas de sus cajas Llenas</div>
          <div class="service-phone">${company.customerServicePhone || company.phone || '6452432403'}</div>
        </div>

        <!-- Footer con fechas y marca de agua -->
        <div class="label-footer">
          <div class="footer-dates">
            <div class="footer-date-item">
              <div class="footer-date-label">Creación:</div>
              <div class="footer-date-value">${formatDate(new Date(empaque.created_at))} ${formatTime(new Date(empaque.created_at))}</div>
            </div>
            <div class="footer-date-item">
              <div class="footer-date-label">Impresión:</div>
              <div class="footer-date-value">${formatDate(fechaImpresion)} ${formatTime(fechaImpresion)}</div>
            </div>
          </div>
          <div class="footer-watermark">${company.legalName} - Todos los derechos reservados</div>
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
