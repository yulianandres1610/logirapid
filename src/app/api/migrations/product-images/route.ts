import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

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
 * GET /api/migrations/product-images
 * Verifica el estado de la migracion de la tabla product_images
 */
export async function GET() {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'product_images'
      )
    `)

    const tableExists = tableCheck.rows[0].exists

    if (!tableExists) {
      return NextResponse.json({
        success: true,
        status: 'pending',
        message: 'La tabla product_images no existe. Ejecute POST para crearla.'
      })
    }

    // Get table info
    const columnCheck = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_images'
      ORDER BY ordinal_position
    `)

    const recordCount = await db.query('SELECT COUNT(*) as count FROM product_images')

    return NextResponse.json({
      success: true,
      status: 'completed',
      table: 'product_images',
      columns: columnCheck.rows,
      recordCount: parseInt(recordCount.rows[0].count)
    })

  } catch (error) {
    console.error('[Product Images Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar migracion'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/product-images
 * Ejecuta la migracion de la tabla product_images
 */
export async function POST() {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    console.log('[Product Images Migration] Starting migration...')

    // Create table
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

    console.log('[Product Images Migration] Table created')

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_barcode
      ON product_images(barcode)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_company
      ON product_images(company_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_created
      ON product_images(created_at DESC)
    `)

    console.log('[Product Images Migration] Indexes created')

    return NextResponse.json({
      success: true,
      message: 'Migracion completada exitosamente',
      details: {
        table: 'product_images',
        indexes: [
          'idx_product_images_barcode',
          'idx_product_images_company',
          'idx_product_images_created'
        ]
      }
    })

  } catch (error) {
    console.error('[Product Images Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al ejecutar migracion'
    }, { status: 500 })
  }
}
