import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'

// API Key para Gemini
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo para OCR de documentos de identificación
// gemini-1.5-flash is faster and more stable for OCR tasks
const OCR_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-1.5-flash'

// Maximum retries for OCR processing
const MAX_RETRIES = 2

// Image processing settings - no size limits, just optimize orientation
const GEMINI_TARGET_SIZE = 2048 // Max dimension for very large images (optional resize)

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
 * Prepara la imagen para Gemini - sin límites de tamaño, solo optimiza orientación
 * Móviles modernos toman fotos de alta calidad que Gemini puede procesar
 */
async function prepareImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')
    const inputSizeKB = Math.round(inputBuffer.length / 1024)

    // Auto-rotate based on EXIF orientation (important for mobile photos)
    const metadata = await sharp(inputBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    console.log('[ID Scanner] Input image:', inputSizeKB, 'KB,', metadata.width, 'x', metadata.height)

    // Only resize if image is extremely large (>4000px in any dimension)
    // This preserves quality for high-resolution mobile cameras
    let processedBuffer: Buffer
    if (maxDimension > 4000) {
      processedBuffer = await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize({
          width: GEMINI_TARGET_SIZE,
          height: GEMINI_TARGET_SIZE,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
      console.log('[ID Scanner] Resized very large image to fit within', GEMINI_TARGET_SIZE, 'px')
    } else {
      // Just auto-rotate, preserve original quality
      processedBuffer = await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF
        .toBuffer()
    }

    const outputBase64 = processedBuffer.toString('base64')
    console.log('[ID Scanner] Output image:', Math.round(outputBase64.length / 1024), 'KB')

    return outputBase64
  } catch (error) {
    console.error('[ID Scanner] Image processing error:', error)
    // On error, return original
    return cleanBase64
  }
}

/**
 * POST /api/ai/scan-id-document
 * Scan an ID document (cedula, passport, license) and extract information using Gemini Vision
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
    const { fileBase64, mimeType: providedMimeType, documentType } = body

    if (!fileBase64) {
      return NextResponse.json({
        success: false,
        error: 'Imagen del documento requerida'
      }, { status: 400 })
    }

    // Initialize Gemini
    if (!GOOGLE_AI_API_KEY) {
      console.error('[ID Scanner] GOOGLE_AI_API_KEY not configured')
      return NextResponse.json({
        success: false,
        error: 'API de IA no configurada. Configure GOOGLE_AI_API_KEY en las variables de entorno.'
      }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: OCR_MODEL })

    // Prepare image (auto-rotate, handle very large images)
    const compressedBase64 = await prepareImageForGemini(fileBase64)

    // Detect mimeType from data URL or use provided
    let mimeType = providedMimeType
    if (!mimeType && fileBase64.includes('data:')) {
      mimeType = fileBase64.split(';')[0].split(':')[1]
    }
    if (!mimeType) {
      mimeType = 'image/jpeg'
    }

    console.log('[ID Scanner] Processing document:', { mimeType, documentType, model: OCR_MODEL })

    // Prompt optimizado para extraer datos de documentos de identidad (conciso para respuesta rápida)
    const prompt = `Extrae datos de este documento de identidad (cédula/pasaporte/licencia).

Responde SOLO con JSON válido:
{
  "fullName": "nombre completo",
  "firstName": "primer nombre",
  "lastName": "apellidos",
  "documentType": "cedula|passport|license|unknown",
  "documentNumber": "número",
  "dateOfBirth": "YYYY-MM-DD o null",
  "expiryDate": "YYYY-MM-DD o null",
  "nationality": "nacionalidad o null",
  "address": "dirección o null",
  "gender": "M|F|null",
  "issuingCountry": "país emisor",
  "confidence": 0.0-1.0
}

Nota: Cédula cubana tiene 11 dígitos (AAMMDDXXXXXC). Sin markdown, solo JSON.`

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
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 500))
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
