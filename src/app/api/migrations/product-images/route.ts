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

    // Create table (sin UNIQUE en barcode para soportar múltiples imágenes)
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        barcode VARCHAR(50) NOT NULL,
        image_index INTEGER DEFAULT 1,
        storage_path VARCHAR(255) NOT NULL,
        image_url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT false,
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

    // Migrar tabla existente si tiene UNIQUE constraint
    try {
      // Quitar UNIQUE constraint de barcode si existe
      await db.query(`
        ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_barcode_key
      `)
      console.log('[Product Images Migration] Removed UNIQUE constraint on barcode')
    } catch (e) {
      console.log('[Product Images Migration] No UNIQUE constraint to remove:', e)
    }

    // Agregar columna image_index si no existe
    try {
      await db.query(`
        ALTER TABLE product_images ADD COLUMN IF NOT EXISTS image_index INTEGER DEFAULT 1
      `)
      console.log('[Product Images Migration] Added image_index column')
    } catch (e) {
      console.log('[Product Images Migration] image_index column already exists:', e)
    }

    // Agregar columna is_primary si no existe
    try {
      await db.query(`
        ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false
      `)
      console.log('[Product Images Migration] Added is_primary column')
    } catch (e) {
      console.log('[Product Images Migration] is_primary column already exists:', e)
    }

    // Actualizar registros existentes: marcar image_index=1 e is_primary=true
    await db.query(`
      UPDATE product_images
      SET image_index = 1, is_primary = true
      WHERE image_index IS NULL OR is_primary IS NULL
    `)
    console.log('[Product Images Migration] Updated existing records')

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

    // Índice compuesto único para barcode + image_index
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_barcode_index
        ON product_images(barcode, image_index)
      `)
      console.log('[Product Images Migration] Created composite unique index')
    } catch (e) {
      console.log('[Product Images Migration] Composite index may already exist:', e)
    }

    // Índice para búsqueda de imagen principal
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_primary
      ON product_images(barcode, is_primary) WHERE is_primary = true
    `)

    console.log('[Product Images Migration] Indexes created')

    return NextResponse.json({
      success: true,
      message: 'Migracion completada exitosamente',
      details: {
        table: 'product_images',
        columns: ['image_index', 'is_primary'],
        indexes: [
          'idx_product_images_barcode',
          'idx_product_images_company',
          'idx_product_images_created',
          'idx_product_images_barcode_index (unique: barcode + image_index)',
          'idx_product_images_primary'
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
