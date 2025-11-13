import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const data = await request.json()
    const { name, dimensions, weight, price, description, isDefault, status } = data

    if (!name || !dimensions || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, dimensions and price are required' },
        { status: 400 }
      )
    }

    // If this is being set as default, unset all other defaults
    if (isDefault) {
      await db.query(`
        UPDATE package_sizes
        SET isdefault = false
        WHERE companyid = $1 AND status = 'active' AND id != $2
      `, [companyId, id])
    }

    const result = await db.query(`
      UPDATE package_sizes
      SET name = $1, dimensions = $2, weight = $3, price = $4, description = $5,
          isdefault = $6, status = $7, updatedat = CURRENT_TIMESTAMP
      WHERE id = $8 AND companyid = $9
      RETURNING *
    `, [
      name,
      dimensions,
      weight || 0,
      price,
      description || '',
      isDefault ? true : false,
      status || 'active',
      id,
      companyId
    ])

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Package size not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Error updating package size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update package size' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    // Soft delete - just update status
    const result = await db.query(`
      UPDATE package_sizes
      SET status = 'deleted', updatedat = CURRENT_TIMESTAMP
      WHERE id = $1 AND companyid = $2
      RETURNING *
    `, [id, companyId])

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Package size not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting package size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete package size' },
      { status: 500 }
    )
  }
}