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

interface CountLine {
  productId: number
  variantId?: number | null
  variantName?: string
  productName?: string
  productSku?: string
  productBarcode?: string
  productImage?: string
  unitPrice?: number
  countedQuantity: number
  notes?: string
}

interface CountRequest {
  sessionId: number
  warehouseId: number
  lines: CountLine[]
  notes?: string
  action?: 'save' | 'complete'
}

// Auto-migration: ensure recount_history column exists
let _recountColumnMigrated = false
async function ensureRecountHistoryColumn() {
  if (_recountColumnMigrated) return
  try {
    await db.query(`
      ALTER TABLE market_inventory_counts
      ADD COLUMN IF NOT EXISTS recount_history JSONB DEFAULT '[]'::jsonb
    `)
    _recountColumnMigrated = true
  } catch {
    _recountColumnMigrated = true // Don't retry on error
  }
}

/**
 * GET /api/market/pos/inventory-count
 * Obtiene un conteo existente por sessionId o countId
 *
 * Query params:
 * - sessionId: ID de la sesión POS
 * - countId: ID del conteo específico
 * - status: 'in_progress' | 'completed' | 'any' (default: 'in_progress')
 */
export async function GET(request: NextRequest) {
  try {
    await ensureRecountHistoryColumn()
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
    const sessionId = searchParams.get('sessionId')
    const countId = searchParams.get('countId')
    const statusFilter = searchParams.get('status') || 'in_progress'

    if (!sessionId && !countId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId o countId es requerido'
      }, { status: 400 })
    }

    let countResult
    if (countId) {
      countResult = await db.query(`
        SELECT
          c.*,
          w.name as warehouse_name,
          s.session_code,
          u.firstname || ' ' || u.lastname as counted_by_name
        FROM market_inventory_counts c
        LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
        LEFT JOIN market_pos_sessions s ON c.session_id = s.id
        LEFT JOIN users u ON c.counted_by = u.id
        WHERE c.id = $1
      `, [countId])
    } else {
      // Buscar el conteo más reciente de la sesión
      // El filtro de status determina qué conteos buscar
      let statusCondition = ''
      if (statusFilter === 'in_progress') {
        statusCondition = "AND c.status = 'in_progress'"
      } else if (statusFilter === 'completed') {
        statusCondition = "AND c.status = 'completed'"
      }
      // Si statusFilter === 'any', no aplicar filtro de status

      countResult = await db.query(`
        SELECT
          c.*,
          w.name as warehouse_name,
          s.session_code,
          u.firstname || ' ' || u.lastname as counted_by_name
        FROM market_inventory_counts c
        LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
        LEFT JOIN market_pos_sessions s ON c.session_id = s.id
        LEFT JOIN users u ON c.counted_by = u.id
        WHERE c.session_id = $1 ${statusCondition}
        ORDER BY c.created_at DESC
        LIMIT 1
      `, [sessionId])
    }

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No hay conteo para esta sesión'
      })
    }

    const count = countResult.rows[0]

    // Verificar permisos
    if (payload.role !== 'SUPER_ADMIN' && count.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para acceder a este conteo'
      }, { status: 403 })
    }

    // Obtener líneas del conteo
    const linesResult = await db.query(`
      SELECT *
      FROM market_inventory_count_lines
      WHERE count_id = $1
      ORDER BY scanned_at DESC
    `, [count.id])

    // Recalcular productsWithDifferences y totalDifferenceValue con tolerancia
    // para evitar problemas de punto flotante (ej: 12.06 - 12.06 = -0.01)
    // Usamos > 0.01 (no >=) para excluir diferencias de exactamente 0.01 que son errores de redondeo
    const DIFF_TOLERANCE = 0.01
    let recalcProductsWithDifferences = 0
    let recalcTotalDifferenceValue = 0

    const lines = linesResult.rows.map(line => {
      const difference = parseFloat(line.difference) || 0
      const differenceValue = parseFloat(line.difference_value) || 0

      // Solo contar como diferencia si supera estrictamente la tolerancia
      // Esto excluye diferencias de 0.01, -0.01, 0.009, etc. que son errores de punto flotante
      if (Math.abs(difference) > DIFF_TOLERANCE) {
        recalcProductsWithDifferences++
        recalcTotalDifferenceValue += differenceValue
      }

      return {
        id: line.id,
        productId: line.product_id,
        variantId: line.variant_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productBarcode: line.product_barcode,
        productImage: line.product_image || null,
        unitPrice: parseFloat(line.unit_price) || 0,
        expectedQuantity: parseFloat(line.expected_quantity) || 0,
        countedQuantity: parseFloat(line.counted_quantity) || 0,
        difference: difference,
        differenceValue: differenceValue,
        soldToday: parseFloat(line.sold_today) || 0,
        scannedAt: line.scanned_at,
        notes: line.notes
      }
    })

    // Parse recount history
    let recountHistory: unknown[] = []
    try {
      if (count.recount_history) {
        recountHistory = typeof count.recount_history === 'string'
          ? JSON.parse(count.recount_history)
          : count.recount_history
      }
    } catch {
      recountHistory = []
    }

    const response = NextResponse.json({
      success: true,
      data: {
        id: count.id,
        companyId: count.company_id,
        sessionId: count.session_id,
        sessionCode: count.session_code,
        warehouseId: count.warehouse_id,
        warehouseName: count.warehouse_name,
        countNumber: count.count_number,
        status: count.status,
        countedBy: count.counted_by,
        countedByName: count.counted_by_name,
        startedAt: count.started_at,
        completedAt: count.completed_at,
        adjustmentOperationId: count.adjustment_operation_id,
        totalProducts: count.total_products,
        // Usar valores recalculados con tolerancia
        productsWithDifferences: recalcProductsWithDifferences,
        totalDifferenceValue: Math.round(recalcTotalDifferenceValue * 100) / 100,
        notes: count.notes,
        recountHistory,
        lines
      }
    })
    // Prevent browser caching - critical for recount flow
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return response

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Inventory Count GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener conteo'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/inventory-count
 * Crea o actualiza un conteo de inventario
 */
