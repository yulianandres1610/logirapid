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
 * GET /api/market/pricelists/[id]
 * Get a specific pricelist with items
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
    const pricelistId = parseInt(id)

    if (isNaN(pricelistId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de lista de precios inválido'
      }, { status: 400 })
    }

    // Get pricelist
    const pricelistResult = await db.query(`
      SELECT * FROM market_pricelists
      WHERE id = $1 AND company_id = $2
    `, [pricelistId, payload.companyId])

    if (pricelistResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista de precios no encontrada'
      }, { status: 404 })
    }

    const row = pricelistResult.rows[0]

    // Get items with product info
    const itemsResult = await db.query(`
      SELECT
        mpi.*,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.selling_price as product_base_price
      FROM market_pricelist_items mpi
      LEFT JOIN market_products mp ON mp.id = mpi.product_id
      WHERE mpi.pricelist_id = $1
      ORDER BY mpi.product_id ASC, mpi.min_quantity ASC NULLS LAST
    `, [pricelistId])

    const items = itemsResult.rows.map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productSku: item.product_sku,
      basePrice: item.product_base_price ? parseFloat(item.product_base_price) : 0,
      categoryId: item.category_id,
      priceType: item.price_type,
      fixedPrice: item.fixed_price ? parseFloat(item.fixed_price) : null,
      discountPercent: item.discount_percent ? parseFloat(item.discount_percent) : null,
      discountAmount: item.discount_amount ? parseFloat(item.discount_amount) : null,
      minQuantity: item.min_quantity || 1,
      createdAt: item.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        code: row.code,
        type: row.type,
        currency: row.currency,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        isActive: row.is_active,
        isDefault: row.is_default,
        items,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })

  } catch (error) {
    console.error('[Market Pricelists API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener lista de precios'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/pricelists/[id]
 * Update a pricelist
 */
export async function PUT(
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
    const pricelistId = parseInt(id)

    if (isNaN(pricelistId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de lista de precios inválido'
      }, { status: 400 })
    }

    // Check pricelist exists
    const existing = await db.query(
      'SELECT id FROM market_pricelists WHERE id = $1 AND company_id = $2',
      [pricelistId, payload.companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista de precios no encontrada'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      code,
      type,
      currency,
      validFrom,
      validUntil,
      isActive,
      isDefault,
      items
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    // Ensure decimal precision for prices (auto-migrate)
    try {
      await db.query(`ALTER TABLE market_pricelist_items ALTER COLUMN fixed_price TYPE DECIMAL(12,3)`)
      await db.query(`ALTER TABLE market_pricelist_items ALTER COLUMN discount_amount TYPE DECIMAL(12,3)`)
    } catch (e) { /* already migrated */ }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.query(
        'UPDATE market_pricelists SET is_default = false WHERE company_id = $1 AND is_default = true AND id != $2',
        [payload.companyId, pricelistId]
      )
    }

    // Update pricelist
    await db.query(`
      UPDATE market_pricelists SET
        name = $1,
        code = $2,
        type = $3,
        currency = $4,
        valid_from = $5,
        valid_until = $6,
        is_active = $7,
        is_default = $8,
        updated_at = NOW()
      WHERE id = $9 AND company_id = $10
    `, [
      name,
      code || null,
      type || 'fixed',
      currency || 'USD',
      validFrom || null,
      validUntil || null,
      isActive ?? true,
      isDefault ?? false,
      pricelistId,
      payload.companyId
    ])

    // Update items if provided
    if (items !== undefined) {
      // Validate no duplicate min_quantity for the same product
      const tierMap = new Map<string, number[]>()
      for (const item of items) {
        if (item.productId) {
          const key = String(item.productId)
          const quantities = tierMap.get(key) || []
          const minQty = item.minQuantity || 1
          if (quantities.includes(minQty)) {
            return NextResponse.json({
              success: false,
              error: `Cantidad mínima duplicada (${minQty}) para el mismo producto`
            }, { status: 400 })
          }
          quantities.push(minQty)
          tierMap.set(key, quantities)
        }
      }

      // Delete existing items
      await db.query('DELETE FROM market_pricelist_items WHERE pricelist_id = $1', [pricelistId])

      // Add new items
      for (const item of items) {
        await db.query(`
          INSERT INTO market_pricelist_items (
            pricelist_id, product_id, category_id,
            price_type, fixed_price, discount_percent, discount_amount, min_quantity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          pricelistId,
          item.productId || null,
          item.categoryId || null,
          item.priceType || 'fixed',
          item.fixedPrice || null,
          item.discountPercent || null,
          item.discountAmount || null,
          item.minQuantity || 1
        ])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Lista de precios actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Market Pricelists API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar lista de precios'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/pricelists/[id]
 * Delete a pricelist
 */
export async function DELETE(
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
    const pricelistId = parseInt(id)

    if (isNaN(pricelistId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de lista de precios inválido'
      }, { status: 400 })
    }

    // Check pricelist exists and is not default
    const existing = await db.query(
      'SELECT id, is_default FROM market_pricelists WHERE id = $1 AND company_id = $2',
      [pricelistId, payload.companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista de precios no encontrada'
      }, { status: 404 })
    }

    if (existing.rows[0].is_default) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar la lista de precios por defecto'
      }, { status: 400 })
    }

    // Check if used by terminals
    const usedByTerminals = await db.query(
      'SELECT COUNT(*) as count FROM market_pos_terminals WHERE pricelist_id = $1',
      [pricelistId]
    )

    if (parseInt(usedByTerminals.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Esta lista de precios está asignada a terminales POS. Primero cambie la lista en esos terminales.'
      }, { status: 400 })
    }

    // Delete items first
    await db.query('DELETE FROM market_pricelist_items WHERE pricelist_id = $1', [pricelistId])

    // Delete pricelist
    await db.query('DELETE FROM market_pricelists WHERE id = $1', [pricelistId])

    return NextResponse.json({
      success: true,
      message: 'Lista de precios eliminada exitosamente'
    })

  } catch (error) {
    console.error('[Market Pricelists API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar lista de precios'
    }, { status: 500 })
  }
}
