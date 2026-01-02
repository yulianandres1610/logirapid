import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/market/accounting/expenses/ocr
 * Extract expense data from a receipt image using Gemini Vision
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
    const { imageBase64 } = body

    if (!imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'Imagen requerida'
      }, { status: 400 })
    }

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API de IA no configurada'
      }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Prepare the image data
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64

    const mimeType = imageBase64.includes('data:')
      ? imageBase64.split(';')[0].split(':')[1]
      : 'image/jpeg'

    const prompt = `Analiza esta imagen de un recibo o factura y extrae la siguiente información:

1. DESCRIPCIÓN: Un resumen breve del gasto (ej: "Compra de suministros de oficina", "Pago de electricidad")
2. MONTO TOTAL: El monto total a pagar (solo el número, sin símbolos de moneda)
3. NOMBRE DEL VENDEDOR/PROVEEDOR: El nombre del negocio o empresa
4. FECHA: La fecha del recibo en formato YYYY-MM-DD

Responde ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "description": "descripción del gasto",
  "amount": 123.45,
  "vendorName": "nombre del vendedor",
  "date": "2024-01-15",
  "confidence": 0.95
}

Si no puedes identificar algún campo con certeza, usa null.
El campo "confidence" debe ser un número entre 0 y 1 indicando qué tan seguro estás de la extracción.

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

      return NextResponse.json({
        success: true,
        data: {
          description: extractedData.description || null,
          amount: typeof extractedData.amount === 'number' ? extractedData.amount : null,
          vendorName: extractedData.vendorName || null,
          date: extractedData.date || null,
          confidence: extractedData.confidence || 0.5
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
