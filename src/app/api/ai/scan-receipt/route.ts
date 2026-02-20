import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'
import { db } from '@/lib/database'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const OCR_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.0-flash-lite'
const MAX_RETRIES = 2
const GEMINI_TARGET_SIZE = 1024

// Cache model instance across requests
let cachedModel: any = null
function getModel() {
  if (!cachedModel && GOOGLE_AI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
    cachedModel = genAI.getGenerativeModel({ model: OCR_MODEL })
  }
  return cachedModel
}

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

/**
 * Fast image prep - skip sharp if client already compressed
 */
async function prepareImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')
    const inputSizeKB = Math.round(inputBuffer.length / 1024)

    // If image is already small (<200KB), skip sharp entirely
    if (inputSizeKB < 200) {
      console.log('[Receipt Scanner] Already small:', inputSizeKB, 'KB - skip sharp')
      return cleanBase64
    }

    const metadata = await sharp(inputBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    console.log('[Receipt Scanner] Input:', inputSizeKB, 'KB,', metadata.width, 'x', metadata.height)

    let processedBuffer: Buffer
    if (maxDimension > GEMINI_TARGET_SIZE) {
      processedBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(GEMINI_TARGET_SIZE, GEMINI_TARGET_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer()
    } else {
      processedBuffer = await sharp(inputBuffer)
        .rotate()
        .jpeg({ quality: 70 })
        .toBuffer()
    }

    const outputBase64 = processedBuffer.toString('base64')
    console.log('[Receipt Scanner] Output:', Math.round(outputBase64.length / 1024), 'KB')
    return outputBase64
  } catch (error) {
    console.error('[Receipt Scanner] Image processing error:', error)
    return cleanBase64
  }
}

/**
 * POST /api/ai/scan-receipt
 * Fast OCR for POS receipts/tickets using Gemini Vision
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
        // JWT invalid, check kiosk auth
      }
    }

    if (!isAuthenticated && kioskId && guardId) {
      // Single query for both kiosk + guard validation
      const authResult = await db.query(
        `SELECT k.id FROM market_door_kiosks k
         WHERE k.id = $1 AND k.isactive = true
         AND EXISTS (SELECT 1 FROM market_door_guards g WHERE g.employeeid = $2 AND g.isactive = true)`,
        [kioskId, guardId]
      )
      if (authResult.rows.length > 0) {
        isAuthenticated = true
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (!fileBase64) {
      return NextResponse.json({ success: false, error: 'Imagen del ticket requerida' }, { status: 400 })
    }

    const model = getModel()
    if (!model) {
      return NextResponse.json({ success: false, error: 'API de IA no configurada.' }, { status: 500 })
    }

    const compressedBase64 = await prepareImageForGemini(fileBase64)

    let mimeType = providedMimeType
    if (!mimeType && fileBase64.includes('data:')) {
      mimeType = fileBase64.split(';')[0].split(':')[1]
    }
    if (!mimeType) mimeType = 'image/jpeg'

    console.log('[Receipt Scanner] Processing:', { model: OCR_MODEL })

    // Compact prompt for speed
    const prompt = `OCR de ticket/recibo POS. Extrae datos de esta imagen.

Busca: numero de orden (Recibo, No., POS-XXXX), TOTAL, moneda (CUP/USD/MLC), fecha, nombre tienda, items.

Responde SOLO JSON (sin markdown):
{"orderNumber":"string o null","total":numero_o_null,"currency":"CUP","date":"YYYY-MM-DD o null","storeName":"string o null","items":[{"name":"","quantity":1,"price":0.00}],"confidence":0.0}`

    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent([
          prompt,
          { inlineData: { mimeType, data: compressedBase64 } }
        ])

        const response = await result.response
        let text = response.text()
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        console.log('[Receipt Scanner] Response (attempt', attempt, '):', text.substring(0, 150))

        const extractedData = JSON.parse(text) as ReceiptData

        if (!extractedData.orderNumber && !extractedData.total && !extractedData.storeName) {
          if (attempt < MAX_RETRIES) continue
          return NextResponse.json({
            success: false,
            error: 'No se pudo extraer informacion del ticket. Tome una foto mas clara.'
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

    return NextResponse.json({
      success: false,
      error: 'No se pudo interpretar el ticket. Intenta con mejor iluminacion.'
    }, { status: 422 })

  } catch (error) {
    console.error('[Receipt Scanner] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar ticket'
    }, { status: 500 })
  }
}
