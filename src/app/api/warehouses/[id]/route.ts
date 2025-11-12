import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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
