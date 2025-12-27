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
 * GET /api/market/warehouses/[id]/supplier-returns/lots
 * Obtiene lotes disponibles de un producto para un proveedor específico
 * Query params: supplierId, search (barcode, sku, or product name)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const search = searchParams.get('search')

    if (!supplierId) {
      return NextResponse.json({
        success: false,
        error: 'supplierId es requerido'
      }, { status: 400 })
    }

    if (!search) {
      return NextResponse.json({
        success: false,
        error: 'Término de búsqueda es requerido'
      }, { status: 400 })
    }

    // First, find the product by barcode, SKU, or name
    const productResult = await db.query(`
      SELECT id, name, sku, barcode
      FROM market_products
      WHERE company_id = $1
        AND (
          barcode = $2
          OR sku = $2
          OR LOWER(name) LIKE LOWER($3)
        )
      LIMIT 1
    `, [payload.companyId, search.trim(), `%${search.trim()}%`])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          productId: null,
          productName: null,
          sku: null,
          barcode: null,
          lots: []
        }
      })
    }

    const product = productResult.rows[0]

    // Get lots for this product from this supplier
    const lotsResult = await db.query(`
      SELECT
        cli.id as lot_inventory_id,
        cli.lot_number,
        cli.expiration_date,
        cli.quantity_available,
        cli.unit_cost,
        cli.received_at,
        cli.order_line_id,
        col.order_id,
        co.order_number
      FROM consignment_lot_inventory cli
      JOIN consignment_order_lines col ON col.id = cli.order_line_id
      JOIN consignment_orders co ON co.id = col.order_id
      WHERE cli.warehouse_id = $1
        AND cli.product_id = $2
        AND cli.supplier_id = $3
        AND cli.company_id = $4
        AND cli.quantity_available > 0
      ORDER BY cli.received_at ASC
    `, [warehouseId, product.id, parseInt(supplierId), payload.companyId])

    const lots = lotsResult.rows.map(row => ({
      lotInventoryId: parseInt(row.lot_inventory_id),
      lotNumber: row.lot_number,
      expirationDate: row.expiration_date,
      quantityAvailable: parseInt(row.quantity_available),
      unitCost: parseFloat(row.unit_cost),
      receivedAt: row.received_at,
      orderLineId: parseInt(row.order_line_id),
      orderId: parseInt(row.order_id),
      orderNumber: row.order_number
    }))

    return NextResponse.json({
      success: true,
      data: {
        productId: parseInt(product.id),
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        lots
      }
    })

  } catch (error) {
    console.error('[Supplier Returns - Lots] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener lotes'
    }, { status: 500 })
  }
}
