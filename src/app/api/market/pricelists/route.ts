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
 * GET /api/market/pricelists
 * List all pricelists for the company
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const includeItems = searchParams.get('includeItems') === 'true'

    const result = await db.query(`
      SELECT
        mp.*,
        (SELECT COUNT(*) FROM market_pricelist_items mpi WHERE mpi.pricelist_id = mp.id) as items_count
      FROM market_pricelists mp
      WHERE mp.company_id = $1
      ORDER BY mp.is_default DESC, mp.name ASC
    `, [payload.companyId])

    const pricelists = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      type: row.type,
      currency: row.currency,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      isActive: row.is_active,
      isDefault: row.is_default,
      itemsCount: parseInt(row.items_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        pricelists,
        total: pricelists.length
      }
    })

  } catch (error) {
    console.error('[Market Pricelists API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener listas de precios'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pricelists
 * Create a new pricelist
 */
export async function POST(request: NextRequest) {
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
        'UPDATE market_pricelists SET is_default = false WHERE company_id = $1 AND is_default = true',
        [payload.companyId]
      )
    }

    // Create pricelist
    const result = await db.query(`
      INSERT INTO market_pricelists (
        company_id, name, code, type, currency,
        valid_from, valid_until, is_active, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      payload.companyId,
      name,
      code || null,
      type || 'fixed',
      currency || 'USD',
      validFrom || null,
      validUntil || null,
      isActive ?? true,
      isDefault ?? false
    ])

    const pricelistId = result.rows[0].id

    // Add items if provided
    if (items && items.length > 0) {
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
      data: { id: pricelistId },
      message: 'Lista de precios creada exitosamente'
    })

  } catch (error) {
    console.error('[Market Pricelists API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear lista de precios'
    }, { status: 500 })
  }
}
