import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'

// API Key para Gemini
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Modelo para OCR de documentos de identificación
const OCR_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'

// Límite de tamaño para imágenes enviadas a Gemini
const GEMINI_MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB en base64
const GEMINI_TARGET_SIZE = 1024 // Redimensionar a max 1024px

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
 * Comprime/redimensiona una imagen si excede el límite de Gemini
 */
async function compressImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')

    // Auto-rotate based on EXIF orientation first
    const rotatedBuffer = await sharp(inputBuffer)
      .rotate() // Auto-rotate based on EXIF
      .toBuffer()

    // Check size after rotation
    const rotatedBase64 = rotatedBuffer.toString('base64')
    if (rotatedBase64.length <= GEMINI_MAX_IMAGE_SIZE) {
      console.log('[ID Scanner] Image size OK after rotation:', Math.round(rotatedBase64.length / 1024), 'KB')
      return rotatedBase64
    }

    console.log('[ID Scanner] Image too large:', Math.round(rotatedBase64.length / 1024), 'KB, compressing...')

    // Obtener metadata para saber dimensiones actuales
    const metadata = await sharp(rotatedBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    // Calcular ratio de redimensionamiento si es necesario
    let resizeOptions = {}
    if (maxDimension > GEMINI_TARGET_SIZE) {
      resizeOptions = {
        width: GEMINI_TARGET_SIZE,
        height: GEMINI_TARGET_SIZE,
        fit: 'inside' as const,
        withoutEnlargement: true
      }
    }

    // Comprimir con calidad reducida progresivamente hasta que quepa
    let quality = 85
    let outputBuffer: Buffer
    let outputBase64: string

    do {
      outputBuffer = await sharp(rotatedBuffer)
        .resize(resizeOptions)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()

      outputBase64 = outputBuffer.toString('base64')
      quality -= 10
    } while (outputBase64.length > GEMINI_MAX_IMAGE_SIZE && quality > 20)

    console.log('[ID Scanner] Compressed to:', Math.round(outputBase64.length / 1024), 'KB (quality:', quality + 10, ')')

    return outputBase64
  } catch (error) {
    console.error('[ID Scanner] Compression error:', error)
    // En caso de error, devolver original
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

    // Compress image if needed
    const compressedBase64 = await compressImageForGemini(fileBase64)

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
    const prompt = `Analiza esta imagen de un documento de identificación y extrae los datos.

TIPOS DE DOCUMENTOS QUE PUEDES ENCONTRAR:
- Cédula de identidad (Cuba, República Dominicana, otros países latinoamericanos)
- Pasaporte (cualquier país)
- Licencia de conducir
- Carnet de identidad

EXTRAE LOS SIGUIENTES DATOS (si están visibles):

1. NOMBRE COMPLETO: El nombre completo de la persona
2. TIPO DE DOCUMENTO: cedula, passport, license
3. NÚMERO DE DOCUMENTO: El número o código del documento
4. FECHA DE NACIMIENTO: En formato YYYY-MM-DD
5. FECHA DE VENCIMIENTO: Si está visible, en formato YYYY-MM-DD
6. NACIONALIDAD: País de nacionalidad
7. DIRECCIÓN: Si está visible
8. GÉNERO: M o F
9. PAÍS EMISOR: País que emitió el documento

INSTRUCCIONES IMPORTANTES:
- Si es una cédula cubana, el número tiene 11 dígitos (los primeros 6 son la fecha de nacimiento: AAMMDD)
- Para pasaportes, busca el número en la parte superior o en la zona MRZ
- Si no puedes leer un campo, usa null
- Evalúa tu confianza de 0 a 1 basado en la claridad de la imagen

Responde ÚNICAMENTE en formato JSON con esta estructura:
{
  "fullName": "nombre completo",
  "firstName": "primer nombre",
  "lastName": "apellidos",
  "documentType": "cedula|passport|license|unknown",
  "documentNumber": "número del documento",
  "dateOfBirth": "YYYY-MM-DD o null",
  "expiryDate": "YYYY-MM-DD o null",
  "nationality": "nacionalidad o null",
  "address": "dirección o null",
  "gender": "M|F o null",
  "issuingCountry": "país emisor",
  "confidence": 0.95
}

IMPORTANTE: Solo responde con el JSON, sin texto adicional, sin markdown.`

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

    console.log('[ID Scanner] Raw response:', text)

    try {
      const extractedData = JSON.parse(text) as IdDocumentData

      // Validate essential fields
      if (!extractedData.fullName && !extractedData.documentNumber) {
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
    } catch (parseError) {
      console.error('[ID Scanner] Parse error:', parseError, 'Text:', text)
      return NextResponse.json({
        success: false,
        error: 'No se pudo interpretar el documento. Intenta con una imagen más clara.'
      }, { status: 422 })
    }

  } catch (error) {
    console.error('[ID Scanner] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar documento'
    }, { status: 500 })
  }
}
