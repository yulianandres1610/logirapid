import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/drivers/[id]
 * Obtiene detalle completo de un driver
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driverId = parseInt(id)

    if (isNaN(driverId)) {
      return NextResponse.json(
        { success: false, error: 'ID de driver inválido' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.address,
        u.city,
        u.country,
        u.role,
        u.status,
        u.isactive as "isActive",
        u.createdat as "createdAt",
        u.lastlogin as "lastLogin",
        COALESCE(di.cajas_vacias_count, 0) as "cajas_vacias_count",
        COALESCE(di.bultos_count, 0) as "bultos_count",
        COALESCE(di.cajas_vacias_capacity, 50) as "cajas_vacias_capacity",
        COALESCE(di.bultos_capacity, 100) as "bultos_capacity",
        c.id as "companyId",
        c.legalname as "companyName"
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      LEFT JOIN driver_inventory di ON u.id = di.driver_id
      WHERE u.id = $1 AND u.role = 'DRIVER'
    `

    const result = await db.query(query, [driverId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching driver:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener driver' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/drivers/[id]
 * Actualiza capacidades de inventario del driver
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driverId = parseInt(id)
    const body = await request.json()

    if (isNaN(driverId)) {
      return NextResponse.json(
        { success: false, error: 'ID de driver inválido' },
        { status: 400 }
      )
    }

    const { cajas_vacias_capacity, bultos_capacity } = body

    // Upsert driver_inventory
    const upsertQuery = `
      INSERT INTO driver_inventory (driver_id, cajas_vacias_capacity, bultos_capacity, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (driver_id)
      DO UPDATE SET
        cajas_vacias_capacity = COALESCE($2, driver_inventory.cajas_vacias_capacity),
        bultos_capacity = COALESCE($3, driver_inventory.bultos_capacity),
        updated_at = NOW()
      RETURNING *
    `

    const result = await db.query(upsertQuery, [
      driverId,
      cajas_vacias_capacity || 50,
      bultos_capacity || 100
    ])

    return NextResponse.json({
      success: true,
      message: 'Capacidad del driver actualizada',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error updating driver:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar driver' },
      { status: 500 }
    )
  }
}
