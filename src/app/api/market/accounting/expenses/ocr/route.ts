import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'

// API Key para Gemini (misma que el resto del proyecto)
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo específico para OCR de documentos/facturas (soporta PDFs e imágenes)
// Gemini 1.5 Pro es ideal para análisis de documentos
const OCR_MODEL = 'gemini-1.5-pro'

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
