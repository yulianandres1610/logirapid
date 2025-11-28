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

    // Primero, desvincular empaques asociados (si existen)
    if (order.ordernumber) {
      await db.query(
        `UPDATE empaques
         SET order_number = NULL, delivery_order_number = NULL
         WHERE order_number = $1 OR delivery_order_number = $1`,
        [order.ordernumber]
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
 * Actualiza campos de una orden de paquetería
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

    // Mapeo de campos permitidos: clave del body -> nombre de columna en DB
    const allowedFields: Record<string, string> = {
      warehouse_id: 'warehouse_id',
      warehouse_name: 'warehouse_name',
      officeOrderData: 'office_order_data',
      customername: 'customername',
      phone: 'phone',
      customeraddress: 'customeraddress',
      street: 'street',
      apartment: 'apartment',
      city: 'city',
      state: 'state',
      country: 'country',
      zipcode: 'zipcode',
      firstname: 'firstname',
      lastname: 'lastname',
      status: 'status',
      notes: 'notes'
    }

    // Construir query dinámicamente basado en los campos proporcionados
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = $${paramCount++}`)
        values.push(body[bodyKey])
      }
    }

    // Validar que al menos un campo esté presente
    if (updates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Debe proporcionar al menos un campo válido para actualizar'
        },
        { status: 400 }
      )
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
