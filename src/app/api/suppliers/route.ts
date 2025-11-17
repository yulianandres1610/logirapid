import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await db.query(
      "SELECT * FROM suppliers WHERE status = 'active' ORDER BY name"
    )

    return NextResponse.json({
      success: true,
      suppliers: result.rows
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener proveedores' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contact_person, phone, email, address, notes } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'El nombre del proveedor es requerido' },
        { status: 400 }
      )
    }

    // Check if supplier already exists
    const existing = await db.query(
      'SELECT id FROM suppliers WHERE name = $1',
      [name]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un proveedor con ese nombre' },
        { status: 400 }
      )
    }

    const result = await db.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, notes || null]
    )

    return NextResponse.json({
      success: true,
      supplier: result.rows[0]
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear proveedor' },
      { status: 500 }
    )
  }
}