export async function POST(request: NextRequest) {
  try {
    await ensureRecountHistoryColumn()
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

    const body: CountRequest = await request.json()
    const { sessionId, warehouseId, lines, notes, action = 'save' } = body

    if (!sessionId || !warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId y warehouseId son requeridos'
      }, { status: 400 })
    }

    // Verificar que la sesión existe y está abierta
    const sessionCheck = await db.query(`
      SELECT s.*, t.warehouse_id as terminal_warehouse_id
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      WHERE s.id = $1
    `, [sessionId])

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = sessionCheck.rows[0]

    // SIEMPRE usar el warehouse del terminal, no el que envía el cliente
    const effectiveWarehouseId = session.terminal_warehouse_id || warehouseId

    if (payload.role !== 'SUPER_ADMIN' && session.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para esta sesión'
      }, { status: 403 })
    }

    // Buscar conteo existente para esta sesión
    // Primero buscar in_progress, si no existe buscar completed (para recontar)
    let existingCount = await db.query(`
      SELECT id, status FROM market_inventory_counts
      WHERE session_id = $1 AND status = 'in_progress'
      ORDER BY created_at DESC LIMIT 1
    `, [sessionId])

    // Si no hay in_progress, buscar completed para permitir recontar
    if (existingCount.rows.length === 0) {
      existingCount = await db.query(`
        SELECT id, status FROM market_inventory_counts
        WHERE session_id = $1 AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1
      `, [sessionId])
    }

    let countId: number
    let countNumber: string

    if (existingCount.rows.length > 0) {
      countId = existingCount.rows[0].id
      const existingStatus = existingCount.rows[0].status

      // Si el conteo estaba completado y se está recontando, volver a in_progress
      if (existingStatus === 'completed') {
        console.log(`[Inventory Count] Recontando conteo ${countId} - cambiando de completed a in_progress`)
        await db.query(`
          UPDATE market_inventory_counts
          SET warehouse_id = $1, notes = $2, status = 'in_progress', updated_at = NOW()
          WHERE id = $3
        `, [effectiveWarehouseId, notes, countId])
      } else {
        // Actualizar conteo existente in_progress
        await db.query(`
          UPDATE market_inventory_counts
          SET warehouse_id = $1, notes = $2, updated_at = NOW()
          WHERE id = $3
        `, [effectiveWarehouseId, notes, countId])
      }

      const countData = await db.query(`SELECT count_number FROM market_inventory_counts WHERE id = $1`, [countId])
      countNumber = countData.rows[0].count_number

    } else {
      // Crear nuevo conteo
      // Generar número de conteo
      const year = new Date().getFullYear()
      const seqResult = await db.query(`
        SELECT COALESCE(MAX(
          CAST(SUBSTRING(count_number FROM 'CNT-[0-9]{4}-([0-9]+)') AS INTEGER)
        ), 0) + 1 as next_seq
        FROM market_inventory_counts
        WHERE company_id = $1
        AND count_number LIKE $2
      `, [payload.companyId, `CNT-${year}-%`])

      const nextSeq = seqResult.rows[0].next_seq || 1
      countNumber = `CNT-${year}-${String(nextSeq).padStart(4, '0')}`

      const insertResult = await db.query(`
        INSERT INTO market_inventory_counts (
          company_id, session_id, warehouse_id, count_number,
          status, counted_by, started_at, notes
        ) VALUES ($1, $2, $3, $4, 'in_progress', $5, NOW(), $6)
        RETURNING id
      `, [payload.companyId, sessionId, effectiveWarehouseId, countNumber, payload.userId, notes])

      countId = insertResult.rows[0].id
    }

    // Procesar líneas si se proporcionan
    if (lines && lines.length > 0) {
      // Obtener líneas anteriores para detectar cambios (reconteo)
      const oldLinesResult = await db.query(`
        SELECT product_id, variant_id, product_name, counted_quantity
        FROM market_inventory_count_lines
        WHERE count_id = $1
      `, [countId])

      // Detectar productos con cantidades corregidas
      const oldLinesMap: Record<string, { productName: string; countedQuantity: number }> = {}
      for (const ol of oldLinesResult.rows) {
        const key = `${ol.product_id}:${ol.variant_id || 'null'}`
        oldLinesMap[key] = {
          productName: ol.product_name,
          countedQuantity: parseFloat(ol.counted_quantity) || 0
        }
      }

      const correctedProducts: Array<{ productName: string; oldQuantity: number; newQuantity: number }> = []
      for (const line of lines) {
        const key = `${line.productId}:${line.variantId || 'null'}`
        const oldLine = oldLinesMap[key]
        if (oldLine && oldLine.countedQuantity !== (line.countedQuantity || 0)) {
          correctedProducts.push({
            productName: line.productName || oldLine.productName,
            oldQuantity: oldLine.countedQuantity,
            newQuantity: line.countedQuantity || 0
          })
        }
      }

      // Si hay correcciones, registrar el reconteo en el historial
      if (correctedProducts.length > 0) {
        // Obtener nombre del usuario
        const userResult = await db.query(
          `SELECT firstname || ' ' || lastname as fullname FROM users WHERE id = $1`,
          [payload.userId]
        )
        const userName = userResult.rows[0]?.fullname || 'Usuario'

        // Obtener historial existente
        let existingHistory: unknown[] = []
        try {
          const histResult = await db.query(
            `SELECT recount_history FROM market_inventory_counts WHERE id = $1`,
            [countId]
          )
          if (histResult.rows[0]?.recount_history) {
            existingHistory = typeof histResult.rows[0].recount_history === 'string'
              ? JSON.parse(histResult.rows[0].recount_history)
              : histResult.rows[0].recount_history
          }
        } catch { /* ignore */ }

        const recountEntry = {
          timestamp: new Date().toISOString(),
          userId: payload.userId,
          userName,
          correctedProducts
        }

        const updatedHistory = [...(Array.isArray(existingHistory) ? existingHistory : []), recountEntry]

        await db.query(
          `UPDATE market_inventory_counts SET recount_history = $1::jsonb WHERE id = $2`,
          [JSON.stringify(updatedHistory), countId]
        )

        console.log(`[Inventory Count] Reconteo registrado por ${userName}: ${correctedProducts.length} producto(s) corregido(s)`)
      }

      // Eliminar líneas anteriores
      await db.query(`DELETE FROM market_inventory_count_lines WHERE count_id = $1`, [countId])

      // Obtener ventas del día agrupadas por producto Y variante
      const salesResult = await db.query(`
        SELECT
          ol.product_id,
          ol.variant_id,
          SUM(ol.quantity) as total_sold
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        WHERE o.pos_session_id = $1
          AND o.status IN ('paid', 'completed')
        GROUP BY ol.product_id, ol.variant_id
      `, [sessionId])

      // Mapa de ventas con clave compuesta: productId:variantId
      const salesMap: Record<string, number> = {}
      // También mantener suma de ventas por producto (para conteos sin variant_id)
      const salesSumByProduct: Record<number, number> = {}

      salesResult.rows.forEach(row => {
        const productId = parseInt(row.product_id)
        const variantId = row.variant_id
        const soldQty = parseFloat(row.total_sold) || 0

        const key = `${productId}:${variantId || 'null'}`
        salesMap[key] = soldQty

        // Sumar todas las ventas al total del producto
        salesSumByProduct[productId] = (salesSumByProduct[productId] || 0) + soldQty
      })

      // Obtener stock actual del almacén (productos y variantes)
      const productIds = lines.map(l => l.productId)
      const stockResult = await db.query(`
        SELECT product_id, variant_id, COALESCE(quantity_on_hand, 0) as stock
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = ANY($2::int[])
      `, [effectiveWarehouseId, productIds])

      // Mapa de stock con clave compuesta: productId:variantId
      const stockMap: Record<string, number> = {}
      // También mantener suma de todas las variantes por producto (para conteos sin variant_id)
      const stockSumByProduct: Record<number, number> = {}
      // Stock a nivel producto (variant_id IS NULL) - puede ser stock antiguo no migrado
      const productLevelStock: Record<number, number> = {}

      stockResult.rows.forEach(row => {
        const productId = parseInt(row.product_id)
        const variantId = row.variant_id
        const stockQty = parseFloat(row.stock) || 0

        const key = `${productId}:${variantId || 'null'}`
        stockMap[key] = stockQty

        // Si es un registro de variante (variant_id no es null), sumar al total del producto
        if (variantId !== null) {
          stockSumByProduct[productId] = (stockSumByProduct[productId] || 0) + stockQty
        } else {
          // Guardar stock a nivel producto (sin variante)
          productLevelStock[productId] = stockQty
        }
      })

      // Insertar nuevas líneas
      // NUEVA FÓRMULA: difference = (Stock inicial - Vendido) - Contado
      // Stock inicial ≈ Stock actual + Vendido hoy (si no hay otras operaciones)
      // Entonces: difference = Stock actual - Contado
      // Positivo = FALTANTE (hay menos de lo esperado)
      // Negativo = SOBRANTE (hay más de lo esperado)

      // IMPORTANTE: Contar cuántas variantes de cada producto están siendo contadas
      // para evitar duplicar el stock a nivel producto
      const variantsPerProduct: Record<number, number[]> = {}
      for (const line of lines) {
        if (line.variantId) {
          if (!variantsPerProduct[line.productId]) {
            variantsPerProduct[line.productId] = []
          }
          variantsPerProduct[line.productId].push(line.variantId)
        }
      }

      // Track de productos cuyo stock a nivel producto ya fue asignado
      const productStockAssigned: Set<number> = new Set()

      for (const line of lines) {
        const salesKey = `${line.productId}:${line.variantId || 'null'}`
        // Ventas del día: si no hay variant_id, usar suma de todas las variantes
        let soldToday = salesMap[salesKey] || 0
        if (soldToday === 0 && !line.variantId) {
          soldToday = salesSumByProduct[line.productId] || 0
        }

        const stockKey = `${line.productId}:${line.variantId || 'null'}`

        // Buscar stock según el tipo de línea:
        // 1. Si la línea tiene variant_id específico, buscar stock de esa variante
        // 2. Si la línea NO tiene variant_id (conteo agregado de producto):
        //    a. Primero buscar registro de stock a nivel producto (variant_id IS NULL)
        //    b. Si no existe, SUMAR todos los stocks de variantes del producto
        let currentStock = stockMap[stockKey] || 0

        if (line.variantId) {
          // Contando una variante específica
          // Solo sumar stock a nivel producto si:
          // 1. Hay stock a nivel producto
          // 2. Es la PRIMERA variante de este producto que procesamos (evitar duplicación)
          // 3. Solo hay UNA variante siendo contada de este producto (si hay múltiples, no podemos saber a cuál asignar)
          const oldProductStock = productLevelStock[line.productId] || 0
          const variantsBeingCounted = variantsPerProduct[line.productId]?.length || 0

          if (oldProductStock > 0 && !productStockAssigned.has(line.productId)) {
            if (variantsBeingCounted === 1) {
              // Solo una variante siendo contada, podemos sumar el stock huérfano
              console.log(`[Inventory Count] Producto ${line.productId} variante ${line.variantId}: sumando stock nivel producto (${oldProductStock}) + stock variante (${currentStock})`)
              currentStock += oldProductStock
              productStockAssigned.add(line.productId)
            } else {
              // Múltiples variantes siendo contadas, NO sumar para evitar duplicación
              console.warn(`[Inventory Count] ADVERTENCIA: Producto ${line.productId} tiene ${variantsBeingCounted} variantes siendo contadas Y stock huérfano (${oldProductStock}). No se suma para evitar duplicación. Use /api/market/stock-audit para corregir.`)
            }
          }
        } else if (currentStock === 0) {
          // Contando producto sin variante y no hay stock a nivel producto
          // Usar suma de todas las variantes
          currentStock = stockSumByProduct[line.productId] || 0
        }
        // Stock esperado = Stock inicial del día - Vendido = (currentStock + soldToday) - soldToday = currentStock
        const expectedQuantity = currentStock
        const countedQuantity = line.countedQuantity || 0
        // Fórmula: (Stock inicial - Vendido) - Contado = expectedQuantity - countedQuantity
        // Positivo = FALTANTE, Negativo = SOBRANTE
        // Redondear a 2 decimales para evitar errores de punto flotante
        const rawDifference = expectedQuantity - countedQuantity
        const difference = Math.round(rawDifference * 100) / 100
        const unitPrice = line.unitPrice || 0
        // El valor de la diferencia: positivo = pérdida (faltante), negativo = ganancia (sobrante)
        const differenceValue = Math.round(difference * unitPrice * 100) / 100

        // El nombre del producto ya viene formateado desde el cliente (incluye variante si aplica)
        const displayName = line.productName || ''

        await db.query(`
          INSERT INTO market_inventory_count_lines (
            count_id, product_id, variant_id, product_name, product_sku,
            product_barcode, product_image, unit_price, expected_quantity, counted_quantity,
            difference, difference_value, sold_today, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          countId,
          line.productId,
          line.variantId || null,
          displayName,
          line.productSku || '',
          line.productBarcode || '',
          line.productImage || null,
          unitPrice,
          expectedQuantity,
          countedQuantity,
          difference,
          differenceValue,
          soldToday,
          line.notes || null
        ])
      }

      // Actualizar totales en el conteo
      // Usar tolerancia de 0.001 para ignorar errores de punto flotante
      const totals = await db.query(`
        SELECT
          COUNT(*) as total_products,
          SUM(CASE WHEN ABS(difference) >= 0.01 THEN 1 ELSE 0 END) as products_with_differences,
          SUM(CASE WHEN ABS(difference) >= 0.01 THEN difference_value ELSE 0 END) as total_difference_value
        FROM market_inventory_count_lines
        WHERE count_id = $1
      `, [countId])

      await db.query(`
        UPDATE market_inventory_counts
        SET
          total_products = $1,
          products_with_differences = $2,
          total_difference_value = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        parseInt(totals.rows[0].total_products) || 0,
        parseInt(totals.rows[0].products_with_differences) || 0,
        parseFloat(totals.rows[0].total_difference_value) || 0,
        countId
      ])
    }

    // Si es completar, marcar como completado y crear operación de ajuste
    if (action === 'complete') {
      // Obtener líneas con diferencias significativas (>=0.01) para crear ajuste
      const diffLines = await db.query(`
        SELECT * FROM market_inventory_count_lines
        WHERE count_id = $1 AND ABS(difference) >= 0.01
      `, [countId])

      let adjustmentOperationId = null
      const hasDifferences = diffLines.rows.length > 0

      // Calcular valor total de faltantes (ahora diferencias POSITIVAS = faltante)
      const shortageLines = diffLines.rows.filter(line => parseFloat(line.difference) > 0)
      const totalShortageValue = shortageLines.reduce((sum, line) => {
        return sum + Math.abs(parseFloat(line.difference_value) || 0)
      }, 0)

      if (hasDifferences) {
        // Crear operación de ajuste
        const opYear = new Date().getFullYear()
        const opSeqResult = await db.query(`
          SELECT COALESCE(MAX(
            CAST(SUBSTRING(operation_number FROM 'ADJ-[0-9]{4}-([0-9]+)') AS INTEGER)
          ), 0) + 1 as next_seq
          FROM market_warehouse_operations
          WHERE company_id = $1
          AND operation_number LIKE $2
        `, [payload.companyId, `ADJ-${opYear}-%`])

        const opNextSeq = opSeqResult.rows[0].next_seq || 1
        const operationNumber = `ADJ-${opYear}-${String(opNextSeq).padStart(4, '0')}`

        const opInsert = await db.query(`
          INSERT INTO market_warehouse_operations (
            company_id, operation_number, operation_type,
            source_warehouse_id, reference_type, reference_id,
            status, notes, created_by, created_at
          ) VALUES ($1, $2, 'adjustment', $3, 'inventory_count', $4, 'pending_approval', $5, $6, NOW())
          RETURNING id
        `, [
          payload.companyId,
          operationNumber,
          effectiveWarehouseId,
          countId,
          `Ajuste por conteo de cierre POS - Sesión #${session.session_code || sessionId}`,
          payload.userId
        ])

        adjustmentOperationId = opInsert.rows[0].id

        // Crear líneas de la operación de ajuste
        for (const line of diffLines.rows) {
          await db.query(`
            INSERT INTO market_warehouse_operation_lines (
              operation_id, product_id, variant_id,
              quantity_planned, quantity_done, line_status
            ) VALUES ($1, $2, $3, $4, 0, 'pending')
          `, [
            adjustmentOperationId,
            parseInt(line.product_id),
            line.variant_id ? parseInt(line.variant_id) : null,
            Math.round(Number(line.difference)) || 0
          ])
        }

        // Si hay faltantes, registrar el valor en la sesión POS para el cuadre de caja
        if (totalShortageValue > 0) {
          await db.query(`
            UPDATE market_pos_sessions
            SET inventory_shortage_value = $1
            WHERE id = $2
          `, [totalShortageValue, sessionId])
        }
      }

      // Determinar estado final: auto-aprobar si NO hay diferencias
      const finalStatus = hasDifferences ? 'completed' : 'approved'
      const autoApproved = !hasDifferences

      // Marcar conteo con estado apropiado
      await db.query(`
        UPDATE market_inventory_counts
        SET
          status = $1,
          completed_at = NOW(),
          adjustment_operation_id = $2,
          auto_approved = $3,
          approved_by = CASE WHEN $3 THEN $4::integer ELSE NULL END,
          approved_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $5
      `, [finalStatus, adjustmentOperationId, autoApproved, payload.userId, countId])
    }

    // Obtener el conteo actualizado
    const finalCount = await db.query(`
      SELECT
        c.*,
        w.name as warehouse_name
      FROM market_inventory_counts c
      LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
      WHERE c.id = $1
    `, [countId])

    const finalLines = await db.query(`
      SELECT * FROM market_inventory_count_lines WHERE count_id = $1 ORDER BY scanned_at DESC
    `, [countId])

    return NextResponse.json({
      success: true,
      message: action === 'complete' ? 'Conteo completado exitosamente' : 'Conteo guardado exitosamente',
      data: {
        id: countId,
        countNumber,
        status: finalCount.rows[0].status,
        warehouseId: effectiveWarehouseId,
        warehouseName: finalCount.rows[0].warehouse_name,
        totalProducts: finalCount.rows[0].total_products,
        productsWithDifferences: finalCount.rows[0].products_with_differences,
        totalDifferenceValue: parseFloat(finalCount.rows[0].total_difference_value) || 0,
        adjustmentOperationId: finalCount.rows[0].adjustment_operation_id,
        lines: finalLines.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          variantId: line.variant_id || null,
          productName: line.product_name,
          productSku: line.product_sku,
          productBarcode: line.product_barcode,
          unitPrice: parseFloat(line.unit_price) || 0,
          expectedQuantity: parseFloat(line.expected_quantity) || 0,
          countedQuantity: parseFloat(line.counted_quantity) || 0,
          difference: parseFloat(line.difference) || 0,
          differenceValue: parseFloat(line.difference_value) || 0,
          soldToday: parseFloat(line.sold_today) || 0
        }))
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Inventory Count POST] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al guardar conteo'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/pos/inventory-count
 * Re-evalúa conteos completados y auto-aprueba si no tienen diferencias reales
 * Body: { countId?: number, sessionId?: number, action: 'reevaluate' }
 */
