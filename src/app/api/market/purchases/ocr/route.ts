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
 * POST /api/market/purchases/ocr
 * Extract product data from a supplier invoice using Gemini Vision
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
      console.error('[Purchase OCR] GOOGLE_AI_API_KEY not configured')
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
    console.log('[Purchase OCR] Processing file:', { mimeType, isPdf, model: OCR_MODEL, hasContext: !!userContext })

    // Construir el prompt con contexto del usuario si existe
    const contextSection = userContext
      ? `\nCONTEXTO ADICIONAL DEL USUARIO:\n${userContext}\n\nUsa este contexto para interpretar mejor los productos. Por ejemplo, si el usuario indica que ciertos items son variantes del mismo producto, agrúpalos usando el campo "isVariantOf".`
      : ''

    const prompt = `Analiza esta factura de proveedor y extrae TODOS los productos listados.
${contextSection}
INSTRUCCIONES:
1. PROVEEDOR: Nombre del proveedor/distribuidor que emite la factura
2. NÚMERO DE FACTURA: Número o código de la factura (ej: FAC-001, #12345)
3. FECHA: Fecha de la factura en formato YYYY-MM-DD
4. PRODUCTOS: Un array con CADA producto individual. Para cada producto extrae:
   - name: Nombre del producto exactamente como aparece
   - quantity: Cantidad (número entero o decimal)
   - unitCost: Precio unitario de costo (sin impuestos si es posible)
   - totalCost: Total de la línea (quantity × unitCost)
   - sku: Código SKU si aparece (null si no está visible)
   - barcode: Código de barras si aparece (null si no está visible)
   - description: Descripción adicional si existe (null si no hay)
   - isVariantOf: Si el contexto del usuario indica que este producto es una variante de otro, poner el nombre del producto padre (null si no aplica)
5. SUBTOTAL: Suma de todos los productos antes de impuesto
6. TAX: Monto del impuesto (IVA, ITBIS, etc.) - usar 0 si no hay impuesto visible
7. TOTAL: Monto total de la factura con impuesto incluido

IMPORTANTE:
- Extrae TODOS los productos que puedas identificar en la factura
- Los montos deben ser números sin símbolos de moneda
- Si un código de barras o SKU es visible, extráelo exactamente como aparece
- Para cantidades, usa el número exacto (ej: 10, 24, 1.5)
- Si el contexto menciona variantes, usa "isVariantOf" para agrupar productos relacionados

Responde ÚNICAMENTE en formato JSON con esta estructura:
{
  "vendorName": "nombre del proveedor",
  "invoiceNumber": "número de factura o null",
  "invoiceDate": "YYYY-MM-DD",
  "items": [
    {
      "name": "nombre del producto",
      "quantity": 10,
      "unitCost": 1.50,
      "totalCost": 15.00,
      "sku": "SKU-123" | null,
      "barcode": "7891234567890" | null,
      "description": "descripción adicional" | null,
      "isVariantOf": "nombre del producto padre" | null
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

Si no puedes identificar algún campo, usa null para strings y 0 para números.
El campo "confidence" indica qué tan seguro estás de la extracción (0 a 1).

IMPORTANTE: Solo responde con el JSON, sin texto adicional, sin markdown.`

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

    console.log('[Purchase OCR] Raw response:', text.substring(0, 500) + '...')

    try {
      const extractedData = JSON.parse(text)

      // Procesar items y asegurar estructura correcta
      const items = Array.isArray(extractedData.items)
        ? extractedData.items.map((item: {
            name?: string
            quantity?: number
            unitCost?: number
            totalCost?: number
            sku?: string | null
            barcode?: string | null
            description?: string | null
            isVariantOf?: string | null
          }, index: number) => ({
            id: `item-${index}`,
            name: item.name || 'Producto sin nombre',
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            unitCost: typeof item.unitCost === 'number' ? item.unitCost : 0,
            totalCost: typeof item.totalCost === 'number' ? item.totalCost : (item.quantity || 1) * (item.unitCost || 0),
            sku: item.sku || null,
            barcode: item.barcode || null,
            description: item.description || null,
            isVariantOf: item.isVariantOf || null
          }))
        : []

      // Si no hay items pero hay un total, crear un item genérico
      if (items.length === 0 && extractedData.total) {
        items.push({
          id: 'item-0',
          name: 'Producto general',
          quantity: 1,
          unitCost: extractedData.total,
          totalCost: extractedData.total,
          sku: null,
          barcode: null,
          description: null,
          isVariantOf: null
        })
      }

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
          itemCount: items.length
        }
      })
    } catch (parseError) {
      console.error('[Purchase OCR] Parse error:', parseError, 'Text:', text)
      return NextResponse.json({
        success: false,
        error: 'No se pudo interpretar la factura. Intenta con una imagen más clara.'
      }, { status: 422 })
    }

  } catch (error) {
    console.error('[Purchase OCR] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar factura'
    }, { status: 500 })
  }
}
