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
 * POST /api/market/consumables/[id]/dispatch
 * Dispatch consumable to employee. Validates sufficient stock. Uses transaction.
 */
export async function POST(
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
    const itemId = parseInt(id)
    const body = await request.json()
    const { quantity, employeeId, reason, notes } = body

    if (!quantity || quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad debe ser mayor a 0'
      }, { status: 400 })
    }

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un empleado'
      }, { status: 400 })
    }

    // Use transaction
    const result = await db.transaction(async (client) => {
      // Get current stock with lock
      const itemResult = await client.query(`
        SELECT id, current_stock, company_id FROM market_consumable_items
        WHERE id = $1 ${payload.role !== 'SUPER_ADMIN' ? 'AND company_id = $2' : ''}
        FOR UPDATE
      `, payload.role !== 'SUPER_ADMIN' ? [itemId, payload.companyId] : [itemId])

      if (itemResult.rows.length === 0) {
        throw new Error('NOT_FOUND')
      }

      const currentStock = parseFloat(itemResult.rows[0].current_stock) || 0
      const companyId = itemResult.rows[0].company_id

      if (quantity > currentStock) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      const newStock = currentStock - quantity

      // Get employee name
      let employeeName = ''
      try {
        const empResult = await client.query(`
          SELECT
            COALESCE(u.firstname || ' ' || u.lastname, 'Empleado #' || me.id) as full_name
          FROM market_employees me
          LEFT JOIN users u ON me.user_id = u.id
          WHERE me.id = $1
        `, [employeeId])
        if (empResult.rows.length > 0) {
          employeeName = empResult.rows[0].full_name
        }
      } catch {
        employeeName = `Empleado #${employeeId}`
      }

      // Insert movement
      await client.query(`
        INSERT INTO market_consumable_movements (
          company_id, item_id, movement_type, quantity,
          employee_id, employee_name, reason,
          stock_before, stock_after, notes, created_by
        ) VALUES (
          $1, $2, 'dispatch', $3,
          $4, $5, $6,
          $7, $8, $9, $10
        )
      `, [
        companyId, itemId, quantity,
        employeeId, employeeName, reason || null,
        currentStock, newStock, notes || null, payload.userId
      ])

      // Update stock
      await client.query(`
        UPDATE market_consumable_items
        SET current_stock = $1, updated_at = NOW()
        WHERE id = $2
      `, [newStock, itemId])

      return { stockBefore: currentStock, stockAfter: newStock, employeeName }
    })

    return NextResponse.json({
      success: true,
      message: 'Despacho registrado exitosamente',
      data: {
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
        quantity,
        employeeName: result.employeeName
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables Dispatch] Error:', err)

    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Consumible no encontrado'
      }, { status: 404 })
    }

    if (err.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({
        success: false,
        error: 'Stock insuficiente para el despacho solicitado'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al registrar despacho'
    }, { status: 500 })
  }
}
