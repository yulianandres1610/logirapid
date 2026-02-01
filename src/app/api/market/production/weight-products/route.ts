import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/market/production/weight-products
 * Lista productos de peso variable (unidad: kg, lb, g)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    // Obtener productos con unidad de peso (kg, lb, g)
    let query = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.category,
        p.image_url as "imageUrl",
        p.selling_price as "sellingPrice",
        p.cost_price as "costPrice",
        p.unit_of_measure as "unitOfMeasure",
        p.weight_barcode_prefix as "weightBarcodePrefix",
        p.is_weight_product as "isWeightProduct",
        p.quantity_on_hand as "quantityOnHand",
        p.is_active as "isActive"
      FROM market_products p
      WHERE p.company_id = $1
        AND p.is_active = true
        AND (
          p.unit_of_measure IN ('kg', 'lb', 'g', 'libra', 'kilogramo', 'gramo')
          OR p.is_weight_product = true
        )
    `
    const params: (string | number)[] = [companyId]

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (LOWER(p.name) LIKE LOWER($${params.length}) OR p.sku LIKE $${params.length} OR p.barcode LIKE $${params.length})`
    }

    if (category) {
      params.push(category)
      query += ` AND p.category = $${params.length}`
    }

    query += ` ORDER BY p.name ASC LIMIT 100`

    const result = await db.query(query, params)

    // Obtener categorías de productos de peso para filtro
    const categoriesResult = await db.query(`
      SELECT DISTINCT category
      FROM market_products
      WHERE company_id = $1
        AND is_active = true
        AND (
          unit_of_measure IN ('kg', 'lb', 'g', 'libra', 'kilogramo', 'gramo')
          OR is_weight_product = true
        )
        AND category IS NOT NULL
      ORDER BY category
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows,
        categories: categoriesResult.rows.map(r => r.category),
        total: result.rows.length
      }
    })

  } catch (error) {
    console.error('[Weight Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener productos de peso'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/production/weight-products
 * Actualiza el prefijo de código de barra de un producto de peso
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, weightBarcodePrefix, isWeightProduct } = body

    if (!productId) {
      return NextResponse.json({ success: false, error: 'ID de producto requerido' }, { status: 400 })
    }

    // Validar formato del prefijo (debe ser numérico, 5 dígitos)
    if (weightBarcodePrefix) {
      if (!/^\d{5}$/.test(weightBarcodePrefix)) {
        return NextResponse.json({
          success: false,
          error: 'El prefijo debe ser exactamente 5 dígitos numéricos'
        }, { status: 400 })
      }

      // Verificar que no exista otro producto con el mismo prefijo en la misma empresa
      const existingResult = await db.query(`
        SELECT id, name
        FROM market_products
        WHERE company_id = $1
          AND weight_barcode_prefix = $2
          AND id != $3
      `, [companyId, weightBarcodePrefix, productId])

      if (existingResult.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: `El prefijo ya está asignado a: ${existingResult.rows[0].name}`
        }, { status: 400 })
      }
    }

    // Actualizar producto
    await db.query(`
      UPDATE market_products
      SET
        weight_barcode_prefix = $1,
        is_weight_product = $2,
        updated_at = NOW()
      WHERE id = $3 AND company_id = $4
    `, [weightBarcodePrefix || null, isWeightProduct ?? true, productId, companyId])

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado'
    })

  } catch (error) {
    console.error('[Weight Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar producto'
    }, { status: 500 })
  }
}
