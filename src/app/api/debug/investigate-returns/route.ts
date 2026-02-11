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
 * GET /api/debug/investigate-returns?orderId=7
 * Comprehensive investigation of return discrepancies
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })
    }

    // 1. Get all order lines with product names
    const orderLines = await db.query(`
      SELECT
        ol.id as order_line_id,
        ol.product_id,
        p.name as product_name,
        ol.quantity_ordered,
        ol.quantity_received,
        ol.quantity_sold,
        ol.quantity_returned
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = $1
      ORDER BY ol.id
    `, [orderId])

    // 2. Get all returns and their lines with product names
    const returns = await db.query(`
      SELECT
        r.id as return_id,
        r.return_number,
        r.status,
        r.total_units,
        r.total_value,
        r.reason,
        r.created_at,
        r.validated_at
      FROM consignment_returns r
      WHERE r.order_id = $1
      ORDER BY r.created_at
    `, [orderId])

    // 3. Get return lines with product names
    const returnLines = await db.query(`
      SELECT
        rl.id as return_line_id,
        rl.return_id,
        r.return_number,
        r.status as return_status,
        rl.order_line_id,
        rl.product_id,
        p.name as product_name,
        rl.quantity_to_return,
        rl.quantity_validated,
        rl.lot_inventory_id
      FROM consignment_return_lines rl
      JOIN consignment_returns r ON r.id = rl.return_id
      JOIN market_products p ON p.id = rl.product_id
      WHERE r.order_id = $1
      ORDER BY rl.return_id, rl.id
    `, [orderId])

    // 4. Get lot inventory with product names
    const lots = await db.query(`
      SELECT
        li.id as lot_id,
        li.order_line_id,
        li.product_id,
        p.name as product_name,
        li.quantity_initial,
        li.quantity_available,
        li.quantity_sold,
        li.quantity_returned
      FROM consignment_lot_inventory li
      JOIN market_products p ON p.id = li.product_id
      WHERE li.order_line_id IN (SELECT id FROM consignment_order_lines WHERE order_id = $1)
      ORDER BY li.id
    `, [orderId])

    // 5. Get ALL inventory movements for products in this order (not just returns)
    const productIds = orderLines.rows.map((ol: { product_id: number }) => ol.product_id)
    let movements: { rows: unknown[] } = { rows: [] }

    if (productIds.length > 0) {
      movements = await db.query(`
        SELECT
          m.id,
          m.product_id,
          p.name as product_name,
          m.movement_type,
          m.quantity,
          m.quantity_before,
          m.quantity_after,
          m.reference_type,
          m.reference_id,
          m.notes,
          m.created_at
        FROM market_inventory_movements m
        JOIN market_products p ON p.id = m.product_id
        WHERE m.product_id = ANY($1::int[])
        ORDER BY m.created_at DESC
        LIMIT 50
      `, [productIds])
    }

    // 6. Find products with name containing "perla"
    const perlasProducts = await db.query(`
      SELECT id, name, sku FROM market_products
      WHERE LOWER(name) LIKE '%perla%'
      LIMIT 10
    `)

    // 7. Check if any perlas products are in return lines
    const perlasInReturns = await db.query(`
      SELECT
        rl.*,
        p.name as product_name,
        r.return_number,
        r.status as return_status,
        r.order_id
      FROM consignment_return_lines rl
      JOIN market_products p ON p.id = rl.product_id
      JOIN consignment_returns r ON r.id = rl.return_id
      WHERE LOWER(p.name) LIKE '%perla%'
    `)

    // 8. Summary analysis
    const analysis = {
      totalOrderLines: orderLines.rows.length,
      totalReturns: returns.rows.length,
      totalReturnLines: returnLines.rows.length,
      productsInOrder: orderLines.rows.map((ol: { product_name: string; product_id: number; quantity_returned: number }) => ({
        name: ol.product_name,
        id: ol.product_id,
        returned: ol.quantity_returned
      })),
      productsInReturnLines: returnLines.rows.map((rl: { product_name: string; product_id: number; quantity_validated: number; return_number: string; return_status: string }) => ({
        name: rl.product_name,
        id: rl.product_id,
        quantityValidated: rl.quantity_validated,
        returnNumber: rl.return_number,
        returnStatus: rl.return_status
      })),
      discrepancies: [] as string[]
    }

    // Check for discrepancies
    const orderProductIds = new Set(orderLines.rows.map((ol: { product_id: number }) => ol.product_id))
    for (const rl of returnLines.rows as { product_id: number; product_name: string; return_number: string }[]) {
      if (!orderProductIds.has(rl.product_id)) {
        analysis.discrepancies.push(`Product "${rl.product_name}" (ID: ${rl.product_id}) in return ${rl.return_number} is NOT in order ${orderId}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderLines: orderLines.rows,
        returns: returns.rows,
        returnLines: returnLines.rows,
        lots: lots.rows,
        movements: movements.rows,
        perlasProducts: perlasProducts.rows,
        perlasInReturns: perlasInReturns.rows,
        analysis
      }
    })

  } catch (error) {
    console.error('[Investigate Returns] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/debug/investigate-returns
 * Fix return discrepancies
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { action, orderId, productIds } = await request.json()
    const results: string[] = []

    if (action === 'remove_invalid_return_lines') {
      // Remove return lines for products that don't belong to the order
      const orderProductIds = await db.query(`
        SELECT product_id FROM consignment_order_lines WHERE order_id = $1
      `, [orderId])

      const validProductIds = new Set(orderProductIds.rows.map((r: { product_id: number }) => r.product_id))

      // Find invalid return lines
      const invalidLines = await db.query(`
        SELECT rl.id, rl.product_id, p.name, r.return_number
        FROM consignment_return_lines rl
        JOIN consignment_returns r ON r.id = rl.return_id
        JOIN market_products p ON p.id = rl.product_id
        WHERE r.order_id = $1
      `, [orderId])

      for (const line of invalidLines.rows as { id: number; product_id: number; name: string; return_number: string }[]) {
        if (!validProductIds.has(line.product_id)) {
          await db.query('DELETE FROM consignment_return_lines WHERE id = $1', [line.id])
          results.push(`Deleted invalid return line for "${line.name}" from return ${line.return_number}`)
        }
      }
    }

    if (action === 'fix_movements' && productIds && Array.isArray(productIds)) {
      // Delete incorrect movements for specified products
      for (const productId of productIds) {
        const deleted = await db.query(`
          DELETE FROM market_inventory_movements
          WHERE product_id = $1
            AND reference_type = 'consignment_return'
            AND reference_id IN (SELECT id FROM consignment_returns WHERE order_id = $2)
          RETURNING id
        `, [productId, orderId])

        if (deleted.rows.length > 0) {
          results.push(`Deleted ${deleted.rows.length} incorrect movements for product ${productId}`)
        }
      }
    }

    if (action === 'recalculate_order_totals') {
      // Recalculate order total_returned based on actual return lines
      const totalResult = await db.query(`
        SELECT COALESCE(SUM(rl.quantity_validated * rl.unit_cost), 0) as total_returned_value
        FROM consignment_return_lines rl
        JOIN consignment_returns r ON r.id = rl.return_id
        WHERE r.order_id = $1 AND r.status = 'completed'
      `, [orderId])

      const totalReturned = parseFloat(totalResult.rows[0]?.total_returned_value) || 0

      await db.query(`
        UPDATE consignment_orders SET total_returned = $1 WHERE id = $2
      `, [totalReturned, orderId])

      results.push(`Recalculated order ${orderId} total_returned to ${totalReturned}`)
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('[Fix Returns] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
