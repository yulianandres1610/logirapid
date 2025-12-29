import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { uploadProductImageByBarcode } from '@/lib/product-images'
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
 *
 * FormData:
 * - file: File (imagen)
 * - barcode: string
 * - processWithAI: boolean (opcional, default false)
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

    console.log('[Product Image Upload] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
      barcode,
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

    // Subir a Supabase Storage
    const { url, path } = await uploadProductImageByBarcode(
      barcode,
      imageBuffer,
      file.type
    )

    console.log('[Product Image Upload] Uploaded to storage:', { url, path })

    // Crear tabla si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        barcode VARCHAR(50) UNIQUE NOT NULL,
        storage_path VARCHAR(255) NOT NULL,
        image_url TEXT NOT NULL,
        processed_with_ai BOOLEAN DEFAULT false,
        ai_model VARCHAR(50),
        content_type VARCHAR(50) DEFAULT 'image/jpeg',
        file_size INTEGER,
        usage_count INTEGER DEFAULT 1,
        created_by INTEGER,
        company_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Guardar o actualizar en base de datos
    await db.query(`
      INSERT INTO product_images (
        barcode, storage_path, image_url, processed_with_ai,
        ai_model, content_type, file_size, created_by, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (barcode) DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        image_url = EXCLUDED.image_url,
        processed_with_ai = EXCLUDED.processed_with_ai,
        ai_model = EXCLUDED.ai_model,
        content_type = EXCLUDED.content_type,
        file_size = EXCLUDED.file_size,
        usage_count = product_images.usage_count + 1,
        updated_at = NOW()
    `, [
      barcode,
      path,
      url,
      wasProcessed,
      wasProcessed ? 'gemini-2.0-flash-exp' : null,
      file.type,
      file.size,
      payload.userId,
      payload.companyId
    ])

    console.log('[Product Image Upload] Saved to database')

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: url,
        storagePath: path,
        barcode,
        wasProcessed,
        aiProcessing: aiProcessingResult
      },
      message: 'Imagen subida exitosamente'
    })

  } catch (error: any) {
    console.error('[Product Image Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al subir la imagen'
    }, { status: 500 })
  }
}
