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
 * GET /api/market/warehouses/[id]/check-supplier-conflict
 * Verifica si un producto tiene stock de consignación de otro proveedor
 * Query params: productId, supplierId
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
    const productId = searchParams.get('productId')
    const supplierId = searchParams.get('supplierId')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId es requerido'
      }, { status: 400 })
    }

    // Verificar si el producto tiene stock de OTRO proveedor de consignación
    const conflictQuery = supplierId
      ? `
        SELECT
          cli.supplier_id,
          cs.supplier_code as supplier_code,
          cs.name as supplier_name,
          cli.unit_cost,
          SUM(cli.quantity_available) as total_available
        FROM consignment_lot_inventory cli
        JOIN market_suppliers cs ON cs.id = cli.supplier_id
        WHERE cli.warehouse_id = $1
          AND cli.product_id = $2
          AND cli.quantity_available > 0
          AND cli.supplier_id != $3
          AND cli.company_id = $4
        GROUP BY cli.supplier_id, cs.supplier_code, cs.name, cli.unit_cost
      `
      : `
        SELECT
          cli.supplier_id,
          cs.supplier_code as supplier_code,
          cs.name as supplier_name,
          cli.unit_cost,
          SUM(cli.quantity_available) as total_available
        FROM consignment_lot_inventory cli
        JOIN market_suppliers cs ON cs.id = cli.supplier_id
        WHERE cli.warehouse_id = $1
          AND cli.product_id = $2
          AND cli.quantity_available > 0
          AND cli.company_id = $3
        GROUP BY cli.supplier_id, cs.supplier_code, cs.name, cli.unit_cost
      `

    const queryParams = supplierId
      ? [warehouseId, parseInt(productId), parseInt(supplierId), payload.companyId]
      : [warehouseId, parseInt(productId), payload.companyId]

    const conflictResult = await db.query(conflictQuery, queryParams)

    if (conflictResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        hasConflict: false,
        data: null
      })
    }

    // Obtener nombre del producto
    const productResult = await db.query(
      'SELECT name, sku, barcode FROM market_products WHERE id = $1',
      [parseInt(productId)]
    )
    const product = productResult.rows[0]

    const conflict = conflictResult.rows[0]

    return NextResponse.json({
      success: true,
      hasConflict: true,
      data: {
        productId: parseInt(productId),
        productName: product?.name || 'Producto',
        productSku: product?.sku || '',
        productBarcode: product?.barcode || '',
        existingSupplier: {
          id: parseInt(conflict.supplier_id),
          code: conflict.supplier_code,
          name: conflict.supplier_name,
          unitCost: parseFloat(conflict.unit_cost),
          stockAvailable: parseInt(conflict.total_available)
        },
        message: `Este producto tiene ${conflict.total_available} unidades en consignación del proveedor ${conflict.supplier_name} a $${parseFloat(conflict.unit_cost).toFixed(2)}. Debe devolver todo el stock antes de consignar con otro proveedor.`
      }
    })

  } catch (error) {
    console.error('[Check Supplier Conflict] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar conflicto'
    }, { status: 500 })
  }
}
