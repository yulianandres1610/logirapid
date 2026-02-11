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
 * GET /api/debug/consignment-returns?orderId=7
 * Debug endpoint to check returns data
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

    // Get returns for this order
    const returns = await db.query(`
      SELECT r.*,
        (SELECT json_agg(json_build_object(
          'id', rl.id,
          'order_line_id', rl.order_line_id,
          'product_id', rl.product_id,
          'quantity_to_return', rl.quantity_to_return,
          'quantity_validated', rl.quantity_validated,
          'lot_inventory_id', rl.lot_inventory_id
        )) FROM consignment_return_lines rl WHERE rl.return_id = r.id) as lines
      FROM consignment_returns r
      WHERE r.order_id = $1
      ORDER BY r.created_at
    `, [orderId])

    // Get order lines with returned quantities
    const orderLines = await db.query(`
      SELECT ol.id, ol.product_id, ol.quantity_ordered, ol.quantity_received,
             ol.quantity_sold, ol.quantity_returned,
             p.name as product_name
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = $1
    `, [orderId])

    // Get lot inventory for this order
    const lots = await db.query(`
      SELECT li.id, li.product_id, li.order_line_id, li.quantity_initial,
             li.quantity_available, li.quantity_sold, li.quantity_returned,
             p.name as product_name
      FROM consignment_lot_inventory li
      JOIN market_products p ON p.id = li.product_id
      WHERE li.order_line_id IN (SELECT id FROM consignment_order_lines WHERE order_id = $1)
    `, [orderId])

    // Get inventory movements for returns
    const movements = await db.query(`
      SELECT * FROM market_inventory_movements
      WHERE reference_type = 'consignment_return'
      AND reference_id IN (SELECT id FROM consignment_returns WHERE order_id = $1)
      ORDER BY created_at
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        returns: returns.rows,
        orderLines: orderLines.rows,
        lots: lots.rows,
        movements: movements.rows
      }
    })

  } catch (error) {
    console.error('[Debug Returns] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/debug/consignment-returns
 * Fix corrupted return data
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { orderId, fixes } = await request.json()

    if (!orderId || !fixes) {
      return NextResponse.json({ success: false, error: 'orderId and fixes required' }, { status: 400 })
    }

    const results: string[] = []

    // Fix order line quantity_returned
    if (fixes.orderLineId && fixes.correctQuantityReturned !== undefined) {
      await db.query(`
        UPDATE consignment_order_lines
        SET quantity_returned = $1
        WHERE id = $2
      `, [fixes.correctQuantityReturned, fixes.orderLineId])
      results.push(`Updated order line ${fixes.orderLineId} quantity_returned to ${fixes.correctQuantityReturned}`)
    }

    // Fix lot inventory
    if (fixes.lotId && fixes.correctLotAvailable !== undefined) {
      await db.query(`
        UPDATE consignment_lot_inventory
        SET quantity_available = $1, quantity_returned = $2
        WHERE id = $3
      `, [fixes.correctLotAvailable, fixes.correctLotReturned || 0, fixes.lotId])
      results.push(`Updated lot ${fixes.lotId} quantity_available to ${fixes.correctLotAvailable}`)
    }

    // Fix warehouse stock
    if (fixes.warehouseId && fixes.productId && fixes.correctStock !== undefined) {
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = $1
        WHERE warehouse_id = $2 AND product_id = $3
      `, [fixes.correctStock, fixes.warehouseId, fixes.productId])
      results.push(`Updated warehouse stock for product ${fixes.productId} to ${fixes.correctStock}`)
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('[Debug Returns Fix] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
