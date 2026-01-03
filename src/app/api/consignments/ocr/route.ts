import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'

// API Key para Gemini
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo para OCR de documentos/facturas (soporta PDFs e imágenes)
const OCR_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/consignments/ocr
 * Extract product data from a supplier invoice for consignment using Gemini Vision
 * Supports: JPG, PNG, WebP, PDF
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const body = await request.json()
    const { fileBase64, mimeType: providedMimeType, userContext } = body

    // Soporte para el parámetro anterior (imageBase64) para compatibilidad
    const base64Input = fileBase64 || body.imageBase64

    if (!base64Input) {
      return NextResponse.json({
        success: false,
        error: 'Archivo requerido (imagen o PDF)'
      }, { status: 400 })
    }

    // Initialize Gemini
    if (!GOOGLE_AI_API_KEY) {
      console.error('[Consignment OCR] GOOGLE_AI_API_KEY not configured')
      return NextResponse.json({
        success: false,
        error: 'API de IA no configurada. Configure GOOGLE_AI_API_KEY en las variables de entorno.'
      }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: OCR_MODEL })

    // Prepare file data - extract base64 and detect mimeType
    const base64Data = base64Input.includes(',')
      ? base64Input.split(',')[1]
      : base64Input

    // Detect mimeType from data URL or use provided
    let mimeType = providedMimeType
    if (!mimeType && base64Input.includes('data:')) {
      mimeType = base64Input.split(';')[0].split(':')[1]
    }
    if (!mimeType) {
      mimeType = 'image/jpeg' // Default fallback
    }

    const isPdf = mimeType === 'application/pdf'
    console.log('[Consignment OCR] Processing file:', { mimeType, isPdf, model: OCR_MODEL, hasContext: !!userContext })

    // Construir el prompt con contexto del usuario si existe
    const contextSection = userContext
      ? `\n\n=== CONTEXTO ADICIONAL DEL USUARIO ===\n${userContext}\n\nIMPORTANTE: Usa este contexto para interpretar mejor los productos. Por ejemplo, si el usuario indica que ciertos items son variantes del mismo producto, agrúpalos usando el campo "isVariantOf".`
      : ''

    const prompt = `Eres un experto en OCR de facturas de CONSIGNACIÓN. Analiza este documento y extrae TODOS los productos/items de forma precisa.

NOTA: Una consignación es cuando el proveedor entrega productos que se pagan DESPUÉS de venderse, no al momento de la entrega.
${contextSection}

=== INSTRUCCIONES DE EXTRACCIÓN ===

MÚLTIPLES FACTURAS: Si el documento contiene VARIAS facturas (común en PDFs), extráelas TODAS en el array "invoices". Si solo hay una factura, el array tendrá un solo elemento.

PARA CADA FACTURA extrae:
1. PROVEEDOR/CONSIGNADOR: Nombre completo del proveedor que entrega los productos en consignación
2. NÚMERO DE FACTURA: Número, código o referencia del documento (ej: CON-001, FAC-2025-001, #12345, NCF)
3. FECHA: Fecha del documento en formato YYYY-MM-DD (busca "Fecha:", "Date:", día/mes/año)
4. PRODUCTOS: Un array con CADA línea de producto. Busca tablas, listas o secciones con items.

PARA CADA PRODUCTO/LÍNEA extrae:
- name: Nombre COMPLETO del producto exactamente como aparece (incluye marca, tamaño, sabor si aplica)
- quantity: Cantidad numérica de productos entregados en consignación (puede ser decimal como 1.5, 0.5)
- unit: Unidad de medida si aparece (UND, CAJA, KG, LB, LT, PAQ, DOC, null si no está)
- unitCost: Precio unitario de costo que pagaremos al vender
- totalCost: Total de esa línea (generalmente quantity × unitCost)
- sku: Código SKU/código interno si aparece (null si no)
- barcode: Código de barras/EAN/UPC si aparece, típicamente 8-14 dígitos (null si no)
- description: Información adicional como presentación, peso, tamaño (null si no hay)
- isVariantOf: Si el contexto indica que es variante de otro producto, el nombre del padre (null si no aplica)

TOTALES DE LA FACTURA:
- subtotal: Suma antes de impuestos (valor de los productos en consignación)
- tax: Monto del impuesto (IVA, ITBIS, IGV, etc.) - usar 0 si no hay impuesto visible
- total: Total final del documento

=== TÉCNICAS DE DETECCIÓN ===

BUSCA PATRONES DE TABLA:
- Columnas típicas: Código | Descripción | Cant | Precio | Total
- Alternativas: Item | Producto | Qty | Unit Price | Amount
- Las facturas pueden tener líneas separadas por guiones, puntos o espacios

IDENTIFICADORES COMUNES:
- SKU: Códigos alfanuméricos cortos (ABC-123, PRD001, 7890)
- Barcode/EAN: Secuencias numéricas largas (7891234567890, 012345678905)
- Cantidades: Números seguidos de unidades (10 UND, 5 CAJAS, 2.5 KG)

PRECIOS:
- Busca símbolos de moneda: $, RD$, €, ₱
- Formato con decimales: 1,500.00 o 1.500,00
- Distingue precio unitario vs total de línea por contexto

=== FORMATO DE RESPUESTA JSON ===

{
  "invoices": [
    {
      "vendorName": "Nombre del Consignador S.A.",
      "invoiceNumber": "CON-2025-001234",
      "invoiceDate": "2025-01-03",
      "items": [
        {
          "name": "Coca Cola 2 Litros",
          "quantity": 24,
          "unit": "UND",
          "unitCost": 1.50,
          "totalCost": 36.00,
          "sku": "COC-2L",
          "barcode": "7891234567890",
          "description": "Botella PET",
          "isVariantOf": null
        }
      ],
      "subtotal": 100.00,
      "tax": 18.00,
      "total": 118.00
    }
  ],
  "totalInvoices": 1,
  "confidence": 0.95
}

=== REGLAS IMPORTANTES ===

1. Extrae ABSOLUTAMENTE TODOS los productos que veas, no omitas ninguno
2. Los montos deben ser NÚMEROS sin símbolos de moneda
3. Si quantity no es claro, usa 1 como valor por defecto
4. Si unitCost no es claro pero tienes totalCost y quantity, calcula: unitCost = totalCost / quantity
5. El campo "confidence" (0 a 1) indica qué tan seguro estás de la extracción general
6. Usa null para campos string no encontrados, 0 para números no encontrados

RESPONDE ÚNICAMENTE CON EL JSON, sin texto adicional, sin markdown, sin explicaciones.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      }
    ])

    const response = await result.response
    let text = response.text()

    // Clean up the response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    console.log('[Consignment OCR] Raw response:', text.substring(0, 500) + '...')

    try {
      const extractedData = JSON.parse(text)

      // Helper para procesar items de una factura
      const processItems = (rawItems: unknown[], invoiceIndex: number) => {
        if (!Array.isArray(rawItems)) return []

        return rawItems.map((item: {
          name?: string
          quantity?: number
          unit?: string | null
          unitCost?: number
          totalCost?: number
          sku?: string | null
          barcode?: string | null
          description?: string | null
          isVariantOf?: string | null
        }, itemIndex: number) => {
          const quantity = typeof item.quantity === 'number' ? item.quantity : 1
          const unitCost = typeof item.unitCost === 'number' ? item.unitCost : 0
          const totalCost = typeof item.totalCost === 'number' ? item.totalCost : quantity * unitCost

          return {
            id: `inv-${invoiceIndex}-item-${itemIndex}`,
            name: item.name || 'Producto sin nombre',
            quantity,
            unit: item.unit || null,
            unitCost,
            totalCost,
            sku: item.sku || null,
            barcode: item.barcode || null,
            description: item.description || null,
            isVariantOf: item.isVariantOf || null
          }
        })
      }

      // Manejar formato nuevo (múltiples facturas) o formato antiguo (factura única)
      let invoices: Array<{
        vendorName: string | null
        invoiceNumber: string | null
        invoiceDate: string | null
        items: ReturnType<typeof processItems>
        subtotal: number
        tax: number
        total: number
      }> = []

      if (Array.isArray(extractedData.invoices)) {
        // Nuevo formato: múltiples facturas
        invoices = extractedData.invoices.map((inv: {
          vendorName?: string
          invoiceNumber?: string
          invoiceDate?: string
          date?: string
          items?: unknown[]
          subtotal?: number
          tax?: number
          total?: number
        }, invIndex: number) => ({
          vendorName: inv.vendorName || null,
          invoiceNumber: inv.invoiceNumber || null,
          invoiceDate: inv.invoiceDate || inv.date || null,
          items: processItems(inv.items || [], invIndex),
          subtotal: typeof inv.subtotal === 'number' ? inv.subtotal : 0,
          tax: typeof inv.tax === 'number' ? inv.tax : 0,
          total: typeof inv.total === 'number' ? inv.total : 0
        }))
      } else {
        // Formato antiguo: factura única
        const items = processItems(extractedData.items || [], 0)

        // Si no hay items pero hay un total, crear un item genérico
        if (items.length === 0 && extractedData.total) {
          items.push({
            id: 'inv-0-item-0',
            name: 'Producto general',
            quantity: 1,
            unit: null,
            unitCost: extractedData.total,
            totalCost: extractedData.total,
            sku: null,
            barcode: null,
            description: null,
            isVariantOf: null
          })
        }

        invoices = [{
          vendorName: extractedData.vendorName || null,
          invoiceNumber: extractedData.invoiceNumber || null,
          invoiceDate: extractedData.invoiceDate || extractedData.date || null,
          items,
          subtotal: typeof extractedData.subtotal === 'number' ? extractedData.subtotal : 0,
          tax: typeof extractedData.tax === 'number' ? extractedData.tax : 0,
          total: typeof extractedData.total === 'number' ? extractedData.total : 0
        }]
      }

      // Calcular totales generales
      const totalItems = invoices.reduce((sum, inv) => sum + inv.items.length, 0)
      const grandTotal = invoices.reduce((sum, inv) => sum + inv.total, 0)

      console.log('[Consignment OCR] Processed:', {
        invoiceCount: invoices.length,
        totalItems,
        grandTotal
      })

      return NextResponse.json({
        success: true,
        data: {
          // Para compatibilidad con el frontend actual, usar la primera factura como principal
          vendorName: invoices[0]?.vendorName || null,
          invoiceNumber: invoices[0]?.invoiceNumber || null,
          invoiceDate: invoices[0]?.invoiceDate || null,
          // Combinar todos los items de todas las facturas
          items: invoices.flatMap(inv => inv.items),
          subtotal: invoices.reduce((sum, inv) => sum + inv.subtotal, 0),
          tax: invoices.reduce((sum, inv) => sum + inv.tax, 0),
          total: grandTotal,
          confidence: extractedData.confidence || 0.5,
          itemCount: totalItems,
          // Información adicional de múltiples facturas
          invoices,
          invoiceCount: invoices.length,
          hasMultipleInvoices: invoices.length > 1
        }
      })
    } catch (parseError) {
      console.error('[Consignment OCR] Parse error:', parseError, 'Text:', text)
      return NextResponse.json({
        success: false,
        error: 'No se pudo interpretar la factura. Intenta con una imagen más clara.'
      }, { status: 422 })
    }

  } catch (error) {
    console.error('[Consignment OCR] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar factura'
    }, { status: 500 })
  }
}
