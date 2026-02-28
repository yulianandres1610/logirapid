import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'
import { db } from '@/lib/database'

// API Key para Gemini
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

const OCR_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.0-flash'

const MAX_RETRIES = 2

// 1024px max - client already compresses to 800px, only resize if still large
const GEMINI_TARGET_SIZE = 1024

// Cache Gemini model instance across requests
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

interface IdDocumentData {
  fullName: string
  firstName?: string
  lastName?: string
  documentType: 'cedula' | 'passport' | 'license' | 'unknown'
  documentNumber: string
  dateOfBirth?: string
  expiryDate?: string
  nationality?: string
  address?: string
  gender?: string
  issuingCountry?: string
  confidence: number
}

/**
 * Fast image prep - skip sharp if client already compressed to small size
 */
async function prepareImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')
    const inputSizeKB = Math.round(inputBuffer.length / 1024)

    // If image is already small (<200KB), skip sharp entirely (client compressed it)
    if (inputSizeKB < 200) {
      console.log('[ID Scanner] Image already small:', inputSizeKB, 'KB - skipping sharp')
      return cleanBase64
    }

    const metadata = await sharp(inputBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    console.log('[ID Scanner] Input:', inputSizeKB, 'KB,', metadata.width, 'x', metadata.height)

    // Only resize if larger than target
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
    console.log('[ID Scanner] Output:', Math.round(outputBase64.length / 1024), 'KB')
    return outputBase64
  } catch (error) {
    console.error('[ID Scanner] Image processing error:', error)
    return cleanBase64
  }
}

/**
 * POST /api/ai/scan-id-document
 * Scan an ID document (cedula, passport, license) and extract information using Gemini Vision
 *
 * Supports two authentication modes:
 * 1. JWT auth-token cookie (standard dashboard users)
 * 2. Kiosk mode with kioskId + guardId (for door kiosks)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileBase64, mimeType: providedMimeType, documentType, kioskId, guardId } = body

    // Authentication - either JWT or kiosk credentials
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    let isAuthenticated = false

    // Check JWT authentication first
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        jwt.verify(authToken, secret) as JWTPayload
        isAuthenticated = true
      } catch {
        // JWT invalid, will check kiosk auth below
      }
    }

    // Check kiosk authentication - single query for speed
    if (!isAuthenticated && kioskId && guardId) {
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
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    if (!fileBase64) {
      return NextResponse.json({
        success: false,
        error: 'Imagen del documento requerida'
      }, { status: 400 })
    }

    const model = getModel()
    if (!model) {
      return NextResponse.json({
        success: false,
        error: 'API de IA no configurada. Configure GOOGLE_AI_API_KEY.'
      }, { status: 500 })
    }

    // Prepare image + detect mime type in parallel
    const [compressedBase64] = await Promise.all([
      prepareImageForGemini(fileBase64)
    ])

    let mimeType = providedMimeType
    if (!mimeType && fileBase64.includes('data:')) {
      mimeType = fileBase64.split(';')[0].split(':')[1]
    }
    if (!mimeType) mimeType = 'image/jpeg'

    console.log('[ID Scanner] Processing:', { model: OCR_MODEL })

    // Compact prompt - shorter = faster Gemini response
    const prompt = `OCR de carnet de identidad cubano. Extrae datos de esta imagen.

FRENTE: NI (11 digitos AAMMDDXXXXXC), NOMBRE, APELLIDOS, SEXO, VENCIMIENTO
REVERSO: RESIDENCIA, MUNICIPIO, PROVINCIA

fullName = NOMBRE + APELLIDOS (nombre primero). Ej: NOMBRE:"YULIAN ANDRES" APELLIDOS:"DIAZ PEREZ" → "YULIAN ANDRES DIAZ PEREZ"
dateOfBirth del NI: posiciones 0-1=año, 2-3=mes, 4-5=dia. AA>30→19XX, AA<=30→20XX

Responde SOLO JSON (sin markdown):
{"fullName":"","firstName":"","lastName":"","documentType":"cedula","documentNumber":"","dateOfBirth":"YYYY-MM-DD","expiryDate":"","nationality":"Cubana","address":"","gender":"M/F","issuingCountry":"Cuba","confidence":0.0}`

    // Retry logic for OCR processing
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

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        console.log('[ID Scanner] Raw response (attempt', attempt, '):', text.substring(0, 200))

        const extractedData = JSON.parse(text) as IdDocumentData

        // Validate essential fields
        if (!extractedData.fullName && !extractedData.documentNumber) {
          if (attempt < MAX_RETRIES) {
            console.log('[ID Scanner] Missing essential fields, retrying...')
            continue
          }
          return NextResponse.json({
            success: false,
            error: 'No se pudo extraer información del documento. Por favor tome una foto más clara.'
          }, { status: 422 })
        }

        // Process Cuban cedula - extract date of birth from ID number if not present
        if (extractedData.documentType === 'cedula' &&
            extractedData.documentNumber &&
            !extractedData.dateOfBirth) {
          const idNum = extractedData.documentNumber.replace(/\D/g, '')
          if (idNum.length === 11) {
            // Cuban ID format: AAMMDDXXXXXC
            const year = parseInt(idNum.substring(0, 2))
            const month = idNum.substring(2, 4)
            const day = idNum.substring(4, 6)
            // Determine century (people born before 2000 have year > 25 usually)
            const fullYear = year > 25 ? 1900 + year : 2000 + year
            extractedData.dateOfBirth = `${fullYear}-${month}-${day}`
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            fullName: extractedData.fullName || null,
            firstName: extractedData.firstName || null,
            lastName: extractedData.lastName || null,
            documentType: extractedData.documentType || 'unknown',
            documentNumber: extractedData.documentNumber || null,
            dateOfBirth: extractedData.dateOfBirth || null,
            expiryDate: extractedData.expiryDate || null,
            nationality: extractedData.nationality || null,
            address: extractedData.address || null,
            gender: extractedData.gender || null,
            issuingCountry: extractedData.issuingCountry || null,
            confidence: extractedData.confidence || 0.5
          }
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[ID Scanner] Attempt ${attempt} failed:`, lastError.message)
        if (attempt < MAX_RETRIES) {
          // Retry immediately for speed
        }
      }
    }

    // All retries failed
    console.error('[ID Scanner] All retries failed:', lastError)
    return NextResponse.json({
      success: false,
      error: 'No se pudo interpretar el documento. Intenta con una imagen más clara.'
    }, { status: 422 })

  } catch (error) {
    console.error('[ID Scanner] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar documento'
    }, { status: 500 })
  }
}
