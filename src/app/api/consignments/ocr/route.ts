import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Configuración para permitir archivos grandes y mayor tiempo de procesamiento
export const maxDuration = 120 // 2 minutos
export const dynamic = 'force-dynamic'

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
  console.log('[Consignment OCR] Request received')

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

    console.log('[Consignment OCR] Auth OK, parsing body...')

    let body
    try {
      body = await request.json()
      console.log('[Consignment OCR] Body parsed, fileBase64 length:', body.fileBase64?.length || 0)
    } catch (parseError) {
      console.error('[Consignment OCR] Failed to parse body:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Error al procesar el archivo. El archivo puede ser demasiado grande o estar corrupto.'
      }, { status: 400 })
    }

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
      ? `\nCONTEXTO ADICIONAL DEL USUARIO: ${userContext}\n`
      : ''

    const prompt = `Eres un experto en OCR de facturas de consignación. Tu tarea es extraer TODOS los productos/items de esta factura.
${contextSection}
EXTRAE LA SIGUIENTE INFORMACIÓN:

1. vendorName: Nombre del proveedor o empresa que entrega en consignación
2. invoiceNumber: Número de factura (ej: FAC-001, 12345, etc.)
3. invoiceDate: Fecha en formato YYYY-MM-DD
4. items: ARRAY con CADA producto. ESTO ES LO MÁS IMPORTANTE.
5. subtotal: Subtotal antes de impuestos
6. tax: Impuesto (IVA, ITBIS, etc.) - usa 0 si no hay
7. total: Total de la factura

PARA CADA ITEM EN LA FACTURA EXTRAE:
- name: Nombre del producto EXACTAMENTE como aparece
- quantity: Cantidad (número entero o decimal)
- unitOfMeasure: Unidad de medida (ej: "unidad", "kg", "lb", "caja", "paquete", "litro", etc.)
- unitCost: Precio por unidad
- totalCost: Total de esa línea (quantity × unitCost)
- sku: Código del producto si existe, sino null
- barcode: Código de barras si existe, sino null
- isVariantOf: Nombre del producto BASE si este item es una variante (ver instrucciones abajo)

DETECCIÓN DE VARIANTES (MUY IMPORTANTE):
Analiza los productos y detecta si hay variantes del mismo producto base.
Ejemplos de variantes:
- "Jugo Toto Mango", "Jugo Toto Fresa", "Jugo Toto Naranja" → isVariantOf: "Jugo Toto"
- "Yogurt Fresa 1L", "Yogurt Chocolate 1L", "Yogurt Natural 1L" → isVariantOf: "Yogurt 1L"
- "Refresco Cola 2L", "Refresco Limón 2L", "Refresco Naranja 2L" → isVariantOf: "Refresco 2L"
- "Cerveza Lager", "Cerveza Negra", "Cerveza Light" → isVariantOf: "Cerveza"

Criterios para detectar variantes:
1. Productos con nombre similar pero diferente sabor, color, tamaño o presentación
2. Productos que claramente son variaciones de un producto base común
3. Si el contexto del usuario menciona que ciertos productos son variantes, respeta esa indicación

Si el producto NO es una variante, usa isVariantOf: null

EJEMPLO DE RESPUESTA CON VARIANTES:
{
  "vendorName": "Distribuidora ABC",
  "invoiceNumber": "FAC-2025-001",
  "invoiceDate": "2025-01-03",
  "items": [
    { "name": "Jugo Toto Mango", "quantity": 10, "unitOfMeasure": "unidad", "unitCost": 2.00, "totalCost": 20.00, "sku": null, "barcode": null, "isVariantOf": "Jugo Toto" },
    { "name": "Jugo Toto Fresa", "quantity": 15, "unitOfMeasure": "unidad", "unitCost": 2.00, "totalCost": 30.00, "sku": null, "barcode": null, "isVariantOf": "Jugo Toto" },
    { "name": "Arroz Premium", "quantity": 50, "unitOfMeasure": "lb", "unitCost": 0.80, "totalCost": 40.00, "sku": null, "barcode": null, "isVariantOf": null }
  ],
  "subtotal": 90.00,
  "tax": 7.20,
  "total": 97.20,
  "confidence": 0.95
}

DETECCIÓN DE MONEDA (MUY IMPORTANTE PARA CUBA):
Analiza el documento para identificar la moneda de los precios:
- Busca símbolos: "$" (puede ser USD o CUP), "€" (EUR), "MLC", "CUP", "USD"
- Busca palabras: "pesos", "dólares", "dollars", "moneda libremente convertible", "MN", "CUP", "USD"
- CONTEXTO CUBA: Si ves precios MUY ALTOS (ej: 40,000, 15,000) probablemente es CUP (peso cubano)
- Si ves precios bajos con formato típico americano (ej: 10.50, 25.00) probablemente es USD
- MLC generalmente tiene precios similares a USD pero con indicador "MLC" o "tarjeta"
- Si no puedes determinar la moneda con certeza, usa null

Incluir en tu respuesta JSON:
- "detectedCurrency": "USD" | "CUP" | "MLC" | null
- "currencyConfidence": número de 0.0 a 1.0 indicando certeza de la moneda detectada
- "currencyHints": breve explicación de por qué detectaste esa moneda

REGLAS CRÍTICAS:
- El array "items" DEBE contener todos los productos de la factura
- Si ves una lista de productos, cada línea es un item separado
- Los números deben ser sin símbolos de moneda (1.50 no $1.50)
- Si no puedes leer un campo, usa null para texto y 0 para números
- SIEMPRE analiza si hay productos que son variantes y asigna isVariantOf correctamente
- El campo confidence indica tu certeza general (0.0 a 1.0)
- SIEMPRE intenta detectar la moneda del documento

RESPONDE ÚNICAMENTE CON EL JSON. Sin explicaciones, sin markdown, sin \`\`\`.`

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

    console.log('[Consignment OCR] Raw response (full):', text)

    try {
      const extractedData = JSON.parse(text)
      console.log('[Consignment OCR] Parsed data:', JSON.stringify(extractedData, null, 2))

      // Verificar la estructura de la respuesta
      console.log('[Consignment OCR] Response keys:', Object.keys(extractedData))
      console.log('[Consignment OCR] Items type:', typeof extractedData.items, Array.isArray(extractedData.items))
      console.log('[Consignment OCR] Items raw:', extractedData.items)

      // Procesar items - buscar en múltiples ubicaciones posibles
      let rawItems = extractedData.items

      // Fallback: buscar items en otras ubicaciones posibles
      if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
        rawItems = extractedData.products || extractedData.productos || extractedData.lineas || []
        console.log('[Consignment OCR] Using fallback items source:', rawItems.length)
      }

      const items = Array.isArray(rawItems)
        ? rawItems.map((item: {
            name?: string
            nombre?: string
            description?: string
            descripcion?: string
            quantity?: number
            cantidad?: number
            qty?: number
            unitOfMeasure?: string
            unidadMedida?: string
            unit?: string
            unitCost?: number
            precioUnitario?: number
            precio?: number
            price?: number
            totalCost?: number
            total?: number
            sku?: string | null
            codigo?: string | null
            barcode?: string | null
            codigoBarras?: string | null
            isVariantOf?: string | null
            esVarianteDe?: string | null
          }, index: number) => {
            // Handle multiple possible field names
            const name = item.name || item.nombre || item.description || item.descripcion || 'Producto sin nombre'
            const quantity = typeof item.quantity === 'number' ? item.quantity :
                            typeof item.cantidad === 'number' ? item.cantidad :
                            typeof item.qty === 'number' ? item.qty : 1
            const unitOfMeasure = item.unitOfMeasure || item.unidadMedida || item.unit || 'unidad'
            const unitCost = typeof item.unitCost === 'number' ? item.unitCost :
                            typeof item.precioUnitario === 'number' ? item.precioUnitario :
                            typeof item.precio === 'number' ? item.precio :
                            typeof item.price === 'number' ? item.price : 0
            const totalCost = typeof item.totalCost === 'number' ? item.totalCost :
                             typeof item.total === 'number' ? item.total : quantity * unitCost
            const sku = item.sku || item.codigo || null
            const barcode = item.barcode || item.codigoBarras || null
            // Extract isVariantOf from AI response
            const isVariantOf = item.isVariantOf || item.esVarianteDe || null

            return {
              id: `item-${index}`,
              name,
              quantity,
              unitOfMeasure,
              unitCost,
              totalCost,
              sku,
              barcode,
              description: null,
              isVariantOf
            }
          })
        : []

      // Si no hay items pero hay un total, crear un item genérico
      if (items.length === 0 && extractedData.total) {
        console.log('[Consignment OCR] No items found, creating generic item from total')
        items.push({
          id: 'item-0',
          name: 'Producto general',
          quantity: 1,
          unitOfMeasure: 'unidad',
          unitCost: extractedData.total,
          totalCost: extractedData.total,
          sku: null,
          barcode: null,
          description: null,
          isVariantOf: null
        })
      }

      console.log('[Consignment OCR] Final processed items:', items.length, items)

      // Extract currency detection fields
      const detectedCurrency = extractedData.detectedCurrency || null
      const currencyConfidence = typeof extractedData.currencyConfidence === 'number'
        ? extractedData.currencyConfidence : 0
      const currencyHints = extractedData.currencyHints || null

      console.log('[Consignment OCR] Currency detection:', { detectedCurrency, currencyConfidence, currencyHints })

      return NextResponse.json({
        success: true,
        data: {
          vendorName: extractedData.vendorName || null,
          invoiceNumber: extractedData.invoiceNumber || null,
          invoiceDate: extractedData.invoiceDate || extractedData.date || null,
          items,
          subtotal: typeof extractedData.subtotal === 'number' ? extractedData.subtotal : 0,
          tax: typeof extractedData.tax === 'number' ? extractedData.tax : 0,
          total: typeof extractedData.total === 'number' ? extractedData.total : 0,
          confidence: extractedData.confidence || 0.5,
          itemCount: items.length,
          // Currency detection fields
          detectedCurrency,
          currencyConfidence,
          currencyHints
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
