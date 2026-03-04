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
 * GET /api/market/consumables/[id]
 * Get consumable item detail with recent movements
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
    const itemId = parseInt(id)

    const itemResult = await db.query(`
      SELECT
        i.*,
        w.name as warehouse_name,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM market_consumable_items i
      LEFT JOIN market_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
      ${payload.role !== 'SUPER_ADMIN' ? 'AND i.company_id = $2' : ''}
    `, payload.role !== 'SUPER_ADMIN' ? [itemId, payload.companyId] : [itemId])

    if (itemResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Consumible no encontrado' }, { status: 404 })
    }

    const row = itemResult.rows[0]

    // Get recent movements
    const movementsResult = await db.query(`
      SELECT
        m.*,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM market_consumable_movements m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.item_id = $1
      ORDER BY m.created_at DESC
      LIMIT 20
    `, [itemId])

    const movements = movementsResult.rows.map(m => ({
      id: m.id,
      movementType: m.movement_type,
      quantity: parseFloat(m.quantity),
      unitCost: m.unit_cost ? parseFloat(m.unit_cost) : null,
      supplierName: m.supplier_name,
      invoiceRef: m.invoice_ref,
      employeeId: m.employee_id,
      employeeName: m.employee_name,
      reason: m.reason,
      stockBefore: parseFloat(m.stock_before),
      stockAfter: parseFloat(m.stock_after),
      notes: m.notes,
      createdByName: m.created_by_name,
      createdAt: m.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        code: row.code,
        description: row.description,
        category: row.category,
        unit: row.unit,
        currentStock: parseFloat(row.current_stock) || 0,
        minStock: parseFloat(row.min_stock) || 0,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        imageUrl: row.image_url,
        status: row.status,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        movements
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables GET detail] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener consumible'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/consumables/[id]
 * Edit consumable item (name, category, min_stock, etc. NOT stock directly)
 */
export async function PUT(
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
    const { name, description, category, unit, minStock, warehouseId, imageUrl, status } = body

    // Verify item exists and belongs to company
    const existing = await db.query(`
      SELECT id FROM market_consumable_items
      WHERE id = $1 ${payload.role !== 'SUPER_ADMIN' ? 'AND company_id = $2' : ''}
    `, payload.role !== 'SUPER_ADMIN' ? [itemId, payload.companyId] : [itemId])

    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Consumible no encontrado' }, { status: 404 })
    }

    const updates: string[] = []
    const updateParams: (string | number | null)[] = []
    let pi = 1

    if (name !== undefined) { updates.push(`name = $${pi}`); updateParams.push(name); pi++ }
    if (description !== undefined) { updates.push(`description = $${pi}`); updateParams.push(description || null); pi++ }
    if (category !== undefined) { updates.push(`category = $${pi}`); updateParams.push(category || null); pi++ }
    if (unit !== undefined) { updates.push(`unit = $${pi}`); updateParams.push(unit); pi++ }
    if (minStock !== undefined) { updates.push(`min_stock = $${pi}`); updateParams.push(minStock); pi++ }
    if (warehouseId !== undefined) { updates.push(`warehouse_id = $${pi}`); updateParams.push(warehouseId || null); pi++ }
    if (imageUrl !== undefined) { updates.push(`image_url = $${pi}`); updateParams.push(imageUrl || null); pi++ }
    if (status !== undefined) { updates.push(`status = $${pi}`); updateParams.push(status); pi++ }

    updates.push('updated_at = NOW()')

    if (updates.length === 1) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 400 })
    }

    updateParams.push(itemId)

    await db.query(`
      UPDATE market_consumable_items
      SET ${updates.join(', ')}
      WHERE id = $${pi}
    `, updateParams)

    return NextResponse.json({
      success: true,
      message: 'Consumible actualizado exitosamente'
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables PUT] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al actualizar consumible'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/consumables/[id]
 * Delete consumable item (only if stock = 0)
 */
export async function DELETE(
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

    // Check stock
    const item = await db.query(`
      SELECT current_stock FROM market_consumable_items
      WHERE id = $1 ${payload.role !== 'SUPER_ADMIN' ? 'AND company_id = $2' : ''}
    `, payload.role !== 'SUPER_ADMIN' ? [itemId, payload.companyId] : [itemId])

    if (item.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Consumible no encontrado' }, { status: 404 })
    }

    if (parseFloat(item.rows[0].current_stock) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar un consumible con stock disponible. Despache todo el stock primero.'
      }, { status: 400 })
    }

    await db.query('DELETE FROM market_consumable_items WHERE id = $1', [itemId])

    return NextResponse.json({
      success: true,
      message: 'Consumible eliminado exitosamente'
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables DELETE] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al eliminar consumible'
    }, { status: 500 })
  }
}
