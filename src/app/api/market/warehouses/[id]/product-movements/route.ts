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
 * GET /api/market/warehouses/[id]/product-movements
 * Get movement history for a specific product in a warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
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

    // Get query params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId es requerido'
      }, { status: 400 })
    }

    // Get product info
    const productQuery = `
      SELECT
        p.id,
        COALESCE(v.variant_name, p.name) as name,
        COALESCE(v.sku, p.sku) as sku,
        COALESCE(v.barcode, p.barcode) as barcode
      FROM market_products p
      LEFT JOIN market_product_variants v ON v.id = $2 AND v.product_id = p.id
      WHERE p.id = $1 AND p.company_id = $3
    `
    const productResult = await db.query(productQuery, [
      parseInt(productId),
      variantId ? parseInt(variantId) : null,
      payload.companyId
    ])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Get current stock
    const stockQuery = `
      SELECT COALESCE(SUM(quantity_on_hand), 0) as current_stock
      FROM market_warehouse_stock
      WHERE warehouse_id = $1 AND product_id = $2
        AND ($3::int IS NULL OR variant_id = $3)
    `
    const stockResult = await db.query(stockQuery, [
      warehouseId,
      parseInt(productId),
      variantId ? parseInt(variantId) : null
    ])
    const currentStock = parseFloat(stockResult.rows[0]?.current_stock) || 0

    // Build movements query
    let movementsQuery = `
      SELECT
        m.id,
        m.created_at as date,
        m.movement_type as type,
        m.quantity,
        m.quantity_before as stock_before,
        m.quantity_after as stock_after,
        m.notes,
        m.reference_type,
        m.reference_id,
        fw.name as from_warehouse,
        tw.name as to_warehouse,
        COALESCE(u.firstname || ' ' || u.lastname, u.email, 'Sistema') as user_name,
        op.operation_number
      FROM market_stock_movements m
      LEFT JOIN market_warehouses fw ON fw.id = m.from_warehouse_id
      LEFT JOIN market_warehouses tw ON tw.id = m.to_warehouse_id
      LEFT JOIN users u ON u.id = m.created_by
      LEFT JOIN market_warehouse_operations op ON op.id = m.operation_id
      WHERE m.product_id = $1
        AND m.company_id = $2
        AND (m.from_warehouse_id = $3 OR m.to_warehouse_id = $3)
    `

    const queryParams: (string | number | null)[] = [
      parseInt(productId),
      payload.companyId,
      warehouseId
    ]
    let paramIndex = 4

    // Variant filter
    if (variantId) {
      movementsQuery += ` AND m.variant_id = $${paramIndex}`
      queryParams.push(parseInt(variantId))
      paramIndex++
    }

    // Date filters
    if (startDate) {
      movementsQuery += ` AND m.created_at >= $${paramIndex}`
      queryParams.push(startDate)
      paramIndex++
    }

    if (endDate) {
      movementsQuery += ` AND m.created_at <= $${paramIndex}`
      queryParams.push(endDate)
      paramIndex++
    }

    movementsQuery += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`
    queryParams.push(limit)

    const movementsResult = await db.query(movementsQuery, queryParams)

    // Map movement types to labels and colors
    const typeLabels: Record<string, string> = {
      'in': 'Entrada',
      'out': 'Salida',
      'transfer': 'Transferencia',
      'transfer_in': 'Transferencia Entrada',
      'transfer_out': 'Transferencia Salida',
      'adjustment': 'Ajuste',
      'scrap': 'Scrap/Merma',
      'reception': 'Recepción',
      'sale': 'Venta',
      'return': 'Devolución'
    }

    const movements = movementsResult.rows.map(row => {
      // Determine if this is an incoming or outgoing movement for this warehouse
      const isIncoming = row.to_warehouse === warehouseCheck.rows[0].name
      const quantity = parseFloat(row.quantity) || 0

      return {
        id: row.id,
        date: row.date,
        type: row.type,
        typeLabel: typeLabels[row.type] || row.type,
        quantity: isIncoming ? quantity : -quantity,
        stockBefore: parseFloat(row.stock_before) || 0,
        stockAfter: parseFloat(row.stock_after) || 0,
        reference: row.operation_number || (row.reference_type ? `${row.reference_type}-${row.reference_id}` : null),
        fromWarehouse: row.from_warehouse,
        toWarehouse: row.to_warehouse,
        user: row.user_name,
        notes: row.notes
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode
        },
        currentStock,
        movements
      }
    })

  } catch (error) {
    console.error('[Product Movements API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener movimientos'
    }, { status: 500 })
  }
}
