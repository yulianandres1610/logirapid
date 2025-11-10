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
    const { name, description, zipCodes, color, timeSlot, status } = data

    if (!name || !zipCodes || zipCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name and zip codes are required' },
        { status: 400 }
      )
    }

    const stmt = db.prepare(`
      UPDATE zones
      SET name = ?, description = ?, zipCodes = ?, color = ?, timeSlot = ?, status = ?, updatedAt = datetime('now')
      WHERE id = ? AND companyId = ?
    `)

    const result = stmt.run(
      name,
      description || '',
      JSON.stringify(zipCodes),
      color || '#8B5CF6',
      timeSlot || '8:00 AM - 12:00 PM',
      status || 'active',
      id,
      companyId
    )

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Zone not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update zone' },
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
      UPDATE zones
      SET status = 'deleted', updatedAt = datetime('now')
      WHERE id = ? AND companyId = ?
    `)

    const result = stmt.run(id, companyId)

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Zone not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete zone' },
      { status: 500 }
    )
  }
}