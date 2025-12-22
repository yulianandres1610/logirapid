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

/**
 * GET /api/market/pos/inventory-count
 * Obtiene un conteo existente por sessionId o countId
 *
 * Query params:
 * - sessionId: ID de la sesión POS
 * - countId: ID del conteo específico
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
    const sessionId = searchParams.get('sessionId')
    const countId = searchParams.get('countId')

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
        WHERE c.session_id = $1
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

    return NextResponse.json({
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
        productsWithDifferences: count.products_with_differences,
        totalDifferenceValue: parseFloat(count.total_difference_value) || 0,
        notes: count.notes,
        lines: linesResult.rows.map(line => ({
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
          difference: parseFloat(line.difference) || 0,
          differenceValue: parseFloat(line.difference_value) || 0,
          soldToday: parseFloat(line.sold_today) || 0,
          scannedAt: line.scanned_at,
          notes: line.notes
        }))
      }
    })

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

    if (payload.role !== 'SUPER_ADMIN' && session.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para esta sesión'
      }, { status: 403 })
    }

    // Buscar conteo existente para esta sesión
    const existingCount = await db.query(`
      SELECT id, status FROM market_inventory_counts
      WHERE session_id = $1 AND status IN ('in_progress', 'completed')
      ORDER BY created_at DESC LIMIT 1
    `, [sessionId])

    let countId: number
    let countNumber: string

    if (existingCount.rows.length > 0) {
      // Si ya está completado, no permitir modificaciones
      if (existingCount.rows[0].status === 'completed' && action !== 'complete') {
        return NextResponse.json({
          success: false,
          error: 'El conteo ya fue completado'
        }, { status: 400 })
      }

      countId = existingCount.rows[0].id

      // Actualizar conteo existente
      await db.query(`
        UPDATE market_inventory_counts
        SET warehouse_id = $1, notes = $2, updated_at = NOW()
        WHERE id = $3
      `, [warehouseId, notes, countId])

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
      `, [payload.companyId, sessionId, warehouseId, countNumber, payload.userId, notes])

      countId = insertResult.rows[0].id
    }

    // Procesar líneas si se proporcionan
    if (lines && lines.length > 0) {
      // Eliminar líneas anteriores
      await db.query(`DELETE FROM market_inventory_count_lines WHERE count_id = $1`, [countId])

      // Obtener ventas del día para calcular expected
      const salesResult = await db.query(`
        SELECT
          ol.product_id,
          SUM(ol.quantity) as total_sold
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        WHERE o.pos_session_id = $1
          AND o.status IN ('paid', 'completed')
        GROUP BY ol.product_id
      `, [sessionId])

      const salesMap: Record<number, number> = {}
      salesResult.rows.forEach(row => {
        salesMap[row.product_id] = parseFloat(row.total_sold) || 0
      })

      // Obtener stock actual del almacén
      const productIds = lines.map(l => l.productId)
      const stockResult = await db.query(`
        SELECT product_id, COALESCE(quantity_on_hand, 0) as stock
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = ANY($2::int[])
      `, [warehouseId, productIds])

      const stockMap: Record<number, number> = {}
      stockResult.rows.forEach(row => {
        stockMap[row.product_id] = parseFloat(row.stock) || 0
      })

      // Insertar nuevas líneas
      for (const line of lines) {
        const soldToday = salesMap[line.productId] || 0
        const currentStock = stockMap[line.productId] || 0
        const expectedQuantity = currentStock // Stock actual del sistema
        const countedQuantity = line.countedQuantity || 0
        const difference = countedQuantity - expectedQuantity
        const unitPrice = line.unitPrice || 0
        const differenceValue = difference * unitPrice

        await db.query(`
          INSERT INTO market_inventory_count_lines (
            count_id, product_id, variant_id, product_name, product_sku,
            product_barcode, product_image, unit_price, expected_quantity, counted_quantity,
            difference, difference_value, sold_today, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          countId,
          line.productId,
          null, // variant_id
          line.productName || '',
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
      const totals = await db.query(`
        SELECT
          COUNT(*) as total_products,
          SUM(CASE WHEN difference != 0 THEN 1 ELSE 0 END) as products_with_differences,
          SUM(difference_value) as total_difference_value
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
      // Obtener líneas con diferencias para crear ajuste
      const diffLines = await db.query(`
        SELECT * FROM market_inventory_count_lines
        WHERE count_id = $1 AND difference != 0
      `, [countId])

      let adjustmentOperationId = null

      if (diffLines.rows.length > 0) {
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
          warehouseId,
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
      }

      // Marcar conteo como completado
      await db.query(`
        UPDATE market_inventory_counts
        SET status = 'completed', completed_at = NOW(), adjustment_operation_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [adjustmentOperationId, countId])
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
        warehouseId,
        warehouseName: finalCount.rows[0].warehouse_name,
        totalProducts: finalCount.rows[0].total_products,
        productsWithDifferences: finalCount.rows[0].products_with_differences,
        totalDifferenceValue: parseFloat(finalCount.rows[0].total_difference_value) || 0,
        adjustmentOperationId: finalCount.rows[0].adjustment_operation_id,
        lines: finalLines.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
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
