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

interface ScanRequest {
  barcode: string
}

/**
 * POST /api/market/warehouses/[id]/scan-product
 * Scan a product by barcode/SKU and get stock info for this warehouse
 */
export async function POST(
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
      'SELECT id, name, allow_negative_stock FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]

    const body: ScanRequest = await request.json()
    const { barcode } = body

    if (!barcode || barcode.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Código de barras requerido'
      }, { status: 400 })
    }

    const searchCode = barcode.trim()

    // Search product by barcode or SKU (exact match)
    const productResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.sku,
        p.barcode,
        p.category,
        p.unit_of_measure as unit,
        p.cost_price,
        p.selling_price,
        p.image_url,
        p.is_active,
        COALESCE(ws.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(ws.quantity_reserved, 0) as quantity_reserved,
        COALESCE(ws.min_stock, 0) as min_stock,
        COALESCE(ws.max_stock, 0) as max_stock
      FROM market_products p
      LEFT JOIN market_warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
      WHERE p.company_id = $1 AND (p.barcode = $3 OR p.sku = $3)
      LIMIT 1
    `, [payload.companyId, warehouseId, searchCode])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    if (!product.is_active) {
      return NextResponse.json({
        success: false,
        error: 'Producto inactivo',
        code: 'PRODUCT_INACTIVE'
      }, { status: 400 })
    }

    const quantityOnHand = parseFloat(product.quantity_on_hand) || 0
    const quantityReserved = parseFloat(product.quantity_reserved) || 0
    const quantityAvailable = quantityOnHand - quantityReserved

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          unit: product.unit || 'unidad',
          costPrice: parseFloat(product.cost_price) || 0,
          sellingPrice: parseFloat(product.selling_price) || 0,
          imageUrl: product.image_url
        },
        stock: {
          warehouseId: warehouseId,
          warehouseName: warehouse.name,
          quantityOnHand,
          quantityReserved,
          quantityAvailable,
          minStock: parseFloat(product.min_stock) || 0,
          maxStock: parseFloat(product.max_stock) || 0,
          allowNegative: warehouse.allow_negative_stock
        }
      }
    })

  } catch (error) {
    console.error('[Warehouse Scan Product] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al escanear producto'
    }, { status: 500 })
  }
}
