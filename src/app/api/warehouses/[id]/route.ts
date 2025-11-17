import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await db.query(
      `SELECT
        id,
        name,
        code,
        address,
        city,
        state,
        zip_code as "zipCode",
        country,
        type,
        status,
        manager_name as "managerName",
        manager_email as "managerEmail",
        manager_phone as "managerPhone",
        operating_hours as "operatingHours",
        custom_operating_hours as "customOperatingHours",
        total_area as "totalArea",
        capacity,
        cajas_vacias_capacity,
        bultos_capacity,
        opening_date as "openingDate",
        notes,
        latitude,
        longitude,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM warehouses WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const warehouseData = await request.json()

    // Check if warehouse exists
    const checkResult = await db.query(
      'SELECT id FROM warehouses WHERE id = $1',
      [id]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Almacén no encontrado' },
        { status: 404 }
      )
    }

    // Check if code is being changed and if it already exists
    if (warehouseData.code) {
      const existingQuery = 'SELECT id FROM warehouses WHERE code = $1 AND id != $2'
      const existingResult = await db.query(existingQuery, [warehouseData.code, id])

      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'El código del almacén ya existe' },
          { status: 400 }
        )
      }
    }

    // Update warehouse
    const updateQuery = `
      UPDATE warehouses
      SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        zip_code = COALESCE($6, zip_code),
        country = COALESCE($7, country),
        type = COALESCE($8, type),
        status = COALESCE($9, status),
        manager_name = COALESCE($10, manager_name),
        manager_email = COALESCE($11, manager_email),
        manager_phone = COALESCE($12, manager_phone),
        operating_hours = COALESCE($13, operating_hours),
        custom_operating_hours = $14,
        total_area = COALESCE($15, total_area),
        capacity = COALESCE($16, capacity),
        cajas_vacias_capacity = COALESCE($17, cajas_vacias_capacity),
        bultos_capacity = COALESCE($18, bultos_capacity),
        opening_date = $19,
        notes = $20,
        latitude = $21,
        longitude = $22,
        updated_at = NOW()
      WHERE id = $23
      RETURNING *
    `

    const values = [
      warehouseData.name,
      warehouseData.code,
      warehouseData.address,
      warehouseData.city,
      warehouseData.state,
      warehouseData.zipCode,
      warehouseData.country,
      warehouseData.type,
      warehouseData.status,
      warehouseData.managerName,
      warehouseData.managerEmail,
      warehouseData.managerPhone,
      warehouseData.operatingHours,
      warehouseData.customOperatingHours || null,
      warehouseData.totalArea,
      warehouseData.capacity || 0,
      warehouseData.cajas_vacias_capacity || 0,
      warehouseData.bultos_capacity || 0,
      warehouseData.openingDate || null,
      warehouseData.notes || null,
      warehouseData.latitude || null,
      warehouseData.longitude || null,
      id
    ]

    const result = await db.query(updateQuery, values)

    return NextResponse.json(
      {
        success: true,
        message: 'Almacén actualizado exitosamente',
        data: result.rows[0]
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error updating warehouse:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el almacén' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if warehouse exists
    const checkResult = await db.query(
      'SELECT id FROM warehouses WHERE id = $1',
      [id]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Almacén no encontrado' },
        { status: 404 }
      )
    }

    // Delete warehouse
    await db.query('DELETE FROM warehouses WHERE id = $1', [id])

    return NextResponse.json(
      { success: true, message: 'Almacén eliminado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error deleting warehouse:', error)

    // Check for foreign key constraint violations
    if (error.code === '23503') {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar el almacén porque está siendo usado en rutas u otras entidades' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Error al eliminar el almacén' },
      { status: 500 }
    )
  }
}
