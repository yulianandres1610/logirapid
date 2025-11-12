import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// Helper function to check for duplicate zipcodes in other zones
async function checkDuplicateZipCodes(
  zipCodes: string[],
  companyId: number,
  excludeZoneId?: number
): Promise<{ hasDuplicates: boolean; duplicates: Array<{ zipCode: string; zoneName: string }> }> {
  const duplicates: Array<{ zipCode: string; zoneName: string }> = []

  try {
    // Get all active zones for this company
    const zonesResult = await db.query(`
      SELECT id, name, zipcodes
      FROM zones
      WHERE companyid = $1 AND status = 'active'
      ${excludeZoneId ? 'AND id != $2' : ''}
    `, excludeZoneId ? [companyId, excludeZoneId] : [companyId])

    // Check each zipcode against existing zones
    for (const zone of zonesResult.rows) {
      const existingZipCodes = typeof zone.zipcodes === 'string'
        ? JSON.parse(zone.zipcodes || '[]')
        : (zone.zipcodes || [])

      for (const zipCode of zipCodes) {
        if (existingZipCodes.includes(zipCode)) {
          duplicates.push({
            zipCode,
            zoneName: zone.name
          })
        }
      }
    }
  } catch (error) {
    console.error('Error checking duplicate zipcodes:', error)
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const result = await db.query(`
      SELECT * FROM zones
      WHERE companyid = $1 AND status = 'active'
      ORDER BY name
    `, [parseInt(companyId)])

    const zones = result.rows

    // Parse zipCodes and timeSlots from JSON string
    const formattedZones = zones.map((zone: any) => ({
      ...zone,
      zipCodes: typeof zone.zipcodes === 'string' ? JSON.parse(zone.zipcodes || '[]') : (zone.zipcodes || []),
      timeSlots: typeof zone.timeslot === 'string' && (zone.timeslot.startsWith('[') || zone.timeslot.startsWith('{'))
        ? JSON.parse(zone.timeslot || '[]')
        : (Array.isArray(zone.timeslot) ? zone.timeslot : [])
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

    const { name, description, zipCodes, color, timeSlots } = data

    if (!name || !zipCodes || zipCodes.length === 0) {
      console.error('Validation failed:', { name, zipCodes })
      return NextResponse.json(
        { success: false, error: 'Name and zip codes are required' },
        { status: 400 }
      )
    }

    // Check for duplicate zipcodes in other zones
    const { hasDuplicates, duplicates } = await checkDuplicateZipCodes(
      zipCodes,
      parseInt(companyId)
    )

    if (hasDuplicates) {
      const duplicateList = duplicates
        .map(d => `${d.zipCode} (ya en "${d.zoneName}")`)
        .join(', ')
      return NextResponse.json(
        {
          success: false,
          error: `Los siguientes códigos postales ya están asignados a otras zonas: ${duplicateList}`
        },
        { status: 409 } // 409 Conflict
      )
    }

    console.log('Attempting to insert zone with data:', {
      companyId,
      name,
      description: description || '',
      zipCodes: JSON.stringify(zipCodes),
      color: color || '#8B5CF6',
      timeSlots: JSON.stringify(timeSlots || [])
    })

    try {
      const result = await db.query(`
        INSERT INTO zones (companyid, name, description, zipcodes, color, timeslot, status, createdat, updatedat)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
        RETURNING id
      `, [
        parseInt(companyId),
        name,
        description || '',
        JSON.stringify(zipCodes),
        color || '#8B5CF6',
        JSON.stringify(timeSlots || [])
      ])

      console.log('Insert successful. Result:', result)

      return NextResponse.json({
        success: true,
        data: { id: result.rows[0].id }
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