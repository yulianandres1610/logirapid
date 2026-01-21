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

interface CountLine {
  productId: number
  variantId?: number
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  costPrice: number
  sellingPrice: number
  systemQuantity: number
  countedQuantity: number
}

/**
 * Generate a unique count number
 */
function generateCountNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `AUD-${year}-${random}`
}

/**
 * GET /api/audit/counts
 * Get counts with filters: countId, warehouseId, status, limit
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

    if (payload.companyType !== 'market' || payload.role !== 'MARKET_MANAGER') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const countId = searchParams.get('countId')
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get specific count by ID
    if (countId) {
      const countResult = await db.query(`
        SELECT
          ac.*,
          mw.name as warehouse_name,
          u.email as counted_by_email
        FROM audit_counts ac
        JOIN market_warehouses mw ON ac.warehouse_id = mw.id
        LEFT JOIN users u ON ac.counted_by = u.id
        WHERE ac.id = $1 AND ac.company_id = $2
      `, [countId, payload.companyId])

      if (countResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
      }

      const count = countResult.rows[0]

      // Get lines
      const linesResult = await db.query(`
        SELECT * FROM audit_count_lines
        WHERE count_id = $1
        ORDER BY id ASC
      `, [countId])

      return NextResponse.json({
        success: true,
        data: {
          id: count.id,
          countNumber: count.count_number,
          warehouseId: count.warehouse_id,
          warehouseName: count.warehouse_name,
          status: count.status,
          totalProducts: count.total_products,
          productsWithDifferences: count.products_with_differences,
          totalShortageValue: parseFloat(count.total_shortage_value) || 0,
          totalExcessValue: parseFloat(count.total_excess_value) || 0,
          totalStockAtCost: parseFloat(count.total_stock_at_cost) || 0,
          totalStockAtSale: parseFloat(count.total_stock_at_sale) || 0,
          countedByEmail: count.counted_by_email,
          startedAt: count.started_at,
          completedAt: count.completed_at,
          lines: linesResult.rows.map(l => ({
            productId: l.product_id,
            variantId: l.variant_id,
            productName: l.product_name,
            productSku: l.product_sku,
            productBarcode: l.product_barcode,
            productImage: l.product_image,
            costPrice: parseFloat(l.cost_price) || 0,
            sellingPrice: parseFloat(l.selling_price) || 0,
            systemQuantity: parseFloat(l.system_quantity) || 0,
            countedQuantity: parseFloat(l.counted_quantity) || 0,
            difference: parseFloat(l.difference) || 0,
            differenceValueCost: parseFloat(l.difference_value_cost) || 0,
            differenceValueSale: parseFloat(l.difference_value_sale) || 0
          }))
        }
      })
    }

    // Get in-progress count for warehouse
    if (warehouseId && status === 'in_progress') {
      const existingCount = await db.query(`
        SELECT id, count_number, status, started_at
        FROM audit_counts
        WHERE warehouse_id = $1 AND company_id = $2 AND status = 'in_progress'
        ORDER BY created_at DESC
        LIMIT 1
      `, [warehouseId, payload.companyId])

      if (existingCount.rows.length > 0) {
        // Return the existing in-progress count
        const redirectUrl = `/api/audit/counts?countId=${existingCount.rows[0].id}`
        return NextResponse.redirect(new URL(redirectUrl, request.url))
      }

      return NextResponse.json({
        success: true,
        data: { count: null }
      })
    }

    // List counts with filters
    let query = `
      SELECT
        ac.id,
        ac.count_number,
        ac.warehouse_id,
        mw.name as warehouse_name,
        ac.status,
        ac.total_products,
        ac.products_with_differences,
        ac.total_shortage_value,
        ac.total_excess_value,
        ac.total_stock_at_cost,
        ac.total_stock_at_sale,
        ac.started_at,
        ac.completed_at,
        u.email as counted_by_email
      FROM audit_counts ac
      JOIN market_warehouses mw ON ac.warehouse_id = mw.id
      LEFT JOIN users u ON ac.counted_by = u.id
      WHERE ac.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (warehouseId) {
      query += ` AND ac.warehouse_id = $${paramIndex}`
      params.push(warehouseId)
      paramIndex++
    }

    if (status && status !== 'all') {
      query += ` AND ac.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ` ORDER BY ac.created_at DESC LIMIT $${paramIndex}`
    params.push(limit)

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        counts: result.rows.map(c => ({
          id: c.id,
          countNumber: c.count_number,
          warehouseId: c.warehouse_id,
          warehouseName: c.warehouse_name,
          status: c.status,
          totalProducts: c.total_products,
          productsWithDifferences: c.products_with_differences,
          totalShortageValue: parseFloat(c.total_shortage_value) || 0,
          totalExcessValue: parseFloat(c.total_excess_value) || 0,
          totalStockAtCost: parseFloat(c.total_stock_at_cost) || 0,
          totalStockAtSale: parseFloat(c.total_stock_at_sale) || 0,
          countedByEmail: c.counted_by_email,
          startedAt: c.started_at,
          completedAt: c.completed_at
        }))
      }
    })

  } catch (error) {
    console.error('[Audit Counts API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conteos'
    }, { status: 500 })
  }
}

/**
 * POST /api/audit/counts
 * Create or update a count
 * Body: { warehouseId, lines, action: 'save' | 'complete' }
 */
