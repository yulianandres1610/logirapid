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

/**
 * GET /api/market/products/[id]/debug-stock
 * Debug endpoint to investigate stock discrepancies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // 1. Get product info
    const productResult = await db.query(`
      SELECT id, name, sku, barcode
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productId, payload.companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const product = productResult.rows[0]

    // 2. Get ALL stock records for this product (including variants)
    const stockResult = await db.query(`
      SELECT
        mws.id as stock_id,
        mws.product_id,
        mws.variant_id,
        mpv.variant_name,
        mws.warehouse_id,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        mws.quantity_on_hand,
        mws.quantity_reserved,
        mws.quantity_on_hand - mws.quantity_reserved as available,
        mws.location_code,
        mws.last_movement_at,
        mws.created_at,
        mws.updated_at
      FROM market_warehouse_stock mws
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mws.variant_id
      WHERE mws.product_id = $1
      ORDER BY mw.name, mpv.variant_name NULLS FIRST
    `, [productId])

    // 3. Calculate totals from stock table
    const stockTotals = stockResult.rows.reduce((acc, row) => {
      const onHand = parseFloat(row.quantity_on_hand) || 0
      const reserved = parseFloat(row.quantity_reserved) || 0
      return {
        totalOnHand: acc.totalOnHand + onHand,
        totalReserved: acc.totalReserved + reserved,
        totalAvailable: acc.totalAvailable + (onHand - reserved)
      }
    }, { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 })

    // 4. Get ALL purchases for this product
    const purchasesResult = await db.query(`
      SELECT
        mpl.id,
        mp.purchase_number,
        mp.status,
        mpl.quantity,
        mpl.quantity_received,
        mpl.variant_id,
        mpv.variant_name,
        mw.name as warehouse_name,
        mp.created_at,
        mp.received_at
      FROM market_purchase_lines mpl
      JOIN market_purchases mp ON mp.id = mpl.purchase_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mpl.variant_id
      LEFT JOIN market_warehouses mw ON mw.id = mp.warehouse_id
      WHERE mpl.product_id = $1 AND mp.company_id = $2
      ORDER BY mp.created_at DESC
    `, [productId, payload.companyId])

    const purchaseTotals = purchasesResult.rows
      .filter(p => ['recibido', 'received', 'completed', 'parcial'].includes(p.status))
      .reduce((sum, p) => sum + (parseFloat(p.quantity_received) || parseFloat(p.quantity) || 0), 0)

    // 5. Get ALL POS sales for this product
    const salesResult = await db.query(`
      SELECT
        mpol.id,
        mpo.order_number,
        mpo.status,
        mpol.quantity,
        mpol.variant_id,
        mpv.variant_name,
        mw.name as warehouse_name,
        mpo.created_at
      FROM market_pos_order_lines mpol
      JOIN market_pos_orders mpo ON mpo.id = mpol.order_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mpol.variant_id
      LEFT JOIN market_warehouses mw ON mw.id = mpo.warehouse_id
      WHERE mpol.product_id = $1 AND mpo.company_id = $2
      ORDER BY mpo.created_at DESC
    `, [productId, payload.companyId])

    const salesTotals = salesResult.rows
      .filter(s => ['paid', 'completed'].includes(s.status))
      .reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0)

    // 6. Get ALL transfers
    const transfersResult = await db.query(`
      SELECT
        mwol.id,
        mwo.operation_number,
        mwo.operation_type,
        mwo.status,
        mwol.quantity_planned,
        mwol.quantity_done,
        mwol.variant_id,
        mpv.variant_name,
        sw.name as source_warehouse,
        dw.name as dest_warehouse,
        mwo.created_at,
        mwo.completed_at
      FROM market_warehouse_operation_lines mwol
      JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
      LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = mwo.destination_warehouse_id
      WHERE mwol.product_id = $1 AND mwo.company_id = $2
        AND mwo.operation_type IN ('internal', 'transfer')
      ORDER BY mwo.created_at DESC
    `, [productId, payload.companyId])

    // 7. Get ALL adjustments and scrap
    const adjustmentsResult = await db.query(`
      SELECT
        mwol.id,
        mwo.operation_number,
        mwo.operation_type,
        mwo.status,
        mwol.quantity_planned,
        mwol.quantity_done,
        mwol.scrap_reason,
        mwol.variant_id,
        mpv.variant_name,
        sw.name as warehouse_name,
        mwo.notes,
        mwo.created_at,
        mwo.completed_at
      FROM market_warehouse_operation_lines mwol
      JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
      LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
      WHERE mwol.product_id = $1 AND mwo.company_id = $2
        AND mwo.operation_type IN ('adjustment', 'scrap')
      ORDER BY mwo.created_at DESC
    `, [productId, payload.companyId])

    // 8. Get audit adjustments
    let auditAdjustments: Array<Record<string, unknown>> = []
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'audit_counts'
        ) as exists
      `)

      if (tableCheck.rows[0]?.exists) {
        const auditsResult = await db.query(`
          SELECT
            acl.id,
            ac.count_number,
            ac.status,
            acl.system_quantity,
            acl.counted_quantity,
            acl.difference,
            acl.variant_id,
            mpv.variant_name,
            mw.name as warehouse_name,
            ac.created_at,
            ac.applied_at
          FROM audit_count_lines acl
          JOIN audit_counts ac ON ac.id = acl.count_id
          LEFT JOIN market_product_variants mpv ON mpv.id = acl.variant_id
          LEFT JOIN market_warehouses mw ON mw.id = ac.warehouse_id
          WHERE acl.product_id = $1 AND ac.company_id = $2
          ORDER BY ac.created_at DESC
        `, [productId, payload.companyId])
        auditAdjustments = auditsResult.rows
      }
    } catch {
      // Table doesn't exist
    }

    // 9. Get production movements
    const productionResult = await db.query(`
      SELECT
        mwol.id,
        mwo.operation_number,
        mwo.operation_type,
        mwo.status,
        mwol.quantity_planned,
        mwol.quantity_done,
        mwol.variant_id,
        mpv.variant_name,
        sw.name as source_warehouse,
        dw.name as dest_warehouse,
        mpo.order_number as production_order,
        mpo.lot_number,
        mwo.created_at,
        mwo.completed_at
      FROM market_warehouse_operation_lines mwol
      JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
      LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = mwo.destination_warehouse_id
      LEFT JOIN market_production_orders mpo ON mpo.id = mwo.production_order_id
      WHERE mwol.product_id = $1 AND mwo.company_id = $2
        AND mwo.operation_type IN ('production_in', 'production_out')
      ORDER BY mwo.created_at DESC
    `, [productId, payload.companyId])

    // 10. Get wholesale/invoice sales
    const wholesaleResult = await db.query(`
      SELECT
        mil.id,
        mi.invoice_number,
        mi.status,
        mil.quantity,
        mil.quantity_delivered,
        mil.variant_id,
        mpv.variant_name,
        mw.name as warehouse_name,
        mc.name as customer_name,
        mi.created_at,
        mi.delivered_at
      FROM market_invoice_lines mil
      JOIN market_invoices mi ON mi.id = mil.invoice_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mil.variant_id
      LEFT JOIN market_warehouses mw ON mw.id = mi.warehouse_id
      LEFT JOIN market_customers mc ON mc.id = mi.customer_id
      WHERE mil.product_id = $1 AND mi.company_id = $2
      ORDER BY mi.created_at DESC
    `, [productId, payload.companyId])

    const wholesaleTotals = wholesaleResult.rows
      .filter(w => ['delivered', 'paid', 'completed'].includes(w.status))
      .reduce((sum, w) => sum + (parseFloat(w.quantity_delivered) || parseFloat(w.quantity) || 0), 0)

    // Calculate expected stock
    const adjustmentTotals = adjustmentsResult.rows
      .filter(a => ['done', 'completed', 'confirmed', 'validated'].includes(a.status))
      .reduce((sum, a) => {
        const qty = parseFloat(a.quantity_done) || parseFloat(a.quantity_planned) || 0
        // Scrap is always negative, adjustment depends on notes
        if (a.operation_type === 'scrap') return sum - qty
        const notesLower = (a.notes || '').toLowerCase()
        const isPositive = notesLower.includes('entrada') || notesLower.includes('agregar')
        return sum + (isPositive ? qty : -qty)
      }, 0)

    const auditTotals = auditAdjustments
      .filter((a): a is Record<string, unknown> => a.status === 'applied')
      .reduce((sum, a) => sum + (parseFloat(String(a.difference)) || 0), 0)

    const productionInTotals = productionResult.rows
      .filter(p => p.operation_type === 'production_in' && ['done', 'completed', 'confirmed', 'validated'].includes(p.status))
      .reduce((sum, p) => sum + (parseFloat(p.quantity_done) || parseFloat(p.quantity_planned) || 0), 0)

    const productionOutTotals = productionResult.rows
      .filter(p => p.operation_type === 'production_out' && ['done', 'completed', 'confirmed', 'validated'].includes(p.status))
      .reduce((sum, p) => sum + (parseFloat(p.quantity_done) || parseFloat(p.quantity_planned) || 0), 0)

    const expectedStock = purchaseTotals - salesTotals - wholesaleTotals + adjustmentTotals + auditTotals + productionInTotals - productionOutTotals

    const discrepancy = stockTotals.totalOnHand - expectedStock

    return NextResponse.json({
      success: true,
      data: {
        product,
        stockRecords: stockResult.rows.map(r => ({
          stockId: r.stock_id,
          warehouseId: r.warehouse_id,
          warehouseName: r.warehouse_name,
          warehouseCode: r.warehouse_code,
          variantId: r.variant_id,
          variantName: r.variant_name,
          quantityOnHand: parseFloat(r.quantity_on_hand) || 0,
          quantityReserved: parseFloat(r.quantity_reserved) || 0,
          available: parseFloat(r.available) || 0,
          locationCode: r.location_code,
          lastMovement: r.last_movement_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        stockTotals,
        movements: {
          purchases: {
            count: purchasesResult.rows.length,
            totalReceived: purchaseTotals,
            records: purchasesResult.rows.slice(0, 20)
          },
          posSales: {
            count: salesResult.rows.length,
            totalSold: salesTotals,
            records: salesResult.rows.slice(0, 20)
          },
          wholesaleSales: {
            count: wholesaleResult.rows.length,
            totalDelivered: wholesaleTotals,
            records: wholesaleResult.rows.slice(0, 20)
          },
          transfers: {
            count: transfersResult.rows.length,
            records: transfersResult.rows.slice(0, 20)
          },
          adjustments: {
            count: adjustmentsResult.rows.length,
            netChange: adjustmentTotals,
            records: adjustmentsResult.rows.slice(0, 20)
          },
          audits: {
            count: auditAdjustments.length,
            netChange: auditTotals,
            records: auditAdjustments.slice(0, 20)
          },
          production: {
            countIn: productionResult.rows.filter(p => p.operation_type === 'production_in').length,
            countOut: productionResult.rows.filter(p => p.operation_type === 'production_out').length,
            totalIn: productionInTotals,
            totalOut: productionOutTotals,
            records: productionResult.rows.slice(0, 20)
          }
        },
        analysis: {
          purchaseTotals,
          salesTotals,
          wholesaleTotals,
          adjustmentTotals,
          auditTotals,
          productionInTotals,
          productionOutTotals,
          expectedStock,
          actualStock: stockTotals.totalOnHand,
          discrepancy,
          discrepancyMessage: discrepancy === 0
            ? 'Stock coincide con movimientos'
            : discrepancy > 0
              ? `Hay ${discrepancy} unidades DE MÁS en stock (posible entrada no registrada)`
              : `Faltan ${Math.abs(discrepancy)} unidades en stock (posible salida no registrada)`
        }
      }
    })

  } catch (error) {
    console.error('[Debug Stock] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al analizar stock'
    }, { status: 500 })
  }
}
