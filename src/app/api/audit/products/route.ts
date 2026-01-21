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
  companyType: string
}

/**
 * GET /api/audit/products
 * Returns products with stock for a specific warehouse
 * Query params: warehouseId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    // Verify user is MARKET_MANAGER from market company
    if (payload.companyType !== 'market' || payload.role !== 'MARKET_MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Acceso denegado. Solo MARKET_MANAGER puede acceder.'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')

    if (!warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId es requerido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]

    // Get all products with stock in this warehouse
    const result = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        p.cost_price,
        p.selling_price,
        COALESCE(mws.quantity_on_hand, 0) as stock
      FROM market_products p
      LEFT JOIN market_warehouse_stock mws ON p.id = mws.product_id AND mws.warehouse_id = $1
      WHERE p.company_id = $2 AND p.is_active = true
      ORDER BY p.name ASC
    `, [warehouseId, payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name
        },
        products: result.rows.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          imageUrl: p.image_url,
          costPrice: parseFloat(p.cost_price) || 0,
          sellingPrice: parseFloat(p.selling_price) || 0,
          stock: parseFloat(p.stock) || 0
        })),
        totalProducts: result.rows.length
      }
    })

  } catch (error) {
    console.error('[Audit Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos'
    }, { status: 500 })
  }
}
