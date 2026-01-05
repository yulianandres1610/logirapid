import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { getAllProductImagesByBarcode, getProductImageByBarcode, ProductImage } from '@/lib/product-images'

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
 * GET /api/products/image-by-barcode?barcode=7501234567890
 * Busca todas las imágenes para un codigo de barras
 * Retorna array de imágenes con la principal marcada
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode || barcode.length < 5) {
      return NextResponse.json({
        success: false,
        error: 'Codigo de barras invalido'
      }, { status: 400 })
    }

    // Buscar en la tabla product_images primero (todas las imágenes)
    const dbResult = await db.query(`
      SELECT
        id, barcode, image_index, image_url, is_primary,
        processed_with_ai, ai_model, content_type, file_size,
        usage_count, created_at
      FROM product_images
      WHERE barcode = $1
      ORDER BY image_index ASC
    `, [barcode])

    if (dbResult.rows.length > 0) {
      const images: ProductImage[] = dbResult.rows.map(row => ({
        id: row.id,
        barcode: row.barcode,
        imageIndex: row.image_index || 1,
        storagePath: '',
        imageUrl: row.image_url,
        isPrimary: row.is_primary ?? (row.image_index === 1),
        processedWithAi: row.processed_with_ai,
        aiModel: row.ai_model,
        contentType: row.content_type,
        fileSize: row.file_size,
        createdAt: row.created_at
      }))

      // Encontrar imagen principal
      const primaryImage = images.find(img => img.isPrimary)?.imageUrl || images[0]?.imageUrl || null

      return NextResponse.json({
        success: true,
        found: true,
        count: images.length,
        data: {
          images,
          primaryImage,
          barcode: barcode,
          source: 'database'
        }
      })
    }

    // Si no esta en la base de datos, buscar directamente en storage
    const storageImages = await getAllProductImagesByBarcode(barcode)

    if (storageImages.length > 0) {
      const primaryImage = storageImages.find(img => img.isPrimary)?.imageUrl || storageImages[0]?.imageUrl || null

      return NextResponse.json({
        success: true,
        found: true,
        count: storageImages.length,
        data: {
          images: storageImages,
          primaryImage,
          barcode: barcode,
          source: 'storage'
        }
      })
    }

    // Fallback: buscar imagen individual (formato antiguo)
    const legacyUrl = await getProductImageByBarcode(barcode)

    if (legacyUrl) {
      const image: ProductImage = {
        barcode,
        imageIndex: 1,
        storagePath: '',
        imageUrl: legacyUrl,
        isPrimary: true
      }

      return NextResponse.json({
        success: true,
        found: true,
        count: 1,
        data: {
          images: [image],
          primaryImage: legacyUrl,
          barcode: barcode,
          source: 'storage-legacy'
        }
      })
    }

    // No se encontro imagen
    return NextResponse.json({
      success: true,
      found: false,
      count: 0,
      data: {
        images: [],
        primaryImage: null,
        barcode: barcode
      }
    })

  } catch (error) {
    console.error('[Image By Barcode] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar imagen'
    }, { status: 500 })
  }
}
