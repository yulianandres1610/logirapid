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

    // Verify user is admin from market company
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso denegado'
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

    // Get all products with stock in this warehouse (only products without variants or base stock)
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
      LEFT JOIN market_warehouse_stock mws ON p.id = mws.product_id AND mws.warehouse_id = $1 AND mws.variant_id IS NULL
      WHERE p.company_id = $2 AND p.is_active = true
      ORDER BY p.name ASC
    `, [warehouseId, payload.companyId])

    // Get variants for all products with their warehouse stock
    const variantsResult = await db.query(`
      SELECT
        v.id,
        v.product_id,
        v.variant_name as name,
        v.sku,
        v.barcode,
        v.selling_price,
        v.cost_price,
        v.image_url,
        v.is_active,
        COALESCE(ws.quantity_on_hand, 0) as stock
      FROM market_product_variants v
      JOIN market_products p ON v.product_id = p.id
      LEFT JOIN market_warehouse_stock ws ON v.product_id = ws.product_id AND v.id = ws.variant_id AND ws.warehouse_id = $1
      WHERE p.company_id = $2 AND v.is_active = true
      ORDER BY v.product_id, v.variant_name ASC
    `, [warehouseId, payload.companyId])

    // Group variants by product
    const variantsByProduct: Record<number, Array<{
      id: number
      name: string
      sku: string
      barcode: string | null
      imageUrl: string | null
      costPrice: number
      sellingPrice: number
      stock: number
    }>> = {}

    for (const v of variantsResult.rows) {
      if (!variantsByProduct[v.product_id]) {
        variantsByProduct[v.product_id] = []
      }
      variantsByProduct[v.product_id].push({
        id: v.id,
        name: v.name || v.sku || `Variante ${v.id}`,
        sku: v.sku || '',
        barcode: v.barcode || null,
        imageUrl: v.image_url || null,
        costPrice: parseFloat(v.cost_price) || 0,
        sellingPrice: parseFloat(v.selling_price) || 0,
        stock: parseFloat(v.stock) || 0
      })
    }

    // Build products with variants
    const products = result.rows.map(p => {
      const variants = variantsByProduct[p.id] || []
      const hasVariants = variants.length > 0

      // Calculate total stock for product with variants
      const totalStock = hasVariants
        ? variants.reduce((sum, v) => sum + v.stock, 0)
        : parseFloat(p.stock) || 0

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        imageUrl: p.image_url,
        costPrice: parseFloat(p.cost_price) || 0,
        sellingPrice: parseFloat(p.selling_price) || 0,
        stock: totalStock,
        hasVariants,
        variants: hasVariants ? variants : undefined
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name
        },
        products,
        totalProducts: products.length
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
