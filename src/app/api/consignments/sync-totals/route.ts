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
 * POST /api/consignments/sync-totals
 * Recalcula y sincroniza total_sold de todas las órdenes de consignación
 * desde las líneas de detalle. Útil para corregir datos históricos.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Only allow ADMIN or SUPER_ADMIN
    if (!['ADMIN', 'SUPER_ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para esta operación'
      }, { status: 403 })
    }

    console.log('[Consignment Sync] Starting total_sold sync for company:', payload.companyId)

    // Update all consignment_orders.total_sold from their line items
    const result = await db.query(`
      UPDATE consignment_orders o
      SET
        total_sold = COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          WHERE ol.order_id = o.id
        ), 0),
        updated_at = NOW()
      WHERE o.company_id = $1
      RETURNING id, order_number, total_sold
    `, [payload.companyId])

    const updatedOrders = result.rows.length
    const totalSynced = result.rows.reduce((sum, r) => sum + parseFloat(r.total_sold || 0), 0)

    console.log('[Consignment Sync] Completed:', {
      companyId: payload.companyId,
      updatedOrders,
      totalSynced
    })

    return NextResponse.json({
      success: true,
      message: `Se sincronizaron ${updatedOrders} órdenes de consignación`,
      data: {
        ordersUpdated: updatedOrders,
        totalSoldSynced: totalSynced,
        orders: result.rows.map(r => ({
          id: r.id,
          orderNumber: r.order_number,
          totalSold: parseFloat(r.total_sold)
        }))
      }
    })

  } catch (error) {
    console.error('[Consignment Sync] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar totales'
    }, { status: 500 })
  }
}

/**
 * GET /api/consignments/sync-totals
 * Verifica el estado de sincronización sin modificar datos
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Get orders with mismatched totals
    const mismatchResult = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_sold as stored_total_sold,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          WHERE ol.order_id = o.id
        ), 0) as calculated_total_sold
      FROM consignment_orders o
      WHERE o.company_id = $1
        AND COALESCE(o.total_sold, 0) != COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          WHERE ol.order_id = o.id
        ), 0)
      ORDER BY o.created_at DESC
    `, [payload.companyId])

    const totalOrdersResult = await db.query(`
      SELECT COUNT(*) as count FROM consignment_orders WHERE company_id = $1
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: parseInt(totalOrdersResult.rows[0].count),
        ordersNeedingSync: mismatchResult.rows.length,
        mismatchedOrders: mismatchResult.rows.map(r => ({
          id: r.id,
          orderNumber: r.order_number,
          storedTotalSold: parseFloat(r.stored_total_sold) || 0,
          calculatedTotalSold: parseFloat(r.calculated_total_sold) || 0,
          difference: (parseFloat(r.calculated_total_sold) || 0) - (parseFloat(r.stored_total_sold) || 0)
        }))
      }
    })

  } catch (error) {
    console.error('[Consignment Sync Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar sincronización'
    }, { status: 500 })
  }
}
