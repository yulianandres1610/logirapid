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
 * POST /api/market/wholesale/quotes/delivery-estimate
 * Batch delivery time estimation for products
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { warehouseId, items } = body

    if (!warehouseId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId e items son requeridos'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )
    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Find central warehouse for raw material checks
    const centralResult = await db.query(
      'SELECT id FROM market_warehouses WHERE company_id = $1 AND is_central = true LIMIT 1',
      [payload.companyId]
    )
    const centralWarehouseId = centralResult.rows[0]?.id || null

    const estimates: Array<{
      productId: number
      estimatedDelivery: string
      stockAvailable: number
      hasFormula?: boolean
    }> = []

    for (const item of items) {
      const { productId, quantity } = item
      if (!productId || !quantity) continue

      // 1. Check stock in selected warehouse
      let stockOnHand = 0
      try {
        const stockResult = await db.query(
          'SELECT quantity_on_hand FROM market_warehouse_stock WHERE product_id = $1 AND warehouse_id = $2',
          [productId, warehouseId]
        )
        stockOnHand = parseFloat(stockResult.rows[0]?.quantity_on_hand) || 0
      } catch {
        // Table might not exist or no stock record
      }

      if (stockOnHand >= quantity) {
        estimates.push({ productId, estimatedDelivery: '1-24h', stockAvailable: stockOnHand })
        continue
      }

      // 2. Check if there's an active production formula
      let hasFormula = false
      let canManufacture = false

      try {
        const formulaResult = await db.query(`
          SELECT f.id, f.yield_quantity
          FROM market_production_formulas f
          WHERE f.target_product_id = $1 AND f.company_id = $2 AND f.is_active = true
          LIMIT 1
        `, [productId, payload.companyId])

        if (formulaResult.rows.length > 0 && centralWarehouseId) {
          hasFormula = true
          const formula = formulaResult.rows[0]
          const deficit = quantity - stockOnHand
          const yieldQuantity = parseFloat(formula.yield_quantity) || 1
          const multiplier = deficit / yieldQuantity

          // 3. Get formula lines and check raw material stock in central warehouse
          const formulaLinesResult = await db.query(`
            SELECT fl.raw_material_id, fl.quantity
            FROM market_production_formula_lines fl
            WHERE fl.formula_id = $1
          `, [formula.id])

          if (formulaLinesResult.rows.length > 0) {
            canManufacture = true

            for (const line of formulaLinesResult.rows) {
              const requiredQty = parseFloat(line.quantity) * multiplier

              const mpStockResult = await db.query(
                'SELECT quantity_on_hand FROM market_warehouse_stock WHERE product_id = $1 AND warehouse_id = $2',
                [line.raw_material_id, centralWarehouseId]
              )
              const mpStock = parseFloat(mpStockResult.rows[0]?.quantity_on_hand) || 0

              if (mpStock < requiredQty) {
                canManufacture = false
                break
              }
            }
          }
        }
      } catch {
        // Formula tables might not exist
      }

      if (hasFormula && canManufacture) {
        estimates.push({ productId, estimatedDelivery: '1-3d', stockAvailable: stockOnHand, hasFormula: true })
      } else {
        estimates.push({ productId, estimatedDelivery: '1-30d', stockAvailable: stockOnHand, hasFormula })
      }
    }

    return NextResponse.json({
      success: true,
      data: { estimates }
    })

  } catch (error) {
    console.error('[Delivery Estimate] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al calcular estimaciones'
    }, { status: 500 })
  }
}
