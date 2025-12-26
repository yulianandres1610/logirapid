import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/drop-consignment-tables
 * Elimina todas las tablas del sistema de consignacion
 */
export async function POST() {
  try {
    const droppedTables: string[] = []
    const errors: string[] = []

    // Lista de tablas a eliminar en orden (respeta foreign keys)
    const tables = [
      'consignment_return_items',
      'consignment_returns',
      'consignment_payment_requests',
      'consignment_wallet_transactions',
      'consignment_wallets',
      'consignment_order_items',
      'consignment_orders'
    ]

    for (const table of tables) {
      try {
        await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
        droppedTables.push(table)
      } catch (err) {
        errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tablas de consignacion eliminadas',
      data: {
        droppedTables,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('[Drop Consignment Tables] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar tablas'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/drop-consignment-tables
 * Verifica si las tablas de consignacion existen
 */
export async function GET() {
  try {
    const tables = [
      'consignment_return_items',
      'consignment_returns',
      'consignment_payment_requests',
      'consignment_wallet_transactions',
      'consignment_wallets',
      'consignment_order_items',
      'consignment_orders'
    ]

    const existingTables: string[] = []

    for (const table of tables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        )
      `, [table])

      if (result.rows[0]?.exists) {
        existingTables.push(table)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        existingTables,
        allDropped: existingTables.length === 0
      }
    })

  } catch (error) {
    console.error('[Check Consignment Tables] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar tablas'
    }, { status: 500 })
  }
}
