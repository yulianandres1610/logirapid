import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Get company filter (SUPER_ADMIN sees all, others see only their company)
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    let query = "SELECT * FROM suppliers WHERE status = 'active'"
    const params: any[] = []

    // If not SUPER_ADMIN, filter by company_id
    if (!isSuperAdmin && companyId) {
      query += " AND company_id = $1"
      params.push(companyId)
    }

    query += " ORDER BY name"

    const result = await db.query(query, params)

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
    // Get company filter to assign supplier to the user's company
    const { companyId } = getCompanyFilter(request)

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la empresa del usuario' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, contact_person, phone, email, address, notes } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'El nombre del proveedor es requerido' },
        { status: 400 }
      )
    }

    // Check if supplier already exists for this company
    const existing = await db.query(
      'SELECT id FROM suppliers WHERE name = $1 AND company_id = $2',
      [name, companyId]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un proveedor con ese nombre en su empresa' },
        { status: 400 }
      )
    }

    const result = await db.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, notes, status, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, notes || null, companyId]
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
