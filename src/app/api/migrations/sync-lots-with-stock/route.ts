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

interface LotSummary {
  source: 'consignment' | 'purchase' | 'production'
  totalAvailable: number
  lotCount: number
  lots: Array<{
    id: number
    lotNumber: string
    quantityAvailable: number
  }>
}

interface DiscrepancyInfo {
  productId: number
  productName: string
  sku: string
  warehouseId: number
  warehouseName: string
  stockOnHand: number
  lotsTotal: number
  discrepancy: number
  lotSummary: LotSummary[]
  action: string
}

/**
 * GET /api/migrations/sync-lots-with-stock
 * Analyze discrepancies between lots and warehouse stock
 *
 * Query params:
 * - productId: (optional) Analyze specific product
 * - warehouseId: (optional) Analyze specific warehouse
 * - preview: (optional) If "false", apply fixes. Default is preview only.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productIdParam = searchParams.get('productId')
    const warehouseIdParam = searchParams.get('warehouseId')
    const previewMode = searchParams.get('preview') !== 'false'

    const results: string[] = []
    const discrepancies: DiscrepancyInfo[] = []
    let fixedCount = 0

    results.push('=== ANALYZING LOTS vs WAREHOUSE STOCK ===')
    results.push(`Mode: ${previewMode ? 'PREVIEW (no changes)' : 'APPLY FIXES'}`)
    results.push(`Company ID: ${payload.companyId}`)

    // Build query conditions
    let productCondition = ''
    let warehouseCondition = ''
    const queryParams: (string | number)[] = [payload.companyId]

    if (productIdParam) {
      productCondition = ` AND mws.product_id = $${queryParams.length + 1}`
      queryParams.push(parseInt(productIdParam))
    }
    if (warehouseIdParam) {
      warehouseCondition = ` AND mws.warehouse_id = $${queryParams.length + 1}`
      queryParams.push(parseInt(warehouseIdParam))
    }

    // Get all product/warehouse combinations from market_warehouse_stock
    const stockResult = await db.query(`
      SELECT
        mws.product_id,
        mws.warehouse_id,
        mws.variant_id,
        mws.quantity_on_hand,
        mws.quantity_reserved,
        mp.name as product_name,
        mp.sku,
        mw.name as warehouse_name
      FROM market_warehouse_stock mws
      JOIN market_products mp ON mp.id = mws.product_id
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      WHERE mp.company_id = $1
        ${productCondition}
        ${warehouseCondition}
      ORDER BY mp.name, mw.name
    `, queryParams)

    results.push(`\nFound ${stockResult.rows.length} product/warehouse combinations to analyze`)

    for (const stock of stockResult.rows) {
      const productId = stock.product_id
      const warehouseId = stock.warehouse_id
      const variantId = stock.variant_id
      const stockOnHand = parseFloat(stock.quantity_on_hand) || 0

      const lotSummary: LotSummary[] = []

      // Get consignment lots
      const consignmentLots = await db.query(`
        SELECT id, lot_number, quantity_available
        FROM consignment_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4::int, 0)
          AND quantity_available > 0
        ORDER BY received_at ASC
      `, [productId, warehouseId, payload.companyId, variantId])

      if (consignmentLots.rows.length > 0) {
        const total = consignmentLots.rows.reduce((sum, l) => sum + (parseFloat(l.quantity_available) || 0), 0)
        lotSummary.push({
          source: 'consignment',
          totalAvailable: total,
          lotCount: consignmentLots.rows.length,
          lots: consignmentLots.rows.map(l => ({
            id: l.id,
            lotNumber: l.lot_number,
            quantityAvailable: parseFloat(l.quantity_available) || 0
          }))
        })
      }

      // Get purchase lots
      const purchaseLots = await db.query(`
        SELECT id, lot_number, quantity_available
        FROM purchase_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4::int, 0)
          AND quantity_available > 0
        ORDER BY created_at ASC
      `, [productId, warehouseId, payload.companyId, variantId])

      if (purchaseLots.rows.length > 0) {
        const total = purchaseLots.rows.reduce((sum, l) => sum + (parseFloat(l.quantity_available) || 0), 0)
        lotSummary.push({
          source: 'purchase',
          totalAvailable: total,
          lotCount: purchaseLots.rows.length,
          lots: purchaseLots.rows.map(l => ({
            id: l.id,
            lotNumber: l.lot_number,
            quantityAvailable: parseFloat(l.quantity_available) || 0
          }))
        })
      }

      // Get production lots
      const productionLots = await db.query(`
        SELECT id, lot_number, quantity_available
        FROM production_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4::int, 0)
          AND quantity_available > 0
        ORDER BY received_at ASC
      `, [productId, warehouseId, payload.companyId, variantId])

      if (productionLots.rows.length > 0) {
        const total = productionLots.rows.reduce((sum, l) => sum + (parseFloat(l.quantity_available) || 0), 0)
        lotSummary.push({
          source: 'production',
          totalAvailable: total,
          lotCount: productionLots.rows.length,
          lots: productionLots.rows.map(l => ({
            id: l.id,
            lotNumber: l.lot_number,
            quantityAvailable: parseFloat(l.quantity_available) || 0
          }))
        })
      }

      // Calculate total from lots
      const lotsTotal = lotSummary.reduce((sum, s) => sum + s.totalAvailable, 0)
      const discrepancy = stockOnHand - lotsTotal

      // Only record if there's a discrepancy
      if (Math.abs(discrepancy) > 0.001) {
        let action = ''

        if (discrepancy > 0) {
          // Stock > Lots: Stock has units without corresponding lots
          action = `Stock mayor que lotes: hay ${discrepancy} unidades en stock sin lote asignado. Se debería crear lote de ajuste o corregir stock.`
        } else {
          // Lots > Stock: Lots claim more than available in stock
          action = `Lotes mayor que stock: los lotes suman ${-discrepancy} unidades más que el stock. Se deberían ajustar los lotes (descontar del último FIFO).`
        }

        discrepancies.push({
          productId,
          productName: stock.product_name,
          sku: stock.sku,
          warehouseId,
          warehouseName: stock.warehouse_name,
          stockOnHand,
          lotsTotal,
          discrepancy,
          lotSummary,
          action
        })

        results.push(`\n⚠️  ${stock.product_name} (${stock.sku}) en ${stock.warehouse_name}:`)
        results.push(`    Stock: ${stockOnHand}, Lotes: ${lotsTotal}, Discrepancia: ${discrepancy > 0 ? '+' : ''}${discrepancy}`)

        // Apply fix if not in preview mode
        if (!previewMode) {
          if (discrepancy < 0) {
            // Lots > Stock: Need to reduce lots (LIFO - reduce newest first, but we use last in the array)
            let remaining = Math.abs(discrepancy)

            // Try to reduce from each source, starting with production, then purchase, then consignment
            const sources: Array<'production' | 'purchase' | 'consignment'> = ['production', 'purchase', 'consignment']

            for (const source of sources) {
              if (remaining <= 0) break

              const sourceSummary = lotSummary.find(s => s.source === source)
              if (!sourceSummary) continue

              // Reduce from last lot first (newest)
              for (let i = sourceSummary.lots.length - 1; i >= 0 && remaining > 0; i--) {
                const lot = sourceSummary.lots[i]
                const reduction = Math.min(remaining, lot.quantityAvailable)

                if (reduction > 0) {
                  const table = source === 'consignment' ? 'consignment_lot_inventory'
                    : source === 'purchase' ? 'purchase_lot_inventory'
                      : 'production_lot_inventory'

                  await db.query(`
                    UPDATE ${table}
                    SET quantity_available = quantity_available - $1
                    WHERE id = $2
                  `, [reduction, lot.id])

                  results.push(`    🔧 Reducido lote ${lot.lotNumber} (${source}): -${reduction}`)
                  remaining -= reduction
                }
              }
            }

            if (remaining > 0) {
              results.push(`    ⚠️ No se pudo reducir completamente: quedan ${remaining} unidades sin ajustar`)
            }
          } else {
            // Stock > Lots: Create adjustment lot
            // We'll create a "manual adjustment" lot in production_lot_inventory as fallback
            const lotNumber = `ADJ-${Date.now()}`

            await db.query(`
              INSERT INTO production_lot_inventory (
                company_id, warehouse_id, product_id, variant_id,
                lot_number, quantity_initial, quantity_available,
                unit_cost, production_order_id, received_at, created_at
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $6,
                0, NULL, NOW(), NOW()
              )
            `, [
              payload.companyId,
              warehouseId,
              productId,
              variantId,
              lotNumber,
              discrepancy
            ])

            results.push(`    🔧 Creado lote de ajuste ${lotNumber}: +${discrepancy}`)
          }

          fixedCount++
        }
      }
    }

    // Also check for "orphan" lots - lots in warehouses where there's no stock record
    results.push('\n\n=== CHECKING FOR ORPHAN LOTS ===')

    // Check consignment lots
    const orphanConsignment = await db.query(`
      SELECT
        cli.product_id, cli.warehouse_id, cli.lot_number, cli.quantity_available,
        mp.name as product_name, mw.name as warehouse_name
      FROM consignment_lot_inventory cli
      JOIN market_products mp ON mp.id = cli.product_id
      JOIN market_warehouses mw ON mw.id = cli.warehouse_id
      LEFT JOIN market_warehouse_stock mws ON
        mws.product_id = cli.product_id AND
        mws.warehouse_id = cli.warehouse_id AND
        COALESCE(mws.variant_id, 0) = COALESCE(cli.variant_id, 0)
      WHERE cli.company_id = $1 AND cli.quantity_available > 0 AND mws.id IS NULL
      ${productIdParam ? `AND cli.product_id = $2` : ''}
    `, productIdParam ? [payload.companyId, parseInt(productIdParam)] : [payload.companyId])

    for (const orphan of orphanConsignment.rows) {
      results.push(`\n⚠️  Lote huérfano (consignment): ${orphan.lot_number}`)
      results.push(`    Producto: ${orphan.product_name} en ${orphan.warehouse_name}`)
      results.push(`    Cantidad: ${orphan.quantity_available}`)

      if (!previewMode) {
        // Create missing stock record
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at
          ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [orphan.warehouse_id, orphan.product_id, parseFloat(orphan.quantity_available)])

        results.push(`    🔧 Creado registro de stock`)
        fixedCount++
      }
    }

    // Check purchase lots
    const orphanPurchase = await db.query(`
      SELECT
        pli.product_id, pli.warehouse_id, pli.lot_number, pli.quantity_available,
        mp.name as product_name, mw.name as warehouse_name
      FROM purchase_lot_inventory pli
      JOIN market_products mp ON mp.id = pli.product_id
      JOIN market_warehouses mw ON mw.id = pli.warehouse_id
      LEFT JOIN market_warehouse_stock mws ON
        mws.product_id = pli.product_id AND
        mws.warehouse_id = pli.warehouse_id AND
        COALESCE(mws.variant_id, 0) = COALESCE(pli.variant_id, 0)
      WHERE pli.company_id = $1 AND pli.quantity_available > 0 AND mws.id IS NULL
      ${productIdParam ? `AND pli.product_id = $2` : ''}
    `, productIdParam ? [payload.companyId, parseInt(productIdParam)] : [payload.companyId])

    for (const orphan of orphanPurchase.rows) {
      results.push(`\n⚠️  Lote huérfano (purchase): ${orphan.lot_number}`)
      results.push(`    Producto: ${orphan.product_name} en ${orphan.warehouse_name}`)
      results.push(`    Cantidad: ${orphan.quantity_available}`)

      if (!previewMode) {
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at
          ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [orphan.warehouse_id, orphan.product_id, parseFloat(orphan.quantity_available)])

        results.push(`    🔧 Creado registro de stock`)
        fixedCount++
      }
    }

    // Check production lots
    const orphanProduction = await db.query(`
      SELECT
        pli.product_id, pli.warehouse_id, pli.lot_number, pli.quantity_available,
        mp.name as product_name, mw.name as warehouse_name
      FROM production_lot_inventory pli
      JOIN market_products mp ON mp.id = pli.product_id
      JOIN market_warehouses mw ON mw.id = pli.warehouse_id
      LEFT JOIN market_warehouse_stock mws ON
        mws.product_id = pli.product_id AND
        mws.warehouse_id = pli.warehouse_id AND
        COALESCE(mws.variant_id, 0) = COALESCE(pli.variant_id, 0)
      WHERE pli.company_id = $1 AND pli.quantity_available > 0 AND mws.id IS NULL
      ${productIdParam ? `AND pli.product_id = $2` : ''}
    `, productIdParam ? [payload.companyId, parseInt(productIdParam)] : [payload.companyId])

    for (const orphan of orphanProduction.rows) {
      results.push(`\n⚠️  Lote huérfano (production): ${orphan.lot_number}`)
      results.push(`    Producto: ${orphan.product_name} en ${orphan.warehouse_name}`)
      results.push(`    Cantidad: ${orphan.quantity_available}`)

      if (!previewMode) {
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at
          ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [orphan.warehouse_id, orphan.product_id, parseFloat(orphan.quantity_available)])

        results.push(`    🔧 Creado registro de stock`)
        fixedCount++
      }
    }

    results.push('\n\n=== SUMMARY ===')
    results.push(`Total discrepancies found: ${discrepancies.length}`)
    results.push(`Orphan consignment lots: ${orphanConsignment.rows.length}`)
    results.push(`Orphan purchase lots: ${orphanPurchase.rows.length}`)
    results.push(`Orphan production lots: ${orphanProduction.rows.length}`)

    if (!previewMode) {
      results.push(`Fixes applied: ${fixedCount}`)
    } else {
      results.push(`\nTo apply fixes, call with ?preview=false`)
    }

    return NextResponse.json({
      success: true,
      message: previewMode ? 'Analysis complete (preview mode)' : `Sync complete - ${fixedCount} fixes applied`,
      data: {
        previewMode,
        discrepanciesCount: discrepancies.length,
        discrepancies,
        orphanLots: {
          consignment: orphanConsignment.rows.length,
          purchase: orphanPurchase.rows.length,
          production: orphanProduction.rows.length
        },
        fixedCount
      },
      details: results
    })

  } catch (error) {
    console.error('[Sync Lots With Stock] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/sync-lots-with-stock
 * Sync a specific product's lots with stock
 *
 * Body:
 * - productId: number
 * - warehouseId: number
 * - action: 'adjust_lots' | 'adjust_stock' | 'create_adjustment_lot'
 * - newStockValue?: number (for adjust_stock)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, warehouseId, action, newStockValue } = body as {
      productId: number
      warehouseId: number
      action: 'adjust_lots' | 'adjust_stock' | 'create_adjustment_lot'
      newStockValue?: number
    }

    if (!productId || !warehouseId || !action) {
      return NextResponse.json({
        success: false,
        error: 'productId, warehouseId y action son requeridos'
      }, { status: 400 })
    }

    // Get current stock
    const stockResult = await db.query(`
      SELECT quantity_on_hand, quantity_reserved
      FROM market_warehouse_stock
      WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
    `, [productId, warehouseId])

    const currentStock = parseFloat(stockResult.rows[0]?.quantity_on_hand) || 0

    // Calculate total from all lots
    const consignmentTotal = await db.query(`
      SELECT COALESCE(SUM(quantity_available), 0) as total
      FROM consignment_lot_inventory
      WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3 AND variant_id IS NULL
    `, [productId, warehouseId, payload.companyId])

    const purchaseTotal = await db.query(`
      SELECT COALESCE(SUM(quantity_available), 0) as total
      FROM purchase_lot_inventory
      WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3 AND variant_id IS NULL
    `, [productId, warehouseId, payload.companyId])

    const productionTotal = await db.query(`
      SELECT COALESCE(SUM(quantity_available), 0) as total
      FROM production_lot_inventory
      WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3 AND variant_id IS NULL
    `, [productId, warehouseId, payload.companyId])

    const lotsTotal = (parseFloat(consignmentTotal.rows[0]?.total) || 0) +
      (parseFloat(purchaseTotal.rows[0]?.total) || 0) +
      (parseFloat(productionTotal.rows[0]?.total) || 0)

    let result = ''

    switch (action) {
      case 'adjust_lots':
        // Adjust lots to match stock
        if (lotsTotal > currentStock) {
          // Need to reduce lots
          let remaining = lotsTotal - currentStock

          // Reduce production first, then purchase, then consignment
          const sources: Array<{ table: string; column: string }> = [
            { table: 'production_lot_inventory', column: 'received_at' },
            { table: 'purchase_lot_inventory', column: 'created_at' },
            { table: 'consignment_lot_inventory', column: 'received_at' }
          ]

          for (const source of sources) {
            if (remaining <= 0) break

            // Get lots for this source, newest first
            const lots = await db.query(`
              SELECT id, lot_number, quantity_available
              FROM ${source.table}
              WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
                AND variant_id IS NULL AND quantity_available > 0
              ORDER BY ${source.column} DESC
            `, [productId, warehouseId, payload.companyId])

            for (const lot of lots.rows) {
              if (remaining <= 0) break
              const available = parseFloat(lot.quantity_available) || 0
              const reduction = Math.min(remaining, available)

              if (reduction > 0) {
                await db.query(`
                  UPDATE ${source.table}
                  SET quantity_available = quantity_available - $1
                  WHERE id = $2
                `, [reduction, lot.id])

                remaining -= reduction
              }
            }
          }

          result = `Lotes ajustados: reducidos ${lotsTotal - currentStock} unidades para coincidir con stock`
        } else if (lotsTotal < currentStock) {
          // Create adjustment lot
          const diff = currentStock - lotsTotal
          const lotNumber = `ADJ-SYNC-${Date.now()}`

          await db.query(`
            INSERT INTO production_lot_inventory (
              company_id, warehouse_id, product_id, variant_id,
              lot_number, quantity_initial, quantity_available,
              unit_cost, production_order_id, received_at, created_at
            ) VALUES ($1, $2, $3, NULL, $4, $5, $5, 0, NULL, NOW(), NOW())
          `, [payload.companyId, warehouseId, productId, lotNumber, diff])

          result = `Creado lote de ajuste ${lotNumber} con ${diff} unidades`
        } else {
          result = 'No se requiere ajuste - lotes y stock ya coinciden'
        }
        break

      case 'adjust_stock':
        // Adjust stock to match lots
        const targetStock = newStockValue !== undefined ? newStockValue : lotsTotal

        if (stockResult.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE product_id = $2 AND warehouse_id = $3 AND variant_id IS NULL
          `, [targetStock, productId, warehouseId])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at
            ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW())
          `, [warehouseId, productId, targetStock])
        }

        result = `Stock actualizado: ${currentStock} -> ${targetStock}`

        // Update product total
        const allStockResult = await db.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as total
          FROM market_warehouse_stock
          WHERE product_id = $1 AND variant_id IS NULL
        `, [productId])

        const newTotal = parseFloat(allStockResult.rows[0]?.total) || 0
        await db.query(`
          UPDATE market_products SET quantity_on_hand = $1, updated_at = NOW() WHERE id = $2
        `, [newTotal, productId])

        break

      case 'create_adjustment_lot':
        // Create a manual adjustment lot for the discrepancy
        const discrepancy = currentStock - lotsTotal
        if (Math.abs(discrepancy) > 0.001) {
          const adjustmentLotNumber = `ADJ-MAN-${Date.now()}`

          await db.query(`
            INSERT INTO production_lot_inventory (
              company_id, warehouse_id, product_id, variant_id,
              lot_number, quantity_initial, quantity_available,
              unit_cost, production_order_id, received_at, created_at
            ) VALUES ($1, $2, $3, NULL, $4, $5, $5, 0, NULL, NOW(), NOW())
          `, [payload.companyId, warehouseId, productId, adjustmentLotNumber, discrepancy])

          result = `Creado lote de ajuste manual ${adjustmentLotNumber}: ${discrepancy > 0 ? '+' : ''}${discrepancy}`
        } else {
          result = 'No hay discrepancia que ajustar'
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida'
        }, { status: 400 })
    }

    // Log the adjustment
    await db.query(`
      INSERT INTO market_warehouse_operations (
        company_id, operation_number, operation_type, status,
        source_warehouse_id, notes, created_by, created_at, completed_at
      ) VALUES (
        $1, $2, 'adjustment', 'done',
        $3, $4, $5, NOW(), NOW()
      )
    `, [
      payload.companyId,
      `SYNC-${Date.now()}`,
      warehouseId,
      `Sincronización lotes-stock: ${action}. ${result}`,
      payload.userId
    ])

    return NextResponse.json({
      success: true,
      message: result,
      data: {
        productId,
        warehouseId,
        action,
        previousStock: currentStock,
        previousLots: lotsTotal,
        discrepancy: currentStock - lotsTotal
      }
    })

  } catch (error) {
    console.error('[Sync Lots POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar'
    }, { status: 500 })
  }
}
