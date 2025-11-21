import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    // Check if empaque exists
    const checkParams: (string | number)[] = [id]
    let checkQuery = 'SELECT id, company_id FROM empaques WHERE id = $1'
    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      checkQuery += ' AND company_id = $2'
      checkParams.push(companyId)
    }

    const checkResult = await db.query(
      checkQuery,
      checkParams
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empaque no encontrado' },
        { status: 404 }
      )
    }

    // Delete empaque
    const deleteParams: (string | number)[] = [id]
    let deleteQuery = 'DELETE FROM empaques WHERE id = $1'
    if (!isSuperAdmin) {
      deleteQuery += ' AND company_id = $2'
      deleteParams.push(companyId)
    }
    await db.query(deleteQuery, deleteParams)

    return NextResponse.json(
      { success: true, message: 'Empaque eliminado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error deleting empaque:', error)

    return NextResponse.json(
      { success: false, error: 'Error al eliminar el empaque' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    const {
      estado,
      warehouseId,
      warehouseName,
      clienteId,
      ordenId,
      descripcion,
      usuarioId,
      usuarioNombre,
      accion,
      ubicacion,
      notas
    } = body

    // Validate estado if provided
    if (estado) {
      const estadosValidos = ['disponible', 'asignado', 'recogida', 'en_almacen', 'en_transito', 'recibido_destino', 'en_reparto', 'entregado']
      if (!estadosValidos.includes(estado)) {
        return NextResponse.json(
          { success: false, error: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`)
      values.push(estado)
    }

    if (warehouseId !== undefined) {
      updates.push(`warehouse_id = $${paramIndex++}`)
      values.push(warehouseId)
    }

    if (warehouseName !== undefined) {
      updates.push(`warehouse_name = $${paramIndex++}`)
      values.push(warehouseName)
    }

    if (clienteId !== undefined) {
      updates.push(`cliente_id = $${paramIndex++}`)
      values.push(clienteId)
    }

    if (ordenId !== undefined) {
      updates.push(`orden_id = $${paramIndex++}`)
      values.push(ordenId)
    }

    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`)
      values.push(descripcion)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    let whereClause = `id = $${paramIndex}`
    paramIndex++

    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      values.push(companyId)
      whereClause += ` AND company_id = $${paramIndex}`
      paramIndex++
    }

    const query = `
      UPDATE empaques
      SET ${updates.join(', ')}
      WHERE ${whereClause}
      RETURNING *
    `

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empaque no encontrado' },
        { status: 404 }
      )
    }

    const empaque = result.rows[0]

    // Registrar trazabilidad si hay cambios importantes
    if (estado || warehouseId) {
      const accionTrazabilidad = accion || (estado ? `cambio_estado_${estado}` : 'actualizacion')
      const ubicacionTrazabilidad = ubicacion || warehouseName || 'Ubicación no especificada'
      const notasTrazabilidad = notas || `Empaque actualizado. ${estado ? `Nuevo estado: ${estado}` : ''}`

      await db.query(
        `INSERT INTO empaques_trazabilidad (
          empaque_id, accion, ubicacion, warehouse_id, warehouse_name,
          usuario_id, usuario_nombre, notas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          accionTrazabilidad,
          ubicacionTrazabilidad,
          warehouseId,
          warehouseName,
          usuarioId,
          usuarioNombre,
          notasTrazabilidad
        ]
      )
    }

    return NextResponse.json({
      success: true,
      empaque: empaque
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error updating empaque:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el empaque' },
      { status: 500 }
    )
  }
}

// Nuevo endpoint para obtener trazabilidad
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const getTrazabilidad = searchParams.get('trazabilidad') === 'true'

    if (!getTrazabilidad) {
      return NextResponse.json(
        { success: false, error: 'Endpoint para trazabilidad. Use ?trazabilidad=true' },
        { status: 400 }
      )
    }

    // Obtener historial de trazabilidad
    const result = await db.query(
      `SELECT
        t.*,
        e.codigo as empaque_codigo
      FROM empaques_trazabilidad t
      LEFT JOIN empaques e ON e.id = t.empaque_id
      WHERE t.empaque_id = $1
      ORDER BY t.fecha DESC`,
      [id]
    )

    return NextResponse.json({
      success: true,
      trazabilidad: result.rows
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching trazabilidad:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener trazabilidad' },
      { status: 500 }
    )
  }
}