export async function POST(request: NextRequest) {
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

    if (payload.companyType !== 'market' || payload.role !== 'MARKET_MANAGER') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const { warehouseId, lines, action, countId } = body as {
      warehouseId: number
      lines: CountLine[]
      action: 'save' | 'complete'
      countId?: number
    }

    if (!warehouseId || !lines || !action) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId, lines y action son requeridos'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Almacén no encontrado' }, { status: 404 })
    }

    // Find or create count
    let currentCountId = countId
    let countNumber: string

    if (currentCountId) {
      // Verify count exists and is in_progress
      const countCheck = await db.query(
        'SELECT id, count_number, status FROM audit_counts WHERE id = $1 AND company_id = $2',
        [currentCountId, payload.companyId]
      )

      if (countCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
      }

      if (countCheck.rows[0].status !== 'in_progress' && action === 'save') {
        return NextResponse.json({
          success: false,
          error: 'Este conteo ya fue completado'
        }, { status: 400 })
      }

      countNumber = countCheck.rows[0].count_number
    } else {
      // Check for existing in_progress count
      const existingCount = await db.query(`
        SELECT id, count_number FROM audit_counts
        WHERE warehouse_id = $1 AND company_id = $2 AND status = 'in_progress'
        LIMIT 1
      `, [warehouseId, payload.companyId])

      if (existingCount.rows.length > 0) {
        currentCountId = existingCount.rows[0].id
        countNumber = existingCount.rows[0].count_number
      } else {
        // Create new count
        countNumber = generateCountNumber()

        // Make sure count number is unique
        let attempts = 0
        while (attempts < 10) {
          const existing = await db.query(
            'SELECT id FROM audit_counts WHERE count_number = $1 AND company_id = $2',
            [countNumber, payload.companyId]
          )
          if (existing.rows.length === 0) break
          countNumber = generateCountNumber()
          attempts++
        }

        const insertResult = await db.query(`
          INSERT INTO audit_counts (
            company_id, warehouse_id, count_number, status, counted_by, started_at
          ) VALUES ($1, $2, $3, 'in_progress', $4, NOW())
          RETURNING id
        `, [payload.companyId, warehouseId, countNumber, payload.userId])

        currentCountId = insertResult.rows[0].id

        // Log creation
        await db.query(`
          INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
          VALUES ($1, 'created', $2, $3)
        `, [currentCountId, payload.userId, JSON.stringify({ warehouseId })])
      }
    }

    // Delete existing lines and insert new ones
    await db.query('DELETE FROM audit_count_lines WHERE count_id = $1', [currentCountId])

    // Insert new lines
    for (const line of lines) {
      const difference = line.systemQuantity - line.countedQuantity
      const diffValueCost = difference * line.costPrice
      const diffValueSale = difference * line.sellingPrice

      await db.query(`
        INSERT INTO audit_count_lines (
          count_id, product_id, variant_id, product_name, product_sku, product_barcode,
          product_image, cost_price, selling_price, system_quantity, counted_quantity,
          difference, difference_value_cost, difference_value_sale
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        currentCountId,
        line.productId,
        line.variantId || null,
        line.productName,
        line.productSku,
        line.productBarcode,
        line.productImage,
        line.costPrice,
        line.sellingPrice,
        line.systemQuantity,
        line.countedQuantity,
        difference,
        diffValueCost,
        diffValueSale
      ])
    }

    // Calculate totals
    const totalsResult = await db.query(`
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE difference != 0) as products_with_differences,
        COALESCE(SUM(CASE WHEN difference > 0 THEN difference_value_cost ELSE 0 END), 0) as total_shortage_cost,
        COALESCE(SUM(CASE WHEN difference < 0 THEN ABS(difference_value_cost) ELSE 0 END), 0) as total_excess_cost,
        COALESCE(SUM(counted_quantity * cost_price), 0) as total_stock_at_cost,
        COALESCE(SUM(counted_quantity * selling_price), 0) as total_stock_at_sale
      FROM audit_count_lines
      WHERE count_id = $1
    `, [currentCountId])

    const totals = totalsResult.rows[0]

    // Update count totals
    const newStatus = action === 'complete' ? 'completed' : 'in_progress'
    const completedAt = action === 'complete' ? 'NOW()' : 'NULL'

    await db.query(`
      UPDATE audit_counts SET
        total_products = $1,
        products_with_differences = $2,
        total_shortage_value = $3,
        total_excess_value = $4,
        total_stock_at_cost = $5,
        total_stock_at_sale = $6,
        status = $7,
        completed_at = ${action === 'complete' ? 'NOW()' : 'completed_at'},
        updated_at = NOW()
      WHERE id = $8
    `, [
      totals.total_products,
      totals.products_with_differences,
      totals.total_shortage_cost,
      totals.total_excess_cost,
      totals.total_stock_at_cost,
      totals.total_stock_at_sale,
      newStatus,
      currentCountId
    ])

    // Log action
    await db.query(`
      INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
      VALUES ($1, $2, $3, $4)
    `, [
      currentCountId,
      action === 'complete' ? 'completed' : 'saved',
      payload.userId,
      JSON.stringify({
        totalProducts: totals.total_products,
        productsWithDifferences: totals.products_with_differences
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        countId: currentCountId,
        countNumber,
        status: newStatus,
        totalProducts: parseInt(totals.total_products),
        productsWithDifferences: parseInt(totals.products_with_differences),
        totalShortageValue: parseFloat(totals.total_shortage_cost),
        totalExcessValue: parseFloat(totals.total_excess_cost),
        totalStockAtCost: parseFloat(totals.total_stock_at_cost),
        totalStockAtSale: parseFloat(totals.total_stock_at_sale)
      },
      message: action === 'complete' ? 'Conteo completado' : 'Conteo guardado'
    })

  } catch (error) {
    console.error('[Audit Counts API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar conteo'
    }, { status: 500 })
  }
}
