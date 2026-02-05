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
 * GET /api/migrations/consolidate-duplicate-lots
 * Diagnose duplicate lots and stock discrepancies
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Find duplicate consignment lots (same lot_number, product, different warehouses)
    const duplicateLots = await db.query(`
      SELECT
        lot_number, product_id,
        COUNT(*) as lot_count,
        array_agg(id) as lot_ids,
        array_agg(warehouse_id) as warehouse_ids,
        array_agg(quantity_available) as quantities
      FROM consignment_lot_inventory
      WHERE company_id = $1
      GROUP BY lot_number, product_id
      HAVING COUNT(*) > 1
    `, [payload.companyId])

    // Find lots with 0 quantity (should be cleaned up)
    const emptyLots = await db.query(`
      SELECT
        cli.id, cli.lot_number, cli.product_id, cli.warehouse_id,
        cli.quantity_initial, cli.quantity_available, cli.quantity_sold,
        p.name as product_name, w.name as warehouse_name
      FROM consignment_lot_inventory cli
      JOIN market_products p ON p.id = cli.product_id
      JOIN market_warehouses w ON w.id = cli.warehouse_id
      WHERE cli.company_id = $1 AND cli.quantity_available <= 0
    `, [payload.companyId])

    // Find stock vs lot discrepancies
    const discrepancies = await db.query(`
      SELECT
        ws.warehouse_id, ws.product_id, ws.quantity_on_hand as warehouse_stock,
        COALESCE(lots.total_available, 0) as lot_total,
        ws.quantity_on_hand - COALESCE(lots.total_available, 0) as difference,
        p.name as product_name, w.name as warehouse_name
      FROM market_warehouse_stock ws
      JOIN market_products p ON p.id = ws.product_id
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      LEFT JOIN (
        SELECT warehouse_id, product_id, SUM(quantity_available) as total_available
        FROM consignment_lot_inventory
        WHERE company_id = $1
        GROUP BY warehouse_id, product_id
      ) lots ON lots.warehouse_id = ws.warehouse_id AND lots.product_id = ws.product_id
      WHERE ws.product_id IN (
        SELECT DISTINCT product_id FROM consignment_lot_inventory WHERE company_id = $1
      )
      AND ABS(ws.quantity_on_hand - COALESCE(lots.total_available, 0)) > 0.01
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        duplicateLots: duplicateLots.rows.map(d => ({
          lotNumber: d.lot_number,
          productId: d.product_id,
          count: parseInt(d.lot_count),
          lotIds: d.lot_ids,
          warehouseIds: d.warehouse_ids,
          quantities: d.quantities.map((q: string) => parseFloat(q))
        })),
        emptyLots: emptyLots.rows.map(l => ({
          lotId: l.id,
          lotNumber: l.lot_number,
          productId: l.product_id,
          productName: l.product_name,
          warehouseId: l.warehouse_id,
          warehouseName: l.warehouse_name,
          quantityInitial: parseFloat(l.quantity_initial),
          quantityAvailable: parseFloat(l.quantity_available),
          quantitySold: parseFloat(l.quantity_sold) || 0
        })),
        stockDiscrepancies: discrepancies.rows.map(d => ({
          warehouseId: d.warehouse_id,
          warehouseName: d.warehouse_name,
          productId: d.product_id,
          productName: d.product_name,
          warehouseStock: parseFloat(d.warehouse_stock),
          lotTotal: parseFloat(d.lot_total),
          difference: parseFloat(d.difference)
        })),
        summary: {
          duplicateLotGroups: duplicateLots.rows.length,
          emptyLotsCount: emptyLots.rows.length,
          stockDiscrepanciesCount: discrepancies.rows.length
        }
      }
    })

  } catch (error) {
    console.error('[Consolidate Lots GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al diagnosticar'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/consolidate-duplicate-lots
 * Fix duplicate lots and stock discrepancies
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const results = {
      lotsDeleted: 0,
      lotsConsolidated: 0,
      stockSynced: 0
    }

    await db.query('BEGIN')

    try {
      // 1. Delete empty lots (quantity_available = 0)
      const deleteEmpty = await db.query(`
        DELETE FROM consignment_lot_inventory
        WHERE company_id = $1 AND quantity_available <= 0
        RETURNING id, lot_number
      `, [payload.companyId])

      results.lotsDeleted = deleteEmpty.rowCount || 0
      console.log(`[Consolidate] Deleted ${results.lotsDeleted} empty lots`)

      // 2. Find and consolidate duplicate lots (same lot_number, product, variant)
      const duplicates = await db.query(`
        SELECT
          lot_number, product_id, variant_id,
          array_agg(id ORDER BY received_at ASC) as lot_ids,
          array_agg(warehouse_id ORDER BY received_at ASC) as warehouse_ids,
          array_agg(quantity_available ORDER BY received_at ASC) as quantities,
          array_agg(quantity_sold ORDER BY received_at ASC) as sold_quantities
        FROM consignment_lot_inventory
        WHERE company_id = $1
        GROUP BY lot_number, product_id, variant_id
        HAVING COUNT(*) > 1
      `, [payload.companyId])

      for (const dup of duplicates.rows) {
        const lotIds = dup.lot_ids
        const warehouseIds = dup.warehouse_ids
        const quantities = dup.quantities.map((q: string) => parseFloat(q) || 0)
        const soldQuantities = dup.sold_quantities.map((q: string) => parseFloat(q) || 0)

        // Keep the first lot (oldest), consolidate others into it
        const keepLotId = lotIds[0]
        const keepWarehouseId = warehouseIds[0]

        for (let i = 1; i < lotIds.length; i++) {
          const mergeLotId = lotIds[i]
          const mergeWarehouseId = warehouseIds[i]
          const mergeQty = quantities[i]
          const mergeSold = soldQuantities[i]

          if (mergeWarehouseId === keepWarehouseId) {
            // Same warehouse - consolidate into main lot
            await db.query(`
              UPDATE consignment_lot_inventory
              SET quantity_available = quantity_available + $1,
                  quantity_sold = quantity_sold + $2
              WHERE id = $3
            `, [mergeQty, mergeSold, keepLotId])

            await db.query(`DELETE FROM consignment_lot_inventory WHERE id = $1`, [mergeLotId])
            results.lotsConsolidated++
            console.log(`[Consolidate] Merged lot ${mergeLotId} into ${keepLotId}`)
          }
          // If different warehouses, that's valid (same lot distributed across locations)
        }
      }

      // 3. Sync warehouse stock with lot totals for consignment products
      const consignmentProducts = await db.query(`
        SELECT DISTINCT product_id, warehouse_id, variant_id
        FROM consignment_lot_inventory
        WHERE company_id = $1
      `, [payload.companyId])

      for (const cp of consignmentProducts.rows) {
        // Get total from lots
        const lotTotal = await db.query(`
          SELECT COALESCE(SUM(quantity_available), 0) as total
          FROM consignment_lot_inventory
          WHERE company_id = $1 AND warehouse_id = $2 AND product_id = $3
            AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
        `, [payload.companyId, cp.warehouse_id, cp.product_id, cp.variant_id])

        const lotQty = parseFloat(lotTotal.rows[0].total) || 0

        // Update warehouse stock to match
        const updated = await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3
            AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
          RETURNING id, quantity_on_hand
        `, [lotQty, cp.warehouse_id, cp.product_id, cp.variant_id])

        if (updated.rowCount && updated.rowCount > 0) {
          results.stockSynced++
          console.log(`[Consolidate] Synced stock for product ${cp.product_id} in warehouse ${cp.warehouse_id}: ${lotQty}`)
        }
      }

      // 4. Also sync the main product quantity
      const productsToSync = await db.query(`
        SELECT DISTINCT product_id
        FROM consignment_lot_inventory
        WHERE company_id = $1
      `, [payload.companyId])

      for (const p of productsToSync.rows) {
        await db.query(`
          UPDATE market_products
          SET quantity_on_hand = (
            SELECT COALESCE(SUM(quantity_on_hand), 0)
            FROM market_warehouse_stock
            WHERE product_id = $1
          ), updated_at = NOW()
          WHERE id = $1
        `, [p.product_id])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Consolidación completada',
        data: results
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consolidate Lots POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al consolidar'
    }, { status: 500 })
  }
}
