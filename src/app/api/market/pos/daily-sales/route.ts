import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/pos/daily-sales
 * Obtiene las ventas del día (sesión) agrupadas por producto
 *
 * Query params:
 * - sessionId: ID de la sesión POS
 * - warehouseId: ID del almacén (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const warehouseId = searchParams.get('warehouseId')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId es requerido'
      }, { status: 400 })
    }

    // Verificar que la sesión pertenece a la compañía del usuario
    const sessionCheck = await db.query(`
      SELECT s.id, s.company_id, t.warehouse_id
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      WHERE s.id = $1
    `, [sessionId])

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = sessionCheck.rows[0]

    if (payload.role !== 'SUPER_ADMIN' && session.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para acceder a esta sesión'
      }, { status: 403 })
    }

    const effectiveWarehouseId = warehouseId || session.warehouse_id

    // Obtener ventas del día agrupadas por producto
    const salesResult = await db.query(`
      SELECT
        ol.product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.selling_price as unit_price,
        SUM(ol.quantity) as total_sold,
        SUM(ol.quantity * ol.unit_price) as total_amount
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      JOIN market_products p ON ol.product_id = p.id
      WHERE o.pos_session_id = $1
        AND o.status IN ('paid', 'completed')
      GROUP BY ol.product_id, p.name, p.sku, p.barcode, p.selling_price
      ORDER BY total_sold DESC
    `, [sessionId])

    // Obtener el stock actual de cada producto en el almacén
    const productIds = salesResult.rows.map(r => r.product_id)

    let stockData: Record<number, number> = {}

    if (productIds.length > 0 && effectiveWarehouseId) {
      const stockResult = await db.query(`
        SELECT
          product_id,
          COALESCE(quantity_on_hand, 0) as stock
        FROM market_warehouse_stock
        WHERE warehouse_id = $1
          AND product_id = ANY($2::int[])
      `, [effectiveWarehouseId, productIds])

      stockResult.rows.forEach(row => {
        stockData[row.product_id] = parseFloat(row.stock) || 0
      })
    }

    // Combinar datos de ventas con stock
    const salesWithStock = salesResult.rows.map(sale => ({
      productId: sale.product_id,
      productName: sale.product_name,
      productSku: sale.product_sku,
      productBarcode: sale.product_barcode,
      unitPrice: parseFloat(sale.unit_price) || 0,
      totalSold: parseFloat(sale.total_sold) || 0,
      totalAmount: parseFloat(sale.total_amount) || 0,
      currentStock: stockData[sale.product_id] || 0
    }))

    // Calcular totales
    const totals = {
      totalProducts: salesWithStock.length,
      totalUnitsSold: salesWithStock.reduce((sum, s) => sum + s.totalSold, 0),
      totalSalesAmount: salesWithStock.reduce((sum, s) => sum + s.totalAmount, 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: parseInt(sessionId),
        warehouseId: effectiveWarehouseId ? parseInt(effectiveWarehouseId) : null,
        sales: salesWithStock,
        totals
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Daily Sales] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener ventas del día'
    }, { status: 500 })
  }
}
