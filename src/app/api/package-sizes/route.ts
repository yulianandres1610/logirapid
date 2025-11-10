import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const packageSizes = db.prepare(`
      SELECT * FROM package_sizes
      WHERE companyId = ? AND status = 'active'
      ORDER BY isDefault DESC, name
    `).all(companyId)

    return NextResponse.json({ success: true, data: packageSizes })
  } catch (error) {
    console.error('Error fetching package sizes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch package sizes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const data = await request.json()
    const { name, dimensions, weight, price, description, isDefault } = data

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
        WHERE companyId = ? AND status = 'active'
      `).run(companyId)
    }

    const stmt = db.prepare(`
      INSERT INTO package_sizes (
        companyId, name, dimensions, weight, price, description, isDefault, status, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `)

    const result = stmt.run(
      companyId,
      name,
      dimensions,
      weight || 0,
      price,
      description || '',
      isDefault ? 1 : 0
    )

    return NextResponse.json({
      success: true,
      data: { id: result.lastInsertRowid }
    })
  } catch (error) {
    console.error('Error creating package size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create package size' },
      { status: 500 }
    )
  }
}