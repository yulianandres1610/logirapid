import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/consignment-v3-user-link
 * Agrega user_id a proveedores para usar login unificado
 */
export async function POST() {
  try {
    console.log('[Migration] Starting consignment v3 user link migration...')

    // Add user_id column to consignment_suppliers
    try {
      await db.query(`
        ALTER TABLE consignment_suppliers
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
      `)
      console.log('[Migration] Added user_id column')
    } catch (error) {
      console.log('[Migration] user_id column may already exist:', error)
    }

    // Create index for user_id
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_consignment_suppliers_user
        ON consignment_suppliers(user_id)
      `)
      console.log('[Migration] Created user_id index')
    } catch (error) {
      console.log('[Migration] Index may already exist:', error)
    }

    // Drop old username/password columns (optional - keep for backwards compatibility)
    // We'll just ignore them going forward
    console.log('[Migration] Keeping username/password_hash columns for backwards compatibility')

    console.log('[Migration] Consignment v3 user link migration completed')

    return NextResponse.json({
      success: true,
      message: 'Migration completed - proveedores ahora pueden usar login unificado'
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
