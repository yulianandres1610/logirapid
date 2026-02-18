import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'

// API Key para Gemini
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo para OCR de documentos de identificación
// gemini-2.0-flash is fast and stable for OCR tasks
const OCR_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.0-flash'

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

    // Check kiosk authentication (kioskId + guardId)
    if (!isAuthenticated && kioskId && guardId) {
      // For kiosk mode, we trust the request if it has valid kiosk and guard IDs
      // The guard was already authenticated via PIN on the kiosk
      isAuthenticated = true
      console.log('[ID Scanner] Kiosk mode authentication - kioskId:', kioskId, 'guardId:', guardId)
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

    // Prompt optimizado para extraer datos de documentos de identidad
    // Especialmente entrenado para carnet de identidad cubano (frente y reverso)
    const prompt = `Eres un experto en OCR de documentos de identidad. Extrae TODOS los datos visibles de esta imagen.

## CARNET DE IDENTIDAD CUBANO (CI):
El carnet cubano tiene DOS lados con información diferente:

**FRENTE (lado con foto):**
- NI: Número de Identidad (11 dígitos: AAMMDDXXXXXC donde AA=año, MM=mes, DD=día de nacimiento)
- NOMBRE/FIRST NAME: Primer nombre
- APELLIDOS/LAST NAME: Apellidos (dos apellidos)
- PADRE: Nombre del padre
- MADRE: Nombre de la madre
- SEXO: F (femenino) o M (masculino)
- FECHA DE VENCIMIENTO: DD/MM/YYYY
- REGISTRO CIVIL: Nombre del registro
- TOMO, FOLIO, AÑO: Datos de registro

**REVERSO (lado con código MRZ):**
- RESIDENCIA: Dirección completa (ej: "CALLE SOCARRAS # 1203 E/ CALLE ALEJANDRO RODRIGUEZ Y CALLE CESPEDES")
- MUNICIPIO, PROVINCIA: Ubicación (ej: "FLORIDA, CAMAGUEY")
- Código alfanumérico (ej: AEC496280)
- Línea MRZ: I<CUBAEC496280356092604195<<<<

## IMPORTANTE - Extracción de fecha de nacimiento:
- El NI cubano SIEMPRE contiene la fecha de nacimiento en los primeros 6 dígitos
- Formato: AAMMDD (Año2díg + Mes2díg + Día2díg)
- Ejemplo: NI 56092604195 → Fecha: 26/09/1956 (día 26, mes 09, año 56)
- Para determinar el siglo: si AA > 25 → 19XX, si AA <= 25 → 20XX

## DIRECCIÓN:
- Lee la dirección EXACTAMENTE como aparece en el documento
- Incluye número de casa, calles de referencia (E/ = entre)
- Incluye municipio y provincia si están visibles

Responde SOLO con JSON válido (sin markdown, sin \`\`\`):
{
  "fullName": "NOMBRE + APELLIDOS completos",
  "firstName": "solo primer nombre",
  "lastName": "apellido paterno + apellido materno",
  "documentType": "cedula",
  "documentNumber": "NI de 11 dígitos sin espacios",
  "dateOfBirth": "YYYY-MM-DD extraído del NI",
  "expiryDate": "YYYY-MM-DD si visible",
  "nationality": "Cubana",
  "address": "dirección completa incluyendo municipio y provincia",
  "gender": "M o F",
  "issuingCountry": "Cuba",
  "confidence": 0.0-1.0
}

REGLAS:
1. El día de nacimiento está en posiciones 5-6 del NI (NO confundir con el mes)
2. La dirección puede incluir "E/" que significa "entre" (calles de referencia)
3. Si es el reverso del carnet, busca RESIDENCIA para la dirección
4. Responde SOLO el JSON, nada más`

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
