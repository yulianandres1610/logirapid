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
 * GET /api/market/warehouses/[id]/pending-transfers
 * Get transfers pending validation for this warehouse (as destination)
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

    // Get pending transfers where this warehouse is the destination
    const transfersResult = await db.query(`
      SELECT
        o.id,
        o.operation_number,
        o.source_warehouse_id,
        sw.name as source_warehouse_name,
        sw.code as source_warehouse_code,
        o.status,
        o.validation_status,
        o.notes,
        o.created_at,
        o.created_by,
        CONCAT(u.firstname, ' ', u.lastname) as created_by_name,
        (SELECT COUNT(*) FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_products,
        (SELECT COALESCE(SUM(quantity), 0) FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_units
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.destination_warehouse_id = $1
        AND o.company_id = $2
        AND o.operation_type = 'internal'
        AND o.status = 'pending'
        AND o.validation_status = 'pending_validation'
      ORDER BY o.created_at DESC
    `, [warehouseId, payload.companyId])

    // Get lines for each transfer
    const transfers = await Promise.all(
      transfersResult.rows.map(async (transfer) => {
        const linesResult = await db.query(`
          SELECT
            l.id as line_id,
            l.product_id,
            p.name as product_name,
            p.sku,
            l.quantity_planned as quantity_expected,
            COALESCE(l.quantity_validated, 0) as quantity_validated
          FROM market_warehouse_operation_lines l
          JOIN market_products p ON p.id = l.product_id
          WHERE l.operation_id = $1
          ORDER BY p.name
        `, [transfer.id])

        return {
          id: transfer.id,
          operationNumber: transfer.operation_number,
          sourceWarehouse: {
            id: transfer.source_warehouse_id,
            name: transfer.source_warehouse_name,
            code: transfer.source_warehouse_code
          },
          status: transfer.status,
          validationStatus: transfer.validation_status,
          notes: transfer.notes,
          createdAt: transfer.created_at,
          createdBy: transfer.created_by_name,
          totalProducts: parseInt(transfer.total_products) || 0,
          totalUnits: parseInt(transfer.total_units) || 0,
          lines: linesResult.rows.map(line => ({
            lineId: line.line_id,
            productId: line.product_id,
            productName: line.product_name,
            sku: line.sku,
            quantityExpected: parseFloat(line.quantity_expected) || 0,
            quantityValidated: parseFloat(line.quantity_validated) || 0
          }))
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        warehouseId,
        warehouseName: warehouseCheck.rows[0].name,
        pendingCount: transfers.length,
        transfers
      }
    })

  } catch (error) {
    console.error('[Pending Transfers] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener transferencias pendientes'
    }, { status: 500 })
  }
}
