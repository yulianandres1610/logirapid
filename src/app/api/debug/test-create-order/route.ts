import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/debug/test-create-order
 * Test endpoint to create a simple order and verify it persists
 */
export async function POST(request: NextRequest) {
  try {
    // Create order using db.transaction
    const result = await db.transaction(async (client) => {
      // Generate order number
      const orderNumResult = await client.query('SELECT generate_remittance_order_number() as order_number')
      const orderNumber = orderNumResult.rows[0].order_number

      // Simple INSERT
      const insertResult = await client.query(`
        INSERT INTO remittance_orders (
          order_number,
          selling_company_id, sold_by_user_id,
          broker_company_id, broker_province, broker_municipality,
          product_name, service_type,
          send_amount, send_currency, receive_amount, receive_currency, exchange_rate,
          service_fee, service_fee_percentage, delivery_fee, total_charged,
          recipient_name, recipient_phone,
          recipient_province, recipient_municipality,
          sender_name,
          status, payment_status, estimated_delivery
        ) VALUES (
          $1, 7, 1, 23, 'Villa-clara', 'Santa-clara',
          'Test Order', 'remittance',
          100, 'USD', 42460, 'CUP', 424.60,
          5, 5, 0, 105,
          'Test Recipient', '+5312345678',
          'Villa-clara', 'Santa-clara',
          'Test Sender',
          'pending', 'pending', '1-3 días'
        )
        RETURNING *
      `, [orderNumber])

      const order = insertResult.rows[0]

      // Verify within transaction
      const verify = await client.query(
        'SELECT id, order_number FROM remittance_orders WHERE id = $1',
        [order.id]
      )

      return {
        order,
        verifiedWithinTx: verify.rows.length > 0
      }
    })

    // Verify AFTER transaction with a new connection
    const verifyAfter = await db.query(
      'SELECT id, order_number, selling_company_id, broker_company_id FROM remittance_orders WHERE id = $1',
      [result.order.id]
    )

    // Count total orders
    const countResult = await db.query('SELECT COUNT(*) as total FROM remittance_orders')

    return NextResponse.json({
      success: true,
      data: {
        created: {
          id: result.order.id,
          orderNumber: result.order.order_number,
          sellingCompanyId: result.order.selling_company_id,
          brokerCompanyId: result.order.broker_company_id
        },
        verifiedWithinTransaction: result.verifiedWithinTx,
        verifiedAfterCommit: verifyAfter.rows.length > 0,
        verifyData: verifyAfter.rows[0] || null,
        totalOrdersInDb: parseInt(countResult.rows[0].total)
      }
    })

  } catch (error) {
    console.error('[Test Create Order] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * GET /api/debug/test-create-order
 * Just shows all orders without creating
 */
export async function GET(request: NextRequest) {
  try {
    const result = await db.query(`
      SELECT id, order_number, selling_company_id, broker_company_id, status, created_at
      FROM remittance_orders
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      totalOrders: result.rows.length,
      orders: result.rows
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
