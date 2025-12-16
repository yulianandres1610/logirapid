import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/orders-status
 * Debug endpoint to see all remittance orders and their company assignments
 */
export async function GET(request: NextRequest) {
  try {
    // Get all orders with company info
    const ordersResult = await db.query(`
      SELECT
        ro.id,
        ro.order_number,
        ro.status,
        ro.selling_company_id,
        sc.legalname as selling_company_name,
        ro.broker_company_id,
        bc.legalname as broker_company_name,
        ro.recipient_province,
        ro.recipient_municipality,
        ro.receive_amount,
        ro.receive_currency,
        ro.created_at
      FROM remittance_orders ro
      LEFT JOIN companies sc ON ro.selling_company_id = sc.id
      LEFT JOIN companies bc ON ro.broker_company_id = bc.id
      ORDER BY ro.created_at DESC
      LIMIT 20
    `)

    // Get all companies
    const companiesResult = await db.query(`
      SELECT id, legalname, companytype, broker_is_active, broker_province, broker_municipality
      FROM companies
      ORDER BY id
    `)

    // Get brokers specifically
    const brokersResult = await db.query(`
      SELECT
        c.id,
        c.legalname,
        c.broker_province,
        c.broker_municipality,
        c.broker_is_active,
        bwb.currency,
        bwb.available_balance,
        bwb.reserved_balance
      FROM companies c
      LEFT JOIN broker_wallet_balances bwb ON c.id = bwb.company_id
      WHERE c.companytype = 'broker'
      ORDER BY c.id
    `)

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersResult.rows,
        ordersCount: ordersResult.rows.length,
        companies: companiesResult.rows,
        brokers: brokersResult.rows,
        summary: {
          totalOrders: ordersResult.rows.length,
          ordersWithSellingCompany: ordersResult.rows.filter(o => o.selling_company_id).length,
          ordersWithBroker: ordersResult.rows.filter(o => o.broker_company_id).length,
          ordersWithoutBroker: ordersResult.rows.filter(o => !o.broker_company_id).length
        }
      }
    })

  } catch (error) {
    console.error('[Debug Orders Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
