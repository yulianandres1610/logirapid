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
 * GET /api/market/stock-audit
 * Auditoría completa de stock - encuentra discrepancias y duplicados
 *
 * Query params:
 * - warehouseId: filtrar por almacén
 * - productId: filtrar por producto específico
 * - showAll: mostrar todos los productos, no solo los problemáticos
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

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const productId = searchParams.get('productId')
    const showAll = searchParams.get('showAll') === 'true'

    // 1. Encontrar productos con REGISTROS DUPLICADOS (tienen variant_id=NULL Y variant_id=X)
    const duplicatesQuery = `
      SELECT
        ws1.warehouse_id,
        w.name as warehouse_name,
        ws1.product_id,
        p.name as product_name,
        p.sku as product_sku,
        ws1.quantity_on_hand as stock_sin_variante,
        ws2.variant_id,
        v.variant_name,
        ws2.quantity_on_hand as stock_con_variante
      FROM market_warehouse_stock ws1
      JOIN market_warehouse_stock ws2 ON ws1.product_id = ws2.product_id
        AND ws1.warehouse_id = ws2.warehouse_id
        AND ws1.variant_id IS NULL
        AND ws2.variant_id IS NOT NULL
      JOIN market_warehouses w ON w.id = ws1.warehouse_id
      JOIN market_products p ON p.id = ws1.product_id
      LEFT JOIN market_product_variants v ON v.id = ws2.variant_id
      WHERE p.company_id = $1
        AND ws1.quantity_on_hand > 0
        ${warehouseId ? 'AND ws1.warehouse_id = $2' : ''}
        ${productId ? `AND ws1.product_id = $${warehouseId ? '3' : '2'}` : ''}
      ORDER BY p.name, v.variant_name
    `
    const duplicatesParams: (number | string)[] = [payload.companyId]
    if (warehouseId) duplicatesParams.push(parseInt(warehouseId))
    if (productId) duplicatesParams.push(parseInt(productId))

    const duplicates = await db.query(duplicatesQuery, duplicatesParams)

    // 2. Comparar stock en warehouse_stock vs lotes FIFO (purchase + consignment)
    const stockVsLotsQuery = `
      WITH warehouse_stock AS (
        SELECT
          ws.warehouse_id,
          ws.product_id,
          ws.variant_id,
          SUM(ws.quantity_on_hand) as total_warehouse_stock
        FROM market_warehouse_stock ws
        JOIN market_products p ON p.id = ws.product_id
        WHERE p.company_id = $1
          ${warehouseId ? 'AND ws.warehouse_id = $2' : ''}
          ${productId ? `AND ws.product_id = $${warehouseId ? '3' : '2'}` : ''}
        GROUP BY ws.warehouse_id, ws.product_id, ws.variant_id
      ),
      lots_stock AS (
        SELECT
          warehouse_id,
          product_id,
          variant_id,
          SUM(quantity_available) as total_lots_stock,
          'purchase' as lot_type
        FROM purchase_lot_inventory
        WHERE company_id = $1
          ${warehouseId ? 'AND warehouse_id = $2' : ''}
          ${productId ? `AND product_id = $${warehouseId ? '3' : '2'}` : ''}
        GROUP BY warehouse_id, product_id, variant_id

        UNION ALL

        SELECT
          warehouse_id,
          product_id,
          variant_id,
          SUM(quantity_available) as total_lots_stock,
          'consignment' as lot_type
        FROM consignment_lot_inventory
        WHERE company_id = $1
          ${warehouseId ? 'AND warehouse_id = $2' : ''}
          ${productId ? `AND product_id = $${warehouseId ? '3' : '2'}` : ''}
        GROUP BY warehouse_id, product_id, variant_id
      ),
      combined_lots AS (
        SELECT
          warehouse_id,
          product_id,
          variant_id,
          SUM(total_lots_stock) as total_lots
        FROM lots_stock
        GROUP BY warehouse_id, product_id, variant_id
      )
      SELECT
        COALESCE(ws.warehouse_id, cl.warehouse_id) as warehouse_id,
        w.name as warehouse_name,
        COALESCE(ws.product_id, cl.product_id) as product_id,
        p.name as product_name,
        COALESCE(ws.variant_id, cl.variant_id) as variant_id,
        v.variant_name,
        COALESCE(ws.total_warehouse_stock, 0) as stock_almacen,
        COALESCE(cl.total_lots, 0) as stock_lotes,
        COALESCE(ws.total_warehouse_stock, 0) - COALESCE(cl.total_lots, 0) as diferencia
      FROM warehouse_stock ws
      FULL OUTER JOIN combined_lots cl ON ws.warehouse_id = cl.warehouse_id
        AND ws.product_id = cl.product_id
        AND (ws.variant_id = cl.variant_id OR (ws.variant_id IS NULL AND cl.variant_id IS NULL))
      LEFT JOIN market_warehouses w ON w.id = COALESCE(ws.warehouse_id, cl.warehouse_id)
      LEFT JOIN market_products p ON p.id = COALESCE(ws.product_id, cl.product_id)
      LEFT JOIN market_product_variants v ON v.id = COALESCE(ws.variant_id, cl.variant_id)
      WHERE p.company_id = $1
        ${showAll ? '' : 'AND ABS(COALESCE(ws.total_warehouse_stock, 0) - COALESCE(cl.total_lots, 0)) > 0.01'}
      ORDER BY ABS(COALESCE(ws.total_warehouse_stock, 0) - COALESCE(cl.total_lots, 0)) DESC
      LIMIT 100
    `

    const stockVsLots = await db.query(stockVsLotsQuery, duplicatesParams)

    // 3. Productos con variantes que tienen stock a nivel producto (sin variante)
    const orphanStockQuery = `
      SELECT
        ws.warehouse_id,
        w.name as warehouse_name,
        ws.product_id,
        p.name as product_name,
        ws.quantity_on_hand as stock_huerfano,
        (SELECT COUNT(*) FROM market_product_variants WHERE product_id = p.id) as num_variantes,
        (SELECT string_agg(variant_name, ', ') FROM market_product_variants WHERE product_id = p.id) as variantes
      FROM market_warehouse_stock ws
      JOIN market_products p ON p.id = ws.product_id
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE p.company_id = $1
        AND ws.variant_id IS NULL
        AND ws.quantity_on_hand > 0
        AND EXISTS (SELECT 1 FROM market_product_variants WHERE product_id = p.id)
        ${warehouseId ? 'AND ws.warehouse_id = $2' : ''}
        ${productId ? `AND ws.product_id = $${warehouseId ? '3' : '2'}` : ''}
      ORDER BY ws.quantity_on_hand DESC
    `

    const orphanStock = await db.query(orphanStockQuery, duplicatesParams)

    // Resumen
    const totalDuplicados = duplicates.rows.length
    const totalDiscrepancias = stockVsLots.rows.filter(r => Math.abs(parseFloat(r.diferencia)) > 0.01).length
    const totalHuerfanos = orphanStock.rows.length

    return NextResponse.json({
      success: true,
      message: 'Auditoría de stock completada',
      resumen: {
        totalProductosConDuplicados: totalDuplicados,
        totalDiscrepanciasStockVsLotes: totalDiscrepancias,
        totalStockHuerfano: totalHuerfanos,
        tieneProblemas: totalDuplicados > 0 || totalDiscrepancias > 0 || totalHuerfanos > 0
      },
      duplicados: duplicates.rows.map(r => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        stockSinVariante: parseFloat(r.stock_sin_variante) || 0,
        variantId: r.variant_id,
        variantName: r.variant_name,
        stockConVariante: parseFloat(r.stock_con_variante) || 0,
        stockTotal: (parseFloat(r.stock_sin_variante) || 0) + (parseFloat(r.stock_con_variante) || 0)
      })),
      discrepanciasStockVsLotes: stockVsLots.rows.map(r => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        productId: r.product_id,
        productName: r.product_name,
        variantId: r.variant_id,
        variantName: r.variant_name,
        stockAlmacen: parseFloat(r.stock_almacen) || 0,
        stockLotes: parseFloat(r.stock_lotes) || 0,
        diferencia: parseFloat(r.diferencia) || 0
      })),
      stockHuerfano: orphanStock.rows.map(r => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        productId: r.product_id,
        productName: r.product_name,
        stockHuerfano: parseFloat(r.stock_huerfano) || 0,
        numVariantes: parseInt(r.num_variantes) || 0,
        variantes: r.variantes
      }))
    })

  } catch (error) {
    console.error('[Stock Audit] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en auditoría'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/stock-audit
 * Corrige problemas de stock encontrados en la auditoría
 *
 * Body:
 * - action: 'fix_duplicates' | 'fix_orphans' | 'recalculate_from_lots'
 * - warehouseId: opcional, filtrar por almacén
 * - productId: opcional, filtrar por producto específico
 * - dryRun: true para solo mostrar qué se haría sin ejecutar
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

    // Solo admins pueden corregir
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden corregir stock' }, { status: 403 })
    }

    const body = await request.json()
    const { action, warehouseId, productId, dryRun = false } = body

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Acción requerida: fix_duplicates, fix_orphans, recalculate_from_lots'
      }, { status: 400 })
    }

    const corrections: { type: string; description: string; before: number; after: number; productId: number; variantId: number | null }[] = []

    if (action === 'fix_duplicates' || action === 'fix_all') {
      // Encontrar y corregir duplicados: mover stock sin variante al registro con variante
      const duplicatesQuery = `
        SELECT
          ws1.id as id_sin_variante,
          ws1.warehouse_id,
          ws1.product_id,
          ws1.quantity_on_hand as stock_sin_variante,
          ws2.id as id_con_variante,
          ws2.variant_id,
          ws2.quantity_on_hand as stock_con_variante,
          p.name as product_name,
          v.variant_name
        FROM market_warehouse_stock ws1
        JOIN market_warehouse_stock ws2 ON ws1.product_id = ws2.product_id
          AND ws1.warehouse_id = ws2.warehouse_id
          AND ws1.variant_id IS NULL
          AND ws2.variant_id IS NOT NULL
        JOIN market_products p ON p.id = ws1.product_id
        LEFT JOIN market_product_variants v ON v.id = ws2.variant_id
        WHERE p.company_id = $1
          AND ws1.quantity_on_hand > 0
          ${warehouseId ? 'AND ws1.warehouse_id = $2' : ''}
          ${productId ? `AND ws1.product_id = $${warehouseId ? '3' : '2'}` : ''}
      `
      const params: (number)[] = [payload.companyId]
      if (warehouseId) params.push(parseInt(warehouseId))
      if (productId) params.push(parseInt(productId))

      const duplicates = await db.query(duplicatesQuery, params)

      for (const dup of duplicates.rows) {
        const stockSinVariante = parseFloat(dup.stock_sin_variante) || 0
        const stockConVariante = parseFloat(dup.stock_con_variante) || 0
        const nuevoStock = stockConVariante + stockSinVariante

        corrections.push({
          type: 'fix_duplicate',
          description: `${dup.product_name} - ${dup.variant_name}: Mover ${stockSinVariante} unidades de registro sin variante a variante`,
          before: stockConVariante,
          after: nuevoStock,
          productId: dup.product_id,
          variantId: dup.variant_id
        })

        if (!dryRun) {
          // Actualizar el registro con variante sumando el stock
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [nuevoStock, dup.id_con_variante])

          // Poner a 0 el registro sin variante
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = 0, updated_at = NOW()
            WHERE id = $1
          `, [dup.id_sin_variante])

          console.log(`[Stock Audit] Corregido duplicado: producto ${dup.product_id}, variante ${dup.variant_id}, stock ${stockSinVariante} -> variante`)
        }
      }
    }

    if (action === 'fix_orphans' || action === 'fix_all') {
      // Encontrar stock huérfano (sin variante pero el producto tiene variantes)
      // Si solo hay UNA variante, mover el stock a esa variante
      const orphansQuery = `
        SELECT
          ws.id,
          ws.warehouse_id,
          ws.product_id,
          ws.quantity_on_hand as stock_huerfano,
          p.name as product_name,
          (SELECT COUNT(*) FROM market_product_variants WHERE product_id = p.id) as num_variantes,
          (SELECT id FROM market_product_variants WHERE product_id = p.id LIMIT 1) as primera_variante_id,
          (SELECT variant_name FROM market_product_variants WHERE product_id = p.id LIMIT 1) as primera_variante_name
        FROM market_warehouse_stock ws
        JOIN market_products p ON p.id = ws.product_id
        WHERE p.company_id = $1
          AND ws.variant_id IS NULL
          AND ws.quantity_on_hand > 0
          AND EXISTS (SELECT 1 FROM market_product_variants WHERE product_id = p.id)
          ${warehouseId ? 'AND ws.warehouse_id = $2' : ''}
          ${productId ? `AND ws.product_id = $${warehouseId ? '3' : '2'}` : ''}
      `
      const params: (number)[] = [payload.companyId]
      if (warehouseId) params.push(parseInt(warehouseId))
      if (productId) params.push(parseInt(productId))

      const orphans = await db.query(orphansQuery, params)

      for (const orph of orphans.rows) {
        const numVariantes = parseInt(orph.num_variantes) || 0
        const stockHuerfano = parseFloat(orph.stock_huerfano) || 0

        // Solo corregir automáticamente si hay exactamente 1 variante
        // o si el productId es específico (el usuario quiere forzar la corrección)
        if (numVariantes === 1 || productId) {
          const targetVariantId = orph.primera_variante_id

          corrections.push({
            type: 'fix_orphan',
            description: `${orph.product_name}: Mover ${stockHuerfano} unidades huérfanas a variante "${orph.primera_variante_name}"`,
            before: 0,
            after: stockHuerfano,
            productId: orph.product_id,
            variantId: targetVariantId
          })

          if (!dryRun) {
            // Verificar si ya existe registro para la variante en este almacén
            const existingVariant = await db.query(`
              SELECT id, quantity_on_hand FROM market_warehouse_stock
              WHERE warehouse_id = $1 AND product_id = $2 AND variant_id = $3
            `, [orph.warehouse_id, orph.product_id, targetVariantId])

            if (existingVariant.rows.length > 0) {
              // Sumar al registro existente
              const currentStock = parseFloat(existingVariant.rows[0].quantity_on_hand) || 0
              await db.query(`
                UPDATE market_warehouse_stock
                SET quantity_on_hand = $1, updated_at = NOW()
                WHERE id = $2
              `, [currentStock + stockHuerfano, existingVariant.rows[0].id])
            } else {
              // Crear nuevo registro para la variante
              await db.query(`
                INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
              `, [orph.warehouse_id, orph.product_id, targetVariantId, stockHuerfano])
            }

            // Poner a 0 el registro huérfano
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = 0, updated_at = NOW()
              WHERE id = $1
            `, [orph.id])

            console.log(`[Stock Audit] Corregido huérfano: producto ${orph.product_id}, stock ${stockHuerfano} -> variante ${targetVariantId}`)
          }
        } else {
          corrections.push({
            type: 'skip_orphan',
            description: `${orph.product_name}: Tiene ${numVariantes} variantes, no se puede determinar automáticamente a cuál mover ${stockHuerfano} unidades`,
            before: stockHuerfano,
            after: stockHuerfano,
            productId: orph.product_id,
            variantId: null
          })
        }
      }
    }

    if (action === 'recalculate_from_lots') {
      // Recalcular stock desde los lotes FIFO (más agresivo, solo para emergencias)
      // Este recalcula el stock basándose en lo que dicen los lotes
      const lotsQuery = `
        WITH all_lots AS (
          SELECT warehouse_id, product_id, variant_id, SUM(quantity_available) as total
          FROM (
            SELECT warehouse_id, product_id, variant_id, quantity_available FROM purchase_lot_inventory WHERE company_id = $1
            UNION ALL
            SELECT warehouse_id, product_id, variant_id, quantity_available FROM consignment_lot_inventory WHERE company_id = $1
          ) lots
          GROUP BY warehouse_id, product_id, variant_id
        )
        SELECT
          al.*,
          ws.id as stock_id,
          ws.quantity_on_hand as stock_actual,
          p.name as product_name,
          v.variant_name
        FROM all_lots al
        LEFT JOIN market_warehouse_stock ws ON ws.warehouse_id = al.warehouse_id
          AND ws.product_id = al.product_id
          AND (ws.variant_id = al.variant_id OR (ws.variant_id IS NULL AND al.variant_id IS NULL))
        JOIN market_products p ON p.id = al.product_id
        LEFT JOIN market_product_variants v ON v.id = al.variant_id
        WHERE p.company_id = $1
          ${warehouseId ? 'AND al.warehouse_id = $2' : ''}
          ${productId ? `AND al.product_id = $${warehouseId ? '3' : '2'}` : ''}
      `
      const params: (number)[] = [payload.companyId]
      if (warehouseId) params.push(parseInt(warehouseId))
      if (productId) params.push(parseInt(productId))

      const lots = await db.query(lotsQuery, params)

      for (const lot of lots.rows) {
        const stockLotes = parseFloat(lot.total) || 0
        const stockActual = parseFloat(lot.stock_actual) || 0

        if (Math.abs(stockLotes - stockActual) > 0.01) {
          corrections.push({
            type: 'recalculate',
            description: `${lot.product_name}${lot.variant_name ? ' - ' + lot.variant_name : ''}: Stock ${stockActual} -> ${stockLotes} (según lotes FIFO)`,
            before: stockActual,
            after: stockLotes,
            productId: lot.product_id,
            variantId: lot.variant_id
          })

          if (!dryRun) {
            if (lot.stock_id) {
              await db.query(`
                UPDATE market_warehouse_stock
                SET quantity_on_hand = $1, updated_at = NOW()
                WHERE id = $2
              `, [stockLotes, lot.stock_id])
            } else {
              await db.query(`
                INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
              `, [lot.warehouse_id, lot.product_id, lot.variant_id, stockLotes])
            }

            console.log(`[Stock Audit] Recalculado: producto ${lot.product_id}, variante ${lot.variant_id}, stock ${stockActual} -> ${stockLotes}`)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Vista previa de correcciones (no se ejecutaron cambios)' : 'Correcciones aplicadas',
      dryRun,
      totalCorrecciones: corrections.length,
      correcciones: corrections
    })

  } catch (error) {
    console.error('[Stock Audit Fix] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir stock'
    }, { status: 500 })
  }
}
