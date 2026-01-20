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
 * GET /api/market/warehouses/[id]/transfer-history
 * Get transfer history for a warehouse (sent and received)
 * Query params:
 *   - operationId: Get details of a specific operation
 *   - direction: 'sent' | 'received' | 'all' (default: 'all')
 *   - limit: number (default: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const warehouseId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const direction = searchParams.get('direction') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name, code FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]

    // If specific operation requested, get detailed info
    if (operationId) {
      const opId = parseInt(operationId)

      // Get operation details
      const operationResult = await db.query(`
        SELECT
          o.id,
          o.operation_number,
          o.operation_type,
          o.status,
          o.validation_status,
          o.notes,
          o.discrepancy_notes,
          o.source_warehouse_id,
          o.destination_warehouse_id,
          o.created_at,
          o.completed_at,
          o.created_by,
          sw.name as source_warehouse_name,
          sw.code as source_warehouse_code,
          dw.name as destination_warehouse_name,
          dw.code as destination_warehouse_code,
          CONCAT(u.firstname, ' ', u.lastname) as created_by_name
        FROM market_warehouse_operations o
        LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
        LEFT JOIN market_warehouses dw ON dw.id = o.destination_warehouse_id
        LEFT JOIN users u ON u.id = o.created_by
        WHERE o.id = $1
          AND o.company_id = $2
          AND o.operation_type = 'internal'
          AND (o.source_warehouse_id = $3 OR o.destination_warehouse_id = $3)
      `, [opId, payload.companyId, warehouseId])

      if (operationResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Operación no encontrada'
        }, { status: 404 })
      }

      const operation = operationResult.rows[0]

      // Get operation lines with product details - GROUP BY product+variant
      const linesResult = await db.query(`
        SELECT
          MIN(l.id) as line_id,
          l.product_id,
          l.variant_id,
          p.name as product_name,
          p.sku,
          p.barcode,
          v.variant_name,
          v.sku as variant_sku,
          v.barcode as variant_barcode,
          SUM(l.quantity_planned) as quantity_sent,
          SUM(COALESCE(l.quantity_validated, 0)) as quantity_received,
          ARRAY_AGG(l.id) as line_ids
        FROM market_warehouse_operation_lines l
        JOIN market_products p ON p.id = l.product_id
        LEFT JOIN market_product_variants v ON v.id = l.variant_id
        WHERE l.operation_id = $1
        GROUP BY l.product_id, l.variant_id, p.name, p.sku, p.barcode, v.variant_name, v.sku, v.barcode
        ORDER BY p.name, v.variant_name NULLS FIRST
      `, [opId])

      const lines = linesResult.rows.map(line => {
        const qtySent = parseFloat(line.quantity_sent) || 0
        const qtyReceived = parseFloat(line.quantity_received) || 0
        const difference = qtyReceived - qtySent
        return {
          lineId: line.line_id,
          productId: line.product_id,
          variantId: line.variant_id || null,
          productName: line.product_name,
          variantName: line.variant_name || null,
          sku: line.variant_sku || line.sku,
          barcode: line.variant_barcode || line.barcode || null,
          quantitySent: qtySent,
          quantityReceived: qtyReceived,
          difference: difference,
          isComplete: Math.abs(difference) < 0.001,
          hasDiscrepancy: Math.abs(difference) >= 0.001
        }
      })

      // Calculate totals
      const totalSent = lines.reduce((sum, l) => sum + l.quantitySent, 0)
      const totalReceived = lines.reduce((sum, l) => sum + l.quantityReceived, 0)
      const productsWithDiscrepancy = lines.filter(l => l.hasDiscrepancy).length

      return NextResponse.json({
        success: true,
        data: {
          operation: {
            id: operation.id,
            operationNumber: operation.operation_number,
            status: operation.status,
            validationStatus: operation.validation_status,
            notes: operation.notes,
            discrepancyNotes: operation.discrepancy_notes,
            createdAt: operation.created_at,
            completedAt: operation.completed_at,
            createdBy: operation.created_by_name,
            sourceWarehouse: {
              id: operation.source_warehouse_id,
              name: operation.source_warehouse_name,
              code: operation.source_warehouse_code
            },
            destinationWarehouse: {
              id: operation.destination_warehouse_id,
              name: operation.destination_warehouse_name,
              code: operation.destination_warehouse_code
            },
            direction: operation.source_warehouse_id === warehouseId ? 'sent' : 'received'
          },
          lines,
          summary: {
            totalProducts: lines.length,
            totalSent,
            totalReceived,
            totalDifference: totalReceived - totalSent,
            productsWithDiscrepancy,
            hasDiscrepancies: productsWithDiscrepancy > 0
          }
        }
      })
    }

    // Get list of transfers
    let whereClause = ''
    if (direction === 'sent') {
      whereClause = 'AND o.source_warehouse_id = $3'
    } else if (direction === 'received') {
      whereClause = 'AND o.destination_warehouse_id = $3'
    } else {
      whereClause = 'AND (o.source_warehouse_id = $3 OR o.destination_warehouse_id = $3)'
    }

    const transfersResult = await db.query(`
      SELECT
        o.id,
        o.operation_number,
        o.status,
        o.validation_status,
        o.source_warehouse_id,
        o.destination_warehouse_id,
        o.created_at,
        o.completed_at,
        sw.name as source_warehouse_name,
        dw.name as destination_warehouse_name,
        CONCAT(u.firstname, ' ', u.lastname) as created_by_name,
        (SELECT COUNT(DISTINCT CONCAT(product_id, '-', COALESCE(variant_id::text, 'null')))
         FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_products,
        (SELECT COALESCE(SUM(quantity_planned), 0)
         FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_sent,
        (SELECT COALESCE(SUM(COALESCE(quantity_validated, 0)), 0)
         FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_received
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = o.destination_warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.company_id = $1
        AND o.operation_type = 'internal'
        ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $2
    `, [payload.companyId, limit, warehouseId])

    const transfers = transfersResult.rows.map(t => {
      const totalSent = parseFloat(t.total_sent) || 0
      const totalReceived = parseFloat(t.total_received) || 0
      return {
        id: t.id,
        operationNumber: t.operation_number,
        status: t.status,
        validationStatus: t.validation_status,
        direction: t.source_warehouse_id === warehouseId ? 'sent' : 'received',
        sourceWarehouse: {
          id: t.source_warehouse_id,
          name: t.source_warehouse_name
        },
        destinationWarehouse: {
          id: t.destination_warehouse_id,
          name: t.destination_warehouse_name
        },
        createdAt: t.created_at,
        completedAt: t.completed_at,
        createdBy: t.created_by_name,
        totalProducts: parseInt(t.total_products) || 0,
        totalSent,
        totalReceived,
        hasDiscrepancies: t.validation_status === 'validated' && Math.abs(totalReceived - totalSent) >= 0.001
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code
        },
        transfers,
        totalCount: transfers.length
      }
    })

  } catch (error) {
    console.error('[Transfer History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}
