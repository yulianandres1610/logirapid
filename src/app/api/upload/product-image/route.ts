import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { uploadProductImageWithIndex, getNextImageIndex } from '@/lib/product-images'
import { cleanProductImage, enhanceProductImage } from '@/lib/gemini'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']

/**
 * POST /api/upload/product-image
 * Sube una imagen de producto usando el barcode como identificador
 * Soporta múltiples imágenes por producto (no sobrescribe, agrega a la galería)
 *
 * FormData:
 * - file: File (imagen)
 * - barcode: string
 * - processWithAI: boolean (opcional, default false)
 * - replaceIndex: number (opcional, para reemplazar imagen específica)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    console.log('[Product Image Upload] Starting upload')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const barcode = formData.get('barcode') as string
    const processWithAI = formData.get('processWithAI') === 'true'
    const replaceIndexStr = formData.get('replaceIndex') as string | null
    const replaceIndex = replaceIndexStr ? parseInt(replaceIndexStr, 10) : undefined

    // Validaciones
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No se proporciono ninguna imagen'
      }, { status: 400 })
    }

    if (!barcode || barcode.length < 5) {
      return NextResponse.json({
        success: false,
        error: 'Codigo de barras invalido'
      }, { status: 400 })
    }

    // Validar tipo de archivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de archivo no permitido. Solo se aceptan PNG, JPG, WEBP y GIF'
      }, { status: 400 })
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'El archivo es demasiado grande. Tamaño maximo: 10MB'
      }, { status: 400 })
    }

    // Obtener el siguiente índice disponible (o usar el especificado para reemplazo)
    const imageIndex = replaceIndex ?? await getNextImageIndex(barcode)
    const isPrimary = imageIndex === 1

    console.log('[Product Image Upload] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
      barcode,
      imageIndex,
      isPrimary,
      processWithAI
    })

    // Convertir a buffer
    const arrayBuffer = await file.arrayBuffer()
    let imageBuffer = Buffer.from(arrayBuffer)
    let wasProcessed = false
    let aiProcessingResult = null

    // Procesar con IA si se solicita
    if (processWithAI && process.env.GOOGLE_AI_API_KEY) {
      try {
        console.log('[Product Image Upload] Processing with Gemini AI...')

        // Convertir a base64 para Gemini
        const base64Image = imageBuffer.toString('base64')

        // Primero analizar y mejorar
        const enhanceResult = await enhanceProductImage(base64Image)

        if (enhanceResult.success) {
          aiProcessingResult = {
            qualityScore: enhanceResult.qualityScore,
            suggestions: enhanceResult.suggestions
          }

          // Si la calidad es baja, intentar limpiar
          if (enhanceResult.qualityScore && enhanceResult.qualityScore < 6) {
            const cleanResult = await cleanProductImage(base64Image)
            if (cleanResult.success && cleanResult.imageBase64) {
              imageBuffer = Buffer.from(cleanResult.imageBase64, 'base64')
              wasProcessed = true
            }
          }
        }

        console.log('[Product Image Upload] AI processing complete:', aiProcessingResult)
      } catch (aiError) {
        console.error('[Product Image Upload] AI processing error:', aiError)
        // Continuar sin procesamiento de IA
      }
    }

    // Subir a Supabase Storage con índice
    const { url, path, index } = await uploadProductImageWithIndex(
      barcode,
      imageBuffer,
      file.type,
      replaceIndex // Usar índice específico si se proporciona
    )

    console.log('[Product Image Upload] Uploaded to storage:', { url, path, index })

    // Guardar en base de datos (INSERT, no upsert para soportar múltiples imágenes)
    await db.query(`
      INSERT INTO product_images (
        barcode, image_index, storage_path, image_url, is_primary,
        processed_with_ai, ai_model, content_type, file_size, created_by, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (barcode, image_index) DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        image_url = EXCLUDED.image_url,
        is_primary = EXCLUDED.is_primary,
        processed_with_ai = EXCLUDED.processed_with_ai,
        ai_model = EXCLUDED.ai_model,
        content_type = EXCLUDED.content_type,
        file_size = EXCLUDED.file_size,
        updated_at = NOW()
    `, [
      barcode,
      index,
      path,
      url,
      isPrimary,
      wasProcessed,
      wasProcessed ? 'gemini-2.0-flash-exp' : null,
      file.type,
      file.size,
      payload.userId,
      payload.companyId
    ])

    console.log('[Product Image Upload] Saved to database, index:', index)

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: url,
        storagePath: path,
        barcode,
        imageIndex: index,
        isPrimary,
        wasProcessed,
        aiProcessing: aiProcessingResult
      },
      message: isPrimary ? 'Imagen principal subida exitosamente' : `Imagen ${index} agregada a la galería`
    })

  } catch (error: any) {
    console.error('[Product Image Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al subir la imagen'
    }, { status: 500 })
  }
}
