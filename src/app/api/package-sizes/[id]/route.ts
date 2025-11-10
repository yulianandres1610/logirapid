import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

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
      db.prepare(`
        UPDATE package_sizes
        SET isDefault = 0
        WHERE companyId = ? AND status = 'active' AND id != ?
      `).run(companyId, id)
    }

    const stmt = db.prepare(`
      UPDATE package_sizes
      SET name = ?, dimensions = ?, weight = ?, price = ?, description = ?, isDefault = ?, status = ?, updatedAt = datetime('now')
      WHERE id = ? AND companyId = ?
    `)

    const result = stmt.run(
      name,
      dimensions,
      weight || 0,
      price,
      description || '',
      isDefault ? 1 : 0,
      status || 'active',
      id,
      companyId
    )

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Package size not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
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
    const stmt = db.prepare(`
      UPDATE package_sizes
      SET status = 'deleted', updatedAt = datetime('now')
      WHERE id = ? AND companyId = ?
    `)

    const result = stmt.run(id, companyId)

    if (result.changes === 0) {
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