import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'
import { db } from '@/lib/database'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const OCR_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.0-flash'
const MAX_RETRIES = 2
const GEMINI_TARGET_SIZE = 1600

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface ReceiptData {
  orderNumber: string | null
  total: number | null
  currency: string | null
  date: string | null
  storeName: string | null
  items: Array<{ name: string; quantity: number; price: number }> | null
  confidence: number
}

async function prepareImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')
    const metadata = await sharp(inputBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    console.log('[Receipt Scanner] Input image:', Math.round(inputBuffer.length / 1024), 'KB,', metadata.width, 'x', metadata.height)

    let processedBuffer: Buffer
    if (maxDimension > 2000) {
      processedBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: GEMINI_TARGET_SIZE,
          height: GEMINI_TARGET_SIZE,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
    } else {
      processedBuffer = await sharp(inputBuffer)
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
    }

    const outputBase64 = processedBuffer.toString('base64')
    console.log('[Receipt Scanner] Output image:', Math.round(outputBase64.length / 1024), 'KB')
    return outputBase64
  } catch (error) {
    console.error('[Receipt Scanner] Image processing error:', error)
    return cleanBase64
  }
}

/**
 * POST /api/ai/scan-receipt
 * Scan a POS receipt or invoice photo and extract data using Gemini Vision
 *
 * Supports two authentication modes:
 * 1. JWT auth-token cookie (standard dashboard users)
 * 2. Kiosk mode with kioskId + guardId (for door kiosks)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileBase64, mimeType: providedMimeType, kioskId, guardId } = body

    // Authentication - either JWT or kiosk credentials
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    let isAuthenticated = false

    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        jwt.verify(authToken, secret) as JWTPayload
        isAuthenticated = true
      } catch {
        // JWT invalid, will check kiosk auth below
      }
    }

    if (!isAuthenticated && kioskId && guardId) {
      const kioskResult = await db.query(
        'SELECT id FROM market_door_kiosks WHERE id = $1 AND isactive = true',
        [kioskId]
      )
      if (kioskResult.rows.length > 0) {
        const guardResult = await db.query(
          'SELECT id FROM market_door_guards WHERE employeeid = $1 AND isactive = true',
          [guardId]
        )
        if (guardResult.rows.length > 0) {
          isAuthenticated = true
          console.log('[Receipt Scanner] Kiosk mode authentication - kioskId:', kioskId, 'guardId:', guardId)
        }
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    if (!fileBase64) {
      return NextResponse.json({
        success: false,
        error: 'Imagen del ticket requerida'
      }, { status: 400 })
    }

    if (!GOOGLE_AI_API_KEY) {
      console.error('[Receipt Scanner] GOOGLE_AI_API_KEY not configured')
      return NextResponse.json({
        success: false,
        error: 'API de IA no configurada. Configure GOOGLE_AI_API_KEY en las variables de entorno.'
      }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: OCR_MODEL })

    const compressedBase64 = await prepareImageForGemini(fileBase64)

    let mimeType = providedMimeType
    if (!mimeType && fileBase64.includes('data:')) {
      mimeType = fileBase64.split(';')[0].split(':')[1]
    }
    if (!mimeType) {
      mimeType = 'image/jpeg'
    }

    console.log('[Receipt Scanner] Processing receipt:', { mimeType, model: OCR_MODEL })

    const prompt = `Eres un experto en OCR de tickets de venta POS y facturas. Extrae los datos de esta imagen de ticket/factura/recibo.

## TIPOS DE DOCUMENTOS:
1. **Ticket POS termico** - recibo de punto de venta con papel termico
2. **Factura cubana** - factura comercial
3. **Recibo de compra** - comprobante de compra

## DATOS A EXTRAER:
- Numero de orden/ticket/factura (busca "No.", "Orden", "#", "Ticket", "Factura")
- Total de la compra (busca "TOTAL", "Total a Pagar", "IMPORTE")
- Moneda (CUP, USD, MLC, EUR - si no se especifica, asume CUP)
- Fecha del documento (cualquier formato)
- Nombre del establecimiento/tienda (busca en el encabezado)
- Items/productos comprados (nombre, cantidad, precio)

## IMPORTANTE:
- Si el ticket esta borroso o ilegible en partes, extrae lo que puedas
- El numero de orden puede estar como "ORD-XXXX", "TKT-XXXX", "No. XXXX", etc.
- Para el total, busca el monto mas grande o el que diga "TOTAL"
- Los tickets termicos cubanos usan CUP como moneda principal

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "orderNumber": "numero de orden/ticket (string o null)",
  "total": numero_decimal_o_null,
  "currency": "CUP/USD/MLC/EUR o null",
  "date": "YYYY-MM-DD o null",
  "storeName": "nombre del establecimiento o null",
  "items": [{"name": "nombre", "quantity": 1, "price": 0.00}],
  "confidence": 0.0-1.0
}

REGLAS:
1. Si no puedes leer un campo, pon null
2. El total debe ser un numero decimal, no string
3. items puede ser array vacio [] si no se distinguen productos
4. confidence refleja que tan legible es el ticket (0.3 = muy borroso, 0.9 = nitido)`

    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: compressedBase64
            }
          }
        ])

        const response = await result.response
        let text = response.text()

        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        console.log('[Receipt Scanner] Raw response (attempt', attempt, '):', text.substring(0, 200))

        const extractedData = JSON.parse(text) as ReceiptData

        if (!extractedData.orderNumber && !extractedData.total && !extractedData.storeName) {
          if (attempt < MAX_RETRIES) {
            console.log('[Receipt Scanner] Missing essential fields, retrying...')
            continue
          }
          return NextResponse.json({
            success: false,
            error: 'No se pudo extraer informacion del ticket. Por favor tome una foto mas clara.'
          }, { status: 422 })
        }

        return NextResponse.json({
          success: true,
          data: {
            orderNumber: extractedData.orderNumber || null,
            total: extractedData.total || null,
            currency: extractedData.currency || 'CUP',
            date: extractedData.date || null,
            storeName: extractedData.storeName || null,
            items: extractedData.items || [],
            confidence: extractedData.confidence || 0.5
          }
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[Receipt Scanner] Attempt ${attempt} failed:`, lastError.message)
      }
    }

    console.error('[Receipt Scanner] All retries failed:', lastError)
    return NextResponse.json({
      success: false,
      error: 'No se pudo interpretar el ticket. Intenta con una imagen mas clara.'
    }, { status: 422 })

  } catch (error) {
    console.error('[Receipt Scanner] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar ticket'
    }, { status: 500 })
  }
}
