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

interface AssetCountLine {
  assetId: number
  assetCode: string
  assetBarcode: string | null
  assetName: string
  categoryName: string | null
  responsibleName: string | null
  currentValue: number
  expectedWarehouseId: number
  foundWarehouseId?: number
  expectedCondition: string
  observedCondition?: string
  scanStatus: 'found' | 'missing' | 'surplus'
  productImage?: string | null
}

type AuditType = 'products' | 'fixed_assets'

/**
 * Generate a unique count number
 */
function generateCountNumber(auditType: AuditType): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  const prefix = auditType === 'fixed_assets' ? 'AFA' : 'AUD'
  return `${prefix}-${year}-${random}`
}

/**
 * GET /api/audit/counts
 * Get counts with filters: countId, warehouseId, status, auditType, limit
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

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const countId = searchParams.get('countId')
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const auditType = (searchParams.get('auditType') || 'products') as AuditType
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get specific count by ID
    if (countId) {
      const countResult = await db.query(`
        SELECT
          ac.*,
          mw.name as warehouse_name,
          u.email as counted_by_email,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as counted_by_name
        FROM audit_counts ac
        JOIN market_warehouses mw ON ac.warehouse_id = mw.id
        LEFT JOIN users u ON ac.counted_by = u.id
        WHERE ac.id = $1 AND ac.company_id = $2
      `, [countId, payload.companyId])

      if (countResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
      }

      const count = countResult.rows[0]
      const countAuditType = count.audit_type || 'products'

      // Get lines
      const linesResult = await db.query(`
        SELECT * FROM audit_count_lines
        WHERE count_id = $1
        ORDER BY id ASC
      `, [countId])

      // Format lines based on audit type
      const formattedLines = countAuditType === 'fixed_assets'
        ? linesResult.rows.map(l => ({
            assetId: l.asset_id,
            assetCode: l.asset_code,
            assetBarcode: l.asset_barcode,
            assetName: l.product_name,
            categoryName: l.category_name,
            responsibleName: l.responsible_name,
            currentValue: parseFloat(l.cost_price) || 0,
            expectedWarehouseId: l.expected_warehouse_id,
            foundWarehouseId: l.found_warehouse_id,
            expectedCondition: l.expected_condition,
            observedCondition: l.observed_condition,
            scanStatus: l.scan_status,
            productImage: l.product_image
          }))
        : linesResult.rows.map(l => ({
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

      return NextResponse.json({
        success: true,
        data: {
          id: count.id,
          countNumber: count.count_number,
          warehouseId: count.warehouse_id,
          warehouseName: count.warehouse_name,
          status: count.status,
          auditType: countAuditType,
          // Product audit fields
          totalProducts: count.total_products,
          productsWithDifferences: count.products_with_differences,
          totalShortageValue: parseFloat(count.total_shortage_value) || 0,
          totalExcessValue: parseFloat(count.total_excess_value) || 0,
          totalStockAtCost: parseFloat(count.total_stock_at_cost) || 0,
          totalStockAtSale: parseFloat(count.total_stock_at_sale) || 0,
          // Fixed asset audit fields
          totalAssets: count.total_assets || 0,
          assetsFound: count.assets_found || 0,
          assetsMissing: count.assets_missing || 0,
          assetsSurplus: count.assets_surplus || 0,
          totalValueAtRisk: parseFloat(count.total_value_at_risk) || 0,
          // Common fields
          countedByEmail: count.counted_by_email,
          countedByName: count.counted_by_name,
          startedAt: count.started_at,
          completedAt: count.completed_at,
          lines: formattedLines
        }
      })
    }

    // Get in-progress count for warehouse
    if (warehouseId && status === 'in_progress') {
      const existingCount = await db.query(`
        SELECT id, count_number, status, started_at, audit_type
        FROM audit_counts
        WHERE warehouse_id = $1 AND company_id = $2 AND status = 'in_progress'
          AND COALESCE(audit_type, 'products') = $3
        ORDER BY created_at DESC
        LIMIT 1
      `, [warehouseId, payload.companyId, auditType])

      if (existingCount.rows.length > 0) {
        // Return the existing in-progress count info (not redirect)
        return NextResponse.json({
          success: true,
          data: {
            count: {
              id: existingCount.rows[0].id,
              countNumber: existingCount.rows[0].count_number,
              status: existingCount.rows[0].status,
              startedAt: existingCount.rows[0].started_at,
              auditType: existingCount.rows[0].audit_type || 'products'
            }
          }
        })
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
        COALESCE(ac.audit_type, 'products') as audit_type,
        ac.total_products,
        ac.products_with_differences,
        ac.total_shortage_value,
        ac.total_excess_value,
        ac.total_stock_at_cost,
        ac.total_stock_at_sale,
        ac.total_assets,
        ac.assets_found,
        ac.assets_missing,
        ac.assets_surplus,
        ac.total_value_at_risk,
        ac.started_at,
        ac.completed_at,
        u.email as counted_by_email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as counted_by_name
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

    // Filter by audit type
    query += ` AND COALESCE(ac.audit_type, 'products') = $${paramIndex}`
    params.push(auditType)
    paramIndex++

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
          auditType: c.audit_type,
          // Product audit fields
          totalProducts: c.total_products,
          productsWithDifferences: c.products_with_differences,
          totalShortageValue: parseFloat(c.total_shortage_value) || 0,
          totalExcessValue: parseFloat(c.total_excess_value) || 0,
          totalStockAtCost: parseFloat(c.total_stock_at_cost) || 0,
          totalStockAtSale: parseFloat(c.total_stock_at_sale) || 0,
          // Fixed asset audit fields
          totalAssets: c.total_assets || 0,
          assetsFound: c.assets_found || 0,
          assetsMissing: c.assets_missing || 0,
          assetsSurplus: c.assets_surplus || 0,
          totalValueAtRisk: parseFloat(c.total_value_at_risk) || 0,
          // Common fields
          countedByEmail: c.counted_by_email,
          countedByName: c.counted_by_name,
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
 * Body: { warehouseId, lines, action: 'save' | 'complete', auditType?: 'products' | 'fixed_assets' }
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

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const {
      warehouseId,
      lines,
      assetLines,
      action,
      countId,
      auditType = 'products'
    } = body as {
      warehouseId: number
      lines?: CountLine[]
      assetLines?: AssetCountLine[]
      action: 'save' | 'complete'
      countId?: number
      auditType?: AuditType
    }

    if (!warehouseId || !action) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId y action son requeridos'
      }, { status: 400 })
    }

    // Validate that appropriate lines are provided
    if (auditType === 'products' && !lines) {
      return NextResponse.json({
        success: false,
        error: 'lines es requerido para auditoría de productos'
      }, { status: 400 })
    }

    if (auditType === 'fixed_assets' && !assetLines) {
      return NextResponse.json({
        success: false,
        error: 'assetLines es requerido para auditoría de activos fijos'
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
        'SELECT id, count_number, status, audit_type FROM audit_counts WHERE id = $1 AND company_id = $2',
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
          AND COALESCE(audit_type, 'products') = $3
        LIMIT 1
      `, [warehouseId, payload.companyId, auditType])

      if (existingCount.rows.length > 0) {
        currentCountId = existingCount.rows[0].id
        countNumber = existingCount.rows[0].count_number
      } else {
        // Create new count
        countNumber = generateCountNumber(auditType)

        // Make sure count number is unique
        let attempts = 0
        while (attempts < 10) {
          const existing = await db.query(
            'SELECT id FROM audit_counts WHERE count_number = $1 AND company_id = $2',
            [countNumber, payload.companyId]
          )
          if (existing.rows.length === 0) break
          countNumber = generateCountNumber(auditType)
          attempts++
        }

        const insertResult = await db.query(`
          INSERT INTO audit_counts (
            company_id, warehouse_id, count_number, status, counted_by, started_at, audit_type
          ) VALUES ($1, $2, $3, 'in_progress', $4, NOW(), $5)
          RETURNING id
        `, [payload.companyId, warehouseId, countNumber, payload.userId, auditType])

        currentCountId = insertResult.rows[0].id

        // Log creation
        await db.query(`
          INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
          VALUES ($1, 'created', $2, $3)
        `, [currentCountId, payload.userId, JSON.stringify({ warehouseId, auditType })])
      }
    }

    // Delete existing lines and insert new ones
    await db.query('DELETE FROM audit_count_lines WHERE count_id = $1', [currentCountId])

    if (auditType === 'products' && lines) {
      // Insert product lines
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

      // Calculate totals for products
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
          auditType: 'products',
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
          auditType: 'products',
          totalProducts: parseInt(totals.total_products),
          productsWithDifferences: parseInt(totals.products_with_differences),
          totalShortageValue: parseFloat(totals.total_shortage_cost),
          totalExcessValue: parseFloat(totals.total_excess_cost),
          totalStockAtCost: parseFloat(totals.total_stock_at_cost),
          totalStockAtSale: parseFloat(totals.total_stock_at_sale)
        },
        message: action === 'complete' ? 'Conteo completado' : 'Conteo guardado'
      })

    } else if (auditType === 'fixed_assets' && assetLines) {
      // Insert fixed asset lines
      for (const line of assetLines) {
        // For fixed assets: system_quantity = 1 (expected), counted_quantity = 1 (found) or 0 (missing)
        const systemQty = 1
        const countedQty = line.scanStatus === 'found' ? 1 : 0
        const difference = systemQty - countedQty // 1 = missing, 0 = found

        await db.query(`
          INSERT INTO audit_count_lines (
            count_id, asset_id, asset_code, asset_barcode, product_name,
            product_image, cost_price, system_quantity, counted_quantity, difference,
            difference_value_cost, scan_status, expected_warehouse_id, found_warehouse_id,
            expected_condition, observed_condition, category_name, responsible_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          currentCountId,
          line.assetId,
          line.assetCode,
          line.assetBarcode,
          line.assetName,
          line.productImage || null,
          line.currentValue,
          systemQty,
          countedQty,
          difference,
          difference * line.currentValue, // Value at risk for missing assets
          line.scanStatus,
          line.expectedWarehouseId,
          line.foundWarehouseId || null,
          line.expectedCondition,
          line.observedCondition || null,
          line.categoryName,
          line.responsibleName
        ])
      }

      // Calculate totals for fixed assets
      const totalsResult = await db.query(`
        SELECT
          COUNT(*) as total_assets,
          COUNT(*) FILTER (WHERE scan_status = 'found') as assets_found,
          COUNT(*) FILTER (WHERE scan_status = 'missing') as assets_missing,
          COUNT(*) FILTER (WHERE scan_status = 'surplus') as assets_surplus,
          COALESCE(SUM(CASE WHEN scan_status = 'missing' THEN cost_price ELSE 0 END), 0) as total_value_at_risk
        FROM audit_count_lines
        WHERE count_id = $1
      `, [currentCountId])

      const totals = totalsResult.rows[0]

      // Update count totals
      const newStatus = action === 'complete' ? 'completed' : 'in_progress'

      await db.query(`
        UPDATE audit_counts SET
          total_assets = $1,
          assets_found = $2,
          assets_missing = $3,
          assets_surplus = $4,
          total_value_at_risk = $5,
          status = $6,
          completed_at = ${action === 'complete' ? 'NOW()' : 'completed_at'},
          updated_at = NOW()
        WHERE id = $7
      `, [
        totals.total_assets,
        totals.assets_found,
        totals.assets_missing,
        totals.assets_surplus,
        totals.total_value_at_risk,
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
          auditType: 'fixed_assets',
          totalAssets: totals.total_assets,
          assetsFound: totals.assets_found,
          assetsMissing: totals.assets_missing,
          assetsSurplus: totals.assets_surplus
        })
      ])

      return NextResponse.json({
        success: true,
        data: {
          countId: currentCountId,
          countNumber,
          status: newStatus,
          auditType: 'fixed_assets',
          totalAssets: parseInt(totals.total_assets),
          assetsFound: parseInt(totals.assets_found),
          assetsMissing: parseInt(totals.assets_missing),
          assetsSurplus: parseInt(totals.assets_surplus),
          totalValueAtRisk: parseFloat(totals.total_value_at_risk)
        },
        message: action === 'complete' ? 'Conteo de activos completado' : 'Conteo de activos guardado'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Tipo de auditoría no válido'
    }, { status: 400 })

  } catch (error) {
    console.error('[Audit Counts API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar conteo'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/audit/counts
 * Delete a count (ADMIN/SUPER_ADMIN only)
 * Query param: countId
 */
export async function DELETE(request: NextRequest) {
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

    // Solo ADMIN y SUPER_ADMIN pueden eliminar conteos de auditoría
    const deleteAllowedRoles = ['SUPER_ADMIN', 'ADMIN']
    if (payload.companyType !== 'market' || !deleteAllowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden eliminar conteos de auditoría' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const countId = searchParams.get('countId')

    if (!countId) {
      return NextResponse.json({ success: false, error: 'countId requerido' }, { status: 400 })
    }

    // Verify count exists and belongs to company
    const countCheck = await db.query(
      'SELECT id FROM audit_counts WHERE id = $1 AND company_id = $2',
      [countId, payload.companyId]
    )

    if (countCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
    }

    // Delete lines, history, then count
    await db.query('DELETE FROM audit_count_lines WHERE count_id = $1', [countId])
    await db.query('DELETE FROM audit_count_history WHERE count_id = $1', [countId])
    await db.query('DELETE FROM audit_counts WHERE id = $1', [countId])

    return NextResponse.json({
      success: true,
      message: 'Conteo eliminado correctamente'
    })

  } catch (error) {
    console.error('[Audit Counts API] DELETE Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar conteo'
    }, { status: 500 })
  }
}