export async function PATCH(request: NextRequest) {
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
    const { countId, sessionId, action } = body as { countId?: number; sessionId?: number; action?: string; countNumber?: string; productNameSearch?: string; newCountedQuantity?: number }

    if (action !== 'reevaluate' && action !== 'update_line') {
      return NextResponse.json({
        success: false,
        error: 'Acción no válida'
      }, { status: 400 })
    }

    // ACTION: update_line - Directly fix a count line's counted quantity
    if (action === 'update_line') {
      const { countNumber: cn, productNameSearch: pns, newCountedQuantity: nq } = body as { countNumber?: string; productNameSearch?: string; newCountedQuantity?: number }

      if (!cn || !pns || nq === undefined || nq === null) {
        return NextResponse.json({
          success: false,
          error: 'countNumber, productNameSearch, y newCountedQuantity son requeridos'
        }, { status: 400 })
      }

      // Find count by number
      const countRes = await db.query(`
        SELECT id, status, company_id, warehouse_id
        FROM market_inventory_counts
        WHERE count_number = $1
      `, [cn])

      if (countRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Conteo ${cn} no encontrado` }, { status: 404 })
      }

      const cnt = countRes.rows[0]

      if (payload.role !== 'SUPER_ADMIN' && cnt.company_id !== payload.companyId) {
        return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
      }

      // Find line by product name (partial match)
      const lineRes = await db.query(`
        SELECT id, product_name, counted_quantity, expected_quantity, unit_price
        FROM market_inventory_count_lines
        WHERE count_id = $1 AND LOWER(product_name) LIKE $2
      `, [cnt.id, `%${pns.toLowerCase()}%`])

      if (lineRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Producto "${pns}" no encontrado en el conteo` }, { status: 404 })
      }

      const line = lineRes.rows[0]
      const oldQty = parseFloat(line.counted_quantity) || 0
      const expectedQty = parseFloat(line.expected_quantity) || 0
      const unitPrice = parseFloat(line.unit_price) || 0
      const newDifference = Math.round((expectedQty - nq) * 100) / 100
      const newDiffValue = Math.round(newDifference * unitPrice * 100) / 100

      // Update the line
      await db.query(`
        UPDATE market_inventory_count_lines
        SET counted_quantity = $1, difference = $2, difference_value = $3
        WHERE id = $4
      `, [nq, newDifference, newDiffValue, line.id])

      // Recalculate count totals
      const totals = await db.query(`
        SELECT
          COUNT(*) as total_products,
          SUM(CASE WHEN ABS(difference) >= 0.01 THEN 1 ELSE 0 END) as products_with_differences,
          SUM(CASE WHEN ABS(difference) >= 0.01 THEN difference_value ELSE 0 END) as total_difference_value
        FROM market_inventory_count_lines
        WHERE count_id = $1
      `, [cnt.id])

      await db.query(`
        UPDATE market_inventory_counts
        SET
          total_products = $1,
          products_with_differences = $2,
          total_difference_value = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        parseInt(totals.rows[0].total_products) || 0,
        parseInt(totals.rows[0].products_with_differences) || 0,
        parseFloat(totals.rows[0].total_difference_value) || 0,
        cnt.id
      ])

      // If count was completed, reset to in_progress for re-review
      if (cnt.status === 'completed') {
        await db.query(`
          UPDATE market_inventory_counts SET status = 'in_progress', updated_at = NOW() WHERE id = $1
        `, [cnt.id])
      }

      console.log(`[Inventory Count] Line fixed: ${line.product_name} qty ${oldQty} → ${nq} (count ${cn})`)

      return NextResponse.json({
        success: true,
        message: `Línea corregida: ${line.product_name} de ${oldQty} a ${nq}`,
        data: {
          countId: cnt.id,
          countNumber: cn,
          productName: line.product_name,
          oldQuantity: oldQty,
          newQuantity: nq,
          expectedQuantity: expectedQty,
          newDifference,
          newDiffValue
        }
      })
    }

    // Buscar el conteo
    let countResult
    if (countId) {
      countResult = await db.query(`
        SELECT c.*, s.session_code
        FROM market_inventory_counts c
        LEFT JOIN market_pos_sessions s ON c.session_id = s.id
        WHERE c.id = $1
      `, [countId])
    } else if (sessionId) {
      countResult = await db.query(`
        SELECT c.*, s.session_code
        FROM market_inventory_counts c
        LEFT JOIN market_pos_sessions s ON c.session_id = s.id
        WHERE c.session_id = $1
        ORDER BY c.created_at DESC
        LIMIT 1
      `, [sessionId])
    } else {
      return NextResponse.json({
        success: false,
        error: 'countId o sessionId es requerido'
      }, { status: 400 })
    }

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conteo no encontrado'
      }, { status: 404 })
    }

    const count = countResult.rows[0]

    // Verificar permisos
    if (payload.role !== 'SUPER_ADMIN' && count.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para este conteo'
      }, { status: 403 })
    }

    // Solo re-evaluar conteos completados (no aprobados ya)
    if (count.status !== 'completed') {
      return NextResponse.json({
        success: true,
        message: `Conteo tiene status '${count.status}', no requiere re-evaluación`,
        data: { countId: count.id, status: count.status, updated: false }
      })
    }

    // Obtener líneas y recalcular diferencias con tolerancia
    const linesResult = await db.query(`
      SELECT * FROM market_inventory_count_lines WHERE count_id = $1
    `, [count.id])

    const DIFF_TOLERANCE = 0.01
    let realDifferencesCount = 0
    let realDifferenceValue = 0

    for (const line of linesResult.rows) {
      const difference = parseFloat(line.difference) || 0
      const differenceValue = parseFloat(line.difference_value) || 0

      // Solo contar como diferencia real si supera estrictamente la tolerancia
      if (Math.abs(difference) > DIFF_TOLERANCE) {
        realDifferencesCount++
        realDifferenceValue += differenceValue
      }
    }

    // Si no hay diferencias reales, auto-aprobar
    if (realDifferencesCount === 0) {
      // Actualizar totales en el conteo
      await db.query(`
        UPDATE market_inventory_counts
        SET
          products_with_differences = 0,
          total_difference_value = 0,
          status = 'approved',
          auto_approved = true,
          approved_by = $1,
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [payload.userId, count.id])

      // Limpiar el valor de faltante en la sesión POS si existe
      if (count.session_id) {
        await db.query(`
          UPDATE market_pos_sessions
          SET inventory_shortage_value = 0
          WHERE id = $1
        `, [count.session_id])
      }

      // Si había una operación de ajuste pendiente, cancelarla
      if (count.adjustment_operation_id) {
        await db.query(`
          UPDATE market_warehouse_operations
          SET status = 'cancelled', notes = COALESCE(notes, '') || ' - Cancelado: sin diferencias reales después de re-evaluación'
          WHERE id = $1 AND status = 'pending_approval'
        `, [count.adjustment_operation_id])
      }

      return NextResponse.json({
        success: true,
        message: 'Conteo re-evaluado y auto-aprobado (sin diferencias reales)',
        data: {
          countId: count.id,
          countNumber: count.count_number,
          status: 'approved',
          updated: true,
          previousDifferences: count.products_with_differences,
          realDifferences: 0
        }
      })
    } else {
      // Hay diferencias reales, actualizar los totales correctos
      await db.query(`
        UPDATE market_inventory_counts
        SET
          products_with_differences = $1,
          total_difference_value = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [realDifferencesCount, Math.round(realDifferenceValue * 100) / 100, count.id])

      return NextResponse.json({
        success: true,
        message: `Conteo re-evaluado: ${realDifferencesCount} diferencias reales encontradas`,
        data: {
          countId: count.id,
          countNumber: count.count_number,
          status: 'completed',
          updated: true,
          previousDifferences: count.products_with_differences,
          realDifferences: realDifferencesCount,
          totalDifferenceValue: Math.round(realDifferenceValue * 100) / 100
        }
      })
    }

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Inventory Count PATCH] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al re-evaluar conteo'
    }, { status: 500 })
  }
}
