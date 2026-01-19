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

    // STEP 1: First try to find a VARIANT by exact barcode/SKU match
    const variantResult = await db.query(`
      SELECT
        v.id as variant_id,
        v.variant_name,
        v.sku as variant_sku,
        v.barcode as variant_barcode,
        v.selling_price as variant_price,
        v.cost_price as variant_cost_price,
        v.image_url as variant_image_url,
        p.id as product_id,
        p.name as product_name,
        p.description,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.category,
        p.unit_of_measure as unit,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price,
        p.image_url as product_image_url,
        p.is_active,
        COALESCE(ws.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(ws.quantity_reserved, 0) as quantity_reserved
      FROM market_product_variants v
      JOIN market_products p ON p.id = v.product_id
      LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id AND ws.variant_id = v.id AND ws.warehouse_id = $2
      WHERE p.company_id = $1
        AND v.is_active = true
        AND (v.barcode = $3 OR v.sku = $3)
      LIMIT 1
    `, [payload.companyId, warehouseId, searchCode])

    // If variant found, return it
    if (variantResult.rows.length > 0) {
      const v = variantResult.rows[0]

      console.log('[Scan Product] Variante encontrada:', {
        variantId: v.variant_id,
        variantName: v.variant_name,
        productName: v.product_name,
        variantSku: v.variant_sku
      })

      if (!v.is_active) {
        return NextResponse.json({
          success: false,
          error: 'Producto inactivo',
          code: 'PRODUCT_INACTIVE'
        }, { status: 400 })
      }

      const quantityOnHand = parseFloat(v.quantity_on_hand) || 0
      const quantityReserved = parseFloat(v.quantity_reserved) || 0
      const quantityAvailable = quantityOnHand - quantityReserved

      // Construir nombre de variante completo para display
      const variantDisplayName = v.variant_name || v.variant_sku || `Variante ${v.variant_id}`

      return NextResponse.json({
        success: true,
        data: {
          product: {
            id: v.product_id,
            name: v.product_name,
            description: v.description,
            sku: v.product_sku,
            barcode: v.product_barcode,
            category: v.category,
            unit: v.unit || 'unidad',
            costPrice: parseFloat(v.variant_cost_price || v.product_cost_price) || 0,
            sellingPrice: parseFloat(v.variant_price || v.product_selling_price) || 0,
            imageUrl: v.variant_image_url || v.product_image_url
          },
          variant: {
            id: v.variant_id,
            name: variantDisplayName,
            sku: v.variant_sku,
            barcode: v.variant_barcode,
            price: parseFloat(v.variant_price) || 0,
            costPrice: parseFloat(v.variant_cost_price) || 0,
            imageUrl: v.variant_image_url
          },
          stock: {
            warehouseId: warehouseId,
            warehouseName: warehouse.name,
            quantityOnHand,
            quantityReserved,
            quantityAvailable,
            allowNegative: warehouse.allow_negative_stock
          }
        }
      })
    }

    // STEP 2: Try exact match on product barcode or SKU
    let productResult = await db.query(`
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
        p.has_variants,
        COALESCE(ws.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(ws.quantity_reserved, 0) as quantity_reserved
      FROM market_products p
      LEFT JOIN market_warehouse_stock ws ON p.id = ws.product_id AND ws.variant_id IS NULL AND ws.warehouse_id = $2
      WHERE p.company_id = $1 AND (p.barcode = $3 OR p.sku = $3)
      LIMIT 1
    `, [payload.companyId, warehouseId, searchCode])

    // STEP 3: If no exact match, try partial search on name, SKU, or barcode
    if (productResult.rows.length === 0) {
      productResult = await db.query(`
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
          p.has_variants,
          COALESCE(ws.quantity_on_hand, 0) as quantity_on_hand,
          COALESCE(ws.quantity_reserved, 0) as quantity_reserved
        FROM market_products p
        LEFT JOIN market_warehouse_stock ws ON p.id = ws.product_id AND ws.variant_id IS NULL AND ws.warehouse_id = $2
        WHERE p.company_id = $1
          AND (
            p.name ILIKE $3
            OR p.sku ILIKE $3
            OR p.barcode ILIKE $3
          )
        ORDER BY
          CASE
            WHEN p.sku ILIKE $4 THEN 1
            WHEN p.barcode ILIKE $4 THEN 2
            ELSE 3
          END,
          p.name
        LIMIT 1
      `, [payload.companyId, warehouseId, `%${searchCode}%`, `${searchCode}%`])
    }

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

    // STEP 4: If product has variants, get them for selection
    let variants = null
    if (product.has_variants) {
      const variantsResult = await db.query(`
        SELECT
          v.id,
          v.variant_name as name,
          v.sku,
          v.barcode,
          v.selling_price as price,
          v.cost_price,
          v.image_url,
          COALESCE(ws.quantity_on_hand, 0) as quantity_on_hand,
          COALESCE(ws.quantity_reserved, 0) as quantity_reserved
        FROM market_product_variants v
        LEFT JOIN market_warehouse_stock ws ON ws.product_id = $1 AND ws.variant_id = v.id AND ws.warehouse_id = $3
        WHERE v.product_id = $1 AND v.is_active = true
        ORDER BY v.variant_name
      `, [product.id, payload.companyId, warehouseId])

      variants = variantsResult.rows.map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: parseFloat(v.price) || 0,
        costPrice: parseFloat(v.cost_price) || 0,
        imageUrl: v.image_url,
        stock: parseFloat(v.quantity_on_hand) - parseFloat(v.quantity_reserved)
      }))
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
          imageUrl: product.image_url,
          hasVariants: product.has_variants || false
        },
        variants: variants,
        stock: {
          warehouseId: warehouseId,
          warehouseName: warehouse.name,
          quantityOnHand,
          quantityReserved,
          quantityAvailable,
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
