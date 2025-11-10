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

    const zones = db.prepare(`
      SELECT * FROM zones
      WHERE companyId = ? AND status = 'active'
      ORDER BY name
    `).all(companyId)

    // Parse zipCodes from JSON string
    const formattedZones = zones.map((zone: any) => ({
      ...zone,
      zipCodes: JSON.parse(zone.zipCodes || '[]')
    }))

    return NextResponse.json({ success: true, data: formattedZones })
  } catch (error) {
    console.error('Error fetching zones:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch zones' },
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
    console.log('Received data:', data)

    const { name, description, zipCodes, color, timeSlot } = data

    if (!name || !zipCodes || zipCodes.length === 0) {
      console.error('Validation failed:', { name, zipCodes })
      return NextResponse.json(
        { success: false, error: 'Name and zip codes are required' },
        { status: 400 }
      )
    }

    console.log('Attempting to insert zone with data:', {
      companyId,
      name,
      description: description || '',
      zipCodes: JSON.stringify(zipCodes),
      color: color || '#8B5CF6',
      timeSlot: timeSlot || '8:00 AM - 12:00 PM'
    })

    try {
      const stmt = db.prepare(`
        INSERT INTO zones (companyId, name, description, zipCodes, color, timeSlot, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
      `)

      const result = stmt.run(
        parseInt(companyId), // Asegurar que es número
        name,
        description || '',
        JSON.stringify(zipCodes),
        color || '#8B5CF6',
        timeSlot || '8:00 AM - 12:00 PM'
      )

      console.log('Insert successful. Result:', result)

      return NextResponse.json({
        success: true,
        data: { id: result.lastInsertRowid }
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { success: false, error: `Database error: ${dbError}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error creating zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create zone' },
      { status: 500 }
    )
  }
}