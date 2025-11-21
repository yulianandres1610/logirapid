import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

/**
 * DELETE /api/package-orders/[id]
 * Elimina una orden de paquetería
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de orden inválido'
        },
        { status: 400 }
      )
    }

    // Verificar si la orden existe y su estado
    const checkParams = [orderId]
    let checkQuery = 'SELECT id, status, ordernumber, company_id FROM package_orders WHERE id = $1'

    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      checkParams.push(companyId)
      checkQuery += ' AND company_id = $2'
    }

    const checkResult = await db.query(checkQuery, checkParams)

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Orden no encontrada'
        },
        { status: 404 }
      )
    }

    const order = checkResult.rows[0]

    // Solo permitir eliminación de órdenes pendientes
    if (order.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se pueden eliminar órdenes en estado pendiente'
        },
        { status: 400 }
      )
    }

    // Eliminar la orden
    const deleteParams = [orderId]
    let deleteQuery = 'DELETE FROM package_orders WHERE id = $1'
    if (!isSuperAdmin) {
      deleteParams.push(companyId)
      deleteQuery += ' AND company_id = $2'
    }
    await db.query(deleteQuery, deleteParams)

    return NextResponse.json({
      success: true,
      message: 'Orden eliminada exitosamente'
    })
  } catch (error) {
    console.error('Error in DELETE /api/package-orders/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/package-orders/[id]
 * Actualiza campos de una orden de paquetería (warehouse_id, warehouse_name, officeOrderData, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de orden inválido'
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { warehouse_id, warehouse_name, officeOrderData } = body

    // Validar que al menos un campo esté presente
    if (!warehouse_id && !warehouse_name && !officeOrderData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Debe proporcionar al menos un campo para actualizar (warehouse_id, warehouse_name, officeOrderData)'
        },
        { status: 400 }
      )
    }

    // Construir query dinámicamente basado en los campos proporcionados
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (warehouse_id !== undefined) {
      updates.push(`warehouse_id = $${paramCount++}`)
      values.push(warehouse_id)
    }

    if (warehouse_name !== undefined) {
      updates.push(`warehouse_name = $${paramCount++}`)
      values.push(warehouse_name)
    }

    if (officeOrderData !== undefined) {
      updates.push(`office_order_data = $${paramCount++}`)
      values.push(officeOrderData)
    }

    // Agregar el ID de la orden al final
    values.push(orderId)
    let whereClause = `id = $${paramCount}`
    paramCount++

    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      values.push(companyId)
      whereClause += ` AND company_id = $${paramCount}`
      paramCount++
    }

    // Ejecutar el UPDATE
    const query = `
      UPDATE package_orders
      SET ${updates.join(', ')}
      WHERE ${whereClause}
      RETURNING *
    `

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Orden no encontrada'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error in PATCH /api/package-orders/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
