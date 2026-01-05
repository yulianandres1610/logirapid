import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { uploadProductImageWithIndex, getNextImageIndex } from '@/lib/product-images'
import {
  cleanProductImage,
  generateProductImage,
  enhanceProductImage,
  analyzeProductImage,
  isGeminiConfigured
} from '@/lib/gemini'

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

/**
 * POST /api/ai/process-image
 * Procesa una imagen con Google Gemini AI
 *
 * Body:
 * - imageBase64: string (imagen en base64)
 * - barcode: string
 * - action: 'clean' | 'generate' | 'enhance' | 'analyze'
 * - productName?: string (requerido para 'generate')
 * - productDescription?: string (opcional para 'generate')
 * - saveToStorage: boolean (default true)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Verificar si Gemini esta configurado
    if (!isGeminiConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Google Gemini AI no esta configurado. Agrega GOOGLE_AI_API_KEY en las variables de entorno.'
      }, { status: 503 })
    }

    const body = await request.json()
    const {
      imageBase64,
      barcode,
      action,
      productName,
      productDescription,
      saveToStorage = true
    } = body

    // Validaciones
    if (!action || !['clean', 'generate', 'enhance', 'analyze'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Accion invalida. Use: clean, generate, enhance o analyze'
      }, { status: 400 })
    }

    if (action === 'generate' && !productName) {
      return NextResponse.json({
        success: false,
        error: 'productName es requerido para generar imagen'
      }, { status: 400 })
    }

    if (['clean', 'enhance', 'analyze'].includes(action) && !imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'imageBase64 es requerido para esta accion'
      }, { status: 400 })
    }

    // Si quiere guardar pero no tiene barcode, no guardamos pero si generamos
    const shouldSave = saveToStorage && barcode && barcode.trim() !== ''

    console.log(`[AI Process Image] Action: ${action}, Barcode: ${barcode || 'N/A'}`)

    let result: any

    switch (action) {
      case 'clean':
        result = await cleanProductImage(imageBase64)
        break

      case 'generate':
        result = await generateProductImage(productName, productDescription)
        break

      case 'enhance':
        result = await enhanceProductImage(imageBase64)
        break

      case 'analyze':
        result = await analyzeProductImage(imageBase64)
        break
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error al procesar imagen'
      }, { status: 500 })
    }

    // Si hay imagen procesada y se debe guardar
    let savedImage = null
    if (shouldSave && result.imageBase64) {
      try {
        const imageBuffer = Buffer.from(result.imageBase64, 'base64')
        // Detectar tipo de imagen desde los primeros bytes
        let contentType = 'image/jpeg' // Default
        if (result.imageBase64.startsWith('iVBORw0KGgo')) {
          contentType = 'image/png'
        } else if (result.imageBase64.startsWith('R0lGOD')) {
          contentType = 'image/gif'
        } else if (result.imageBase64.startsWith('UklGR')) {
          contentType = 'image/webp'
        }

        // Obtener el siguiente índice disponible
        const imageIndex = await getNextImageIndex(barcode)
        const isPrimary = imageIndex === 1

        console.log(`[AI Process Image] Saving image with content type: ${contentType}, index: ${imageIndex}`)

        const { url, path, index } = await uploadProductImageWithIndex(
          barcode,
          imageBuffer,
          contentType
        )

        // Guardar en base de datos
        await db.query(`
          INSERT INTO product_images (
            barcode, image_index, storage_path, image_url, is_primary,
            processed_with_ai, ai_model, content_type, file_size, created_by, company_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (barcode, image_index) DO UPDATE SET
            storage_path = EXCLUDED.storage_path,
            image_url = EXCLUDED.image_url,
            is_primary = EXCLUDED.is_primary,
            processed_with_ai = true,
            ai_model = EXCLUDED.ai_model,
            updated_at = NOW()
        `, [
          barcode,
          index,
          path,
          url,
          isPrimary,
          true,
          'gemini-3-pro-image-preview',
          contentType,
          imageBuffer.length,
          payload.userId,
          payload.companyId
        ])

        savedImage = { url, path, index, isPrimary }
        console.log(`[AI Process Image] Saved to storage: ${url}, index: ${index}`)
      } catch (saveError) {
        console.error('[AI Process Image] Error saving image:', saveError)
        // Continuar sin guardar
      }
    }

    // Construir respuesta segun la accion
    const response: any = {
      success: true,
      action,
      barcode: barcode || null
    }

    switch (action) {
      case 'clean':
        response.data = {
          description: result.description,
          imageUrl: savedImage?.url || null,
          wasProcessed: !!result.imageBase64
        }
        break

      case 'generate':
        response.data = {
          imageDescription: result.imageDescription,
          imageUrl: savedImage?.url || null,
          // Si no se guardó, devolver base64 para preview
          imageBase64: !savedImage && result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : null,
          generated: !!result.imageBase64
        }
        break

      case 'enhance':
        response.data = {
          qualityScore: result.qualityScore,
          suggestions: result.suggestions,
          imageUrl: savedImage?.url || null,
          wasEnhanced: !!result.imageBase64
        }
        break

      case 'analyze':
        response.data = {
          product: result.product
        }
        break
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[AI Process Image] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar imagen'
    }, { status: 500 })
  }
}

/**
 * GET /api/ai/process-image
 * Verifica si Gemini AI esta configurado
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    configured: isGeminiConfigured(),
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    actions: ['clean', 'generate', 'enhance', 'analyze']
  })
}
