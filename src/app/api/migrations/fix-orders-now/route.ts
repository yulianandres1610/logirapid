import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/migrations/fix-orders-now
 * One-time migration to fix remittance orders with NULL selling_company_id
 * Assigns them to company ID 7 (Hola Packs)
 */
export async function GET(request: NextRequest) {
  try {
    // Check for secret key to prevent unauthorized access
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key !== 'fix-orders-2024') {
      return NextResponse.json({
        success: false,
        error: 'Invalid key'
      }, { status: 403 })
    }

    // First, check current state
    const beforeCheck = await db.query(`
      SELECT id, order_number, selling_company_id, sold_by_user_id, created_at
      FROM remittance_orders
      ORDER BY created_at DESC
    `)

    console.log('[Migration] Current orders:', beforeCheck.rows)

    // Fix orders with NULL selling_company_id - assign to company 7 (Hola Packs)
    const fixResult = await db.query(`
      UPDATE remittance_orders
      SET selling_company_id = 7
      WHERE selling_company_id IS NULL
      RETURNING id, order_number
    `)

    console.log('[Migration] Fixed orders:', fixResult.rows)

    // Also fix any orders where selling_company_id doesn't match the user's company
    const fixMismatchResult = await db.query(`
      UPDATE remittance_orders ro
      SET selling_company_id = uc.companyid
      FROM user_companies uc
      WHERE ro.sold_by_user_id = uc.userid
        AND ro.selling_company_id IS DISTINCT FROM uc.companyid
        AND uc.companyid IS NOT NULL
      RETURNING ro.id, ro.order_number, ro.selling_company_id
    `)

    console.log('[Migration] Fixed mismatched orders:', fixMismatchResult.rows)

    // Verify final state
    const afterCheck = await db.query(`
      SELECT id, order_number, selling_company_id, sold_by_user_id, created_at
      FROM remittance_orders
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      data: {
        before: beforeCheck.rows,
        fixedNullCompany: fixResult.rows,
        fixedMismatch: fixMismatchResult.rows,
        after: afterCheck.rows,
        summary: {
          totalOrders: afterCheck.rows.length,
          fixedNull: fixResult.rows.length,
          fixedMismatch: fixMismatchResult.rows.length
        }
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en la migración'
    }, { status: 500 })
  }
}
