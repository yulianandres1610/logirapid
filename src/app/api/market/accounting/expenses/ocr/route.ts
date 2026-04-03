import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as storageAdapter from '@/lib/storage-adapter'

// API Key para Gemini (misma que el resto del proyecto)
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo para OCR de documentos/facturas (soporta PDFs e imágenes)
const OCR_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

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
    const { fileBase64, mimeType: providedMimeType, storagePath } = body

    // Soporte para el parámetro anterior (imageBase64) para compatibilidad
    let base64Input = fileBase64 || body.imageBase64

    // If storagePath provided, fetch file from storage
    if (!base64Input && storagePath) {
      if (!storageAdapter.isConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Almacenamiento no configurado'
        }, { status: 500 })
      }

      // Try company-documents first (phone upload), fallback to company-private-documents
      let fileData: any = null
      let downloadError: any = null
      const result1 = await storageAdapter.download('company-documents', storagePath)
      if (result1.data) {
        fileData = result1.data
      } else {
        const result2 = await storageAdapter.download('company-private-documents', storagePath)
        fileData = result2.data
        downloadError = result2.error
      }

      if (downloadError || !fileData) {
        console.error('[OCR] Error downloading from storage:', downloadError)
        return NextResponse.json({
          success: false,
          error: 'Error al obtener archivo del almacenamiento'
        }, { status: 400 })
      }

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const detectedMime = storagePath.endsWith('.pdf') ? 'application/pdf'
        : storagePath.endsWith('.png') ? 'image/png'
        : storagePath.endsWith('.webp') ? 'image/webp'
        : 'image/jpeg'
      base64Input = `data:${detectedMime};base64,${buffer.toString('base64')}`
      console.log('[OCR] Fetched file from storage:', { storagePath, mimeType: detectedMime, size: buffer.length })
    }

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
  "receiptNumber": "número de factura o recibo (ej: FAC-001, No. 12345, etc.) o null si no se detecta",
  "date": "YYYY-MM-DD",
  "items": [
    { "description": "descripción del item", "amount": 0.00, "suggestedCategory": "Categoria" }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

DETECCIÓN DE MONEDA (CRÍTICO - SER MUY CONSERVADOR):
Este sistema es para Cuba donde coexisten USD, CUP y MLC. DEBES ser MUY CUIDADOSO:

INDICADORES EXPLÍCITOS (alta confianza 0.8+):
- Texto "USD", "US$", "dólares", "dollars" → USD
- Texto "CUP", "MN", "pesos cubanos", "moneda nacional" → CUP
- Texto "MLC", "moneda libremente convertible", "tarjeta MLC" → MLC

INDICADORES POR CONTEXTO DE PRECIOS (confianza media 0.5-0.7):
- Precios unitarios > 100 (ej: 450, 1200, 5000) → probablemente CUP
- Precios con formato X,XXX o XX,XXX (miles) → muy probablemente CUP
- Totales > 1000 para pocos productos → probablemente CUP

CUÁNDO USAR NULL (sin confianza):
- Solo ves "$" sin especificar USD/CUP → usar NULL
- No hay texto que indique la moneda → usar NULL
- Precios ambiguos que podrían ser cualquier moneda → usar NULL
- Formato de factura genérico sin indicadores claros → usar NULL

REGLA DE ORO: Si tienes CUALQUIER duda, usa detectedCurrency: null y currencyConfidence: 0
Es mejor preguntar al usuario que asumir incorrectamente.

Incluir en tu respuesta JSON:
- "detectedCurrency": "USD" | "CUP" | "MLC" | null (usar null si hay duda)
- "currencyConfidence": 0.0 a 1.0 (usar 0 si no estás seguro)
- "currencyHints": explicación de por qué detectaste esa moneda o "No se encontraron indicadores claros de moneda"

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
          receiptNumber: extractedData.receiptNumber || null,
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
