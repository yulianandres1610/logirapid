import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { getProductImageByBarcode } from '@/lib/product-images'

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
 * Busca si existe una imagen para un codigo de barras
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

    // Buscar en la tabla product_images primero
    const dbResult = await db.query(`
      SELECT
        id, barcode, image_url, usage_count, created_at
      FROM product_images
      WHERE barcode = $1
    `, [barcode])

    if (dbResult.rows.length > 0) {
      const image = dbResult.rows[0]

      return NextResponse.json({
        success: true,
        found: true,
        data: {
          imageUrl: image.image_url,
          barcode: image.barcode,
          usedBy: image.usage_count || 1,
          createdAt: image.created_at,
          source: 'database'
        }
      })
    }

    // Si no esta en la base de datos, buscar directamente en storage
    const storageUrl = await getProductImageByBarcode(barcode)

    if (storageUrl) {
      return NextResponse.json({
        success: true,
        found: true,
        data: {
          imageUrl: storageUrl,
          barcode: barcode,
          usedBy: 1,
          source: 'storage'
        }
      })
    }

    // No se encontro imagen
    return NextResponse.json({
      success: true,
      found: false,
      barcode: barcode
    })

  } catch (error) {
    console.error('[Image By Barcode] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar imagen'
    }, { status: 500 })
  }
}
