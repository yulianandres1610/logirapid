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

interface ValidateLineRequest {
  lineId: number
  quantityValidated: number
}

interface ValidateRequest {
  lines: ValidateLineRequest[]
}

/**
 * POST /api/market/warehouses/[id]/operations/[operationId]/validate
 * Update validated quantities for transfer lines (incremental scan validation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
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

    const { id, operationId } = await params
    const warehouseId = parseInt(id)
    const opId = parseInt(operationId)

    if (isNaN(warehouseId) || isNaN(opId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs inválidos'
      }, { status: 400 })
    }

    // Verify warehouse and operation belong to company
    const operationCheck = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.source_warehouse_id, o.destination_warehouse_id
      FROM market_warehouse_operations o
      WHERE o.id = $1
        AND o.destination_warehouse_id = $2
        AND o.company_id = $3
        AND o.operation_type = 'internal'
    `, [opId, warehouseId, payload.companyId])

    if (operationCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationCheck.rows[0]

    // Verify operation is pending validation
    if (operation.status !== 'pending' || operation.validation_status !== 'pending_validation') {
      return NextResponse.json({
        success: false,
        error: 'Esta operación no está pendiente de validación'
      }, { status: 400 })
    }

    const body: ValidateRequest = await request.json()
    const { lines } = body

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe incluir al menos una línea para validar'
      }, { status: 400 })
    }

    // Update each line's validated quantity
    for (const line of lines) {
      // Verify line belongs to this operation
      const lineCheck = await db.query(`
        SELECT id, quantity, quantity_validated
        FROM market_warehouse_operation_lines
        WHERE id = $1 AND operation_id = $2
      `, [line.lineId, opId])

      if (lineCheck.rows.length === 0) {
        continue // Skip invalid lines
      }

      // Update validated quantity
      await db.query(`
        UPDATE market_warehouse_operation_lines
        SET quantity_validated = $1
        WHERE id = $2
      `, [line.quantityValidated, line.lineId])
    }

    // Get updated lines with validation status
    const updatedLinesResult = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        p.name as product_name,
        p.sku,
        l.quantity as quantity_expected,
        l.quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      WHERE l.operation_id = $1
      ORDER BY p.name
    `, [opId])

    const updatedLines = updatedLinesResult.rows.map(line => ({
      lineId: line.line_id,
      productId: line.product_id,
      productName: line.product_name,
      sku: line.sku,
      quantityExpected: parseFloat(line.quantity_expected) || 0,
      quantityValidated: parseFloat(line.quantity_validated) || 0,
      isComplete: parseFloat(line.quantity_validated) >= parseFloat(line.quantity_expected)
    }))

    // Calculate progress
    const totalExpected = updatedLines.reduce((sum, l) => sum + l.quantityExpected, 0)
    const totalValidated = updatedLines.reduce((sum, l) => sum + l.quantityValidated, 0)
    const completedLines = updatedLines.filter(l => l.isComplete).length
    const progressPercent = totalExpected > 0 ? Math.round((totalValidated / totalExpected) * 100) : 0

    return NextResponse.json({
      success: true,
      message: 'Validación actualizada',
      data: {
        operationId: opId,
        operationNumber: operation.operation_number,
        lines: updatedLines,
        progress: {
          totalLines: updatedLines.length,
          completedLines,
          totalExpected,
          totalValidated,
          progressPercent,
          isAllValidated: completedLines === updatedLines.length
        }
      }
    })

  } catch (error) {
    console.error('[Validate Transfer] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al validar transferencia'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/warehouses/[id]/operations/[operationId]/validate
 * Get current validation status for a transfer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
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

    const { id, operationId } = await params
    const warehouseId = parseInt(id)
    const opId = parseInt(operationId)

    if (isNaN(warehouseId) || isNaN(opId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs inválidos'
      }, { status: 400 })
    }

    // Get operation with source warehouse info
    const operationResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status, o.notes,
        o.source_warehouse_id, o.destination_warehouse_id,
        o.created_at, o.created_by,
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
        AND o.destination_warehouse_id = $2
        AND o.company_id = $3
        AND o.operation_type = 'internal'
    `, [opId, warehouseId, payload.companyId])

    if (operationResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationResult.rows[0]

    // Get lines
    const linesResult = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        p.name as product_name,
        p.sku,
        p.barcode,
        l.quantity as quantity_expected,
        l.quantity_validated,
        l.notes
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      WHERE l.operation_id = $1
      ORDER BY p.name
    `, [opId])

    const lines = linesResult.rows.map(line => ({
      lineId: line.line_id,
      productId: line.product_id,
      productName: line.product_name,
      sku: line.sku,
      barcode: line.barcode,
      quantityExpected: parseFloat(line.quantity_expected) || 0,
      quantityValidated: parseFloat(line.quantity_validated) || 0,
      isComplete: parseFloat(line.quantity_validated) >= parseFloat(line.quantity_expected),
      notes: line.notes
    }))

    // Calculate progress
    const totalExpected = lines.reduce((sum, l) => sum + l.quantityExpected, 0)
    const totalValidated = lines.reduce((sum, l) => sum + l.quantityValidated, 0)
    const completedLines = lines.filter(l => l.isComplete).length
    const progressPercent = totalExpected > 0 ? Math.round((totalValidated / totalExpected) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        operation: {
          id: operation.id,
          operationNumber: operation.operation_number,
          status: operation.status,
          validationStatus: operation.validation_status,
          notes: operation.notes,
          createdAt: operation.created_at,
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
          }
        },
        lines,
        progress: {
          totalLines: lines.length,
          completedLines,
          totalExpected,
          totalValidated,
          progressPercent,
          isAllValidated: completedLines === lines.length
        }
      }
    })

  } catch (error) {
    console.error('[Get Validation Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estado de validación'
    }, { status: 500 })
  }
}
