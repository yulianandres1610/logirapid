import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'

// API Key para Gemini (misma que el resto del proyecto)
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
 * POST /api/market/accounting/expenses/ocr
 * Extract expense data from a receipt/invoice using Gemini Vision
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
    const { fileBase64, mimeType: providedMimeType } = body

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
      console.error('[OCR] GOOGLE_AI_API_KEY not configured')
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
    console.log('[OCR] Processing file:', { mimeType, isPdf, model: OCR_MODEL })

    const prompt = `Analiza este recibo/factura y extrae CADA LÍNEA de producto o servicio por separado.

INSTRUCCIONES:
1. PROVEEDOR: Nombre del negocio o empresa
2. FECHA: En formato YYYY-MM-DD
3. ITEMS: Un array con CADA producto/servicio individual. Para cada item extrae:
   - description: Nombre o descripción del producto/servicio
   - amount: Monto del item (sin impuesto si es posible identificarlo)
   - suggestedCategory: Categoría sugerida entre estas opciones:
     * Suministros (papelería, artículos de oficina)
     * Mantenimiento (limpieza, reparaciones)
     * Servicios (electricidad, agua, internet, teléfono)
     * Transporte (combustible, pasajes, envíos)
     * Inventario (mercancía para venta)
     * Alimentos (comida, bebidas, snacks)
     * Marketing (publicidad, promoción)
     * Equipamiento (muebles, equipos, herramientas)
     * Otros (lo que no encaje en las anteriores)
4. SUBTOTAL: Suma de todos los items antes de impuesto
5. TAX: Monto del impuesto (IVA, ITBIS, etc.) - usar 0 si no hay impuesto visible
6. TOTAL: Monto total con impuesto incluido

IMPORTANTE:
- Si el recibo tiene una sola línea general, crea UN solo item con la descripción general
- Si hay múltiples productos, crea un item por cada uno
- Los montos deben ser números sin símbolos de moneda

Responde ÚNICAMENTE en formato JSON con esta estructura:
{
  "vendorName": "nombre del negocio",
  "date": "YYYY-MM-DD",
  "items": [
    { "description": "descripción del item", "amount": 0.00, "suggestedCategory": "Categoria" }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
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

Si no puedes identificar algún campo, usa null para strings y 0 para números.
El campo "confidence" indica qué tan seguro estás de la extracción (0 a 1).
SIEMPRE intenta detectar la moneda del documento.

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

    console.log('[OCR] Raw response:', text)

    try {
      const extractedData = JSON.parse(text)

      // Procesar items y asegurar estructura correcta
      const items = Array.isArray(extractedData.items)
        ? extractedData.items.map((item: { description?: string; amount?: number; suggestedCategory?: string }, index: number) => ({
            id: `item-${index}`,
            description: item.description || 'Item sin descripción',
            amount: typeof item.amount === 'number' ? item.amount : 0,
            suggestedCategory: item.suggestedCategory || 'Otros'
          }))
        : []

      // Si no hay items pero hay un total, crear un item genérico
      if (items.length === 0 && extractedData.total) {
        items.push({
          id: 'item-0',
          description: extractedData.description || 'Gasto general',
          amount: extractedData.total,
          suggestedCategory: 'Otros'
        })
      }

      // Extract currency detection fields
      const detectedCurrency = extractedData.detectedCurrency || null
      const currencyConfidence = typeof extractedData.currencyConfidence === 'number'
        ? extractedData.currencyConfidence : 0
      const currencyHints = extractedData.currencyHints || null

      console.log('[Expenses OCR] Currency detection:', { detectedCurrency, currencyConfidence, currencyHints })

      return NextResponse.json({
        success: true,
        data: {
          vendorName: extractedData.vendorName || null,
          date: extractedData.date || null,
          items,
          subtotal: typeof extractedData.subtotal === 'number' ? extractedData.subtotal : 0,
          tax: typeof extractedData.tax === 'number' ? extractedData.tax : 0,
          total: typeof extractedData.total === 'number' ? extractedData.total : 0,
          confidence: extractedData.confidence || 0.5,
          // Mantener compatibilidad con formato anterior
          description: items.length === 1 ? items[0].description : `${items.length} items detectados`,
          amount: extractedData.total || items.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0),
          // Currency detection fields
          detectedCurrency,
          currencyConfidence,
          currencyHints
        }
      })
    } catch (parseError) {
      console.error('[OCR] Parse error:', parseError, 'Text:', text)
      return NextResponse.json({
        success: false,
        error: 'No se pudo interpretar el recibo. Intenta con una imagen más clara.'
      }, { status: 422 })
    }

  } catch (error) {
    console.error('[OCR] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar imagen'
    }, { status: 500 })
  }
}
