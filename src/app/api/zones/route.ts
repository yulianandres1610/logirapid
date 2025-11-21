import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


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

export async function GET(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const { searchParams } = new URL(request.url)
    const companyIdParam = searchParams.get('companyId')

    console.log('[ZONES API] isSuperAdmin:', isSuperAdmin)
    console.log('[ZONES API] headerCompanyId:', headerCompanyId)
    console.log('[ZONES API] companyIdParam:', companyIdParam)

    let query = `
      SELECT * FROM zones
      WHERE status = 'active'`
    const params: any[] = []

    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      query += ' AND companyid = $1'
      params.push(headerCompanyId)
    } else if (companyIdParam) {
      query += ' AND companyid = $1'
      params.push(parseInt(companyIdParam))
    }

    query += `
      ORDER BY
        CAST(NULLIF(regexp_replace(name, '[^0-9]', '', 'g'), '') AS INTEGER) NULLS LAST,
        name`

    console.log('[ZONES API] Final query:', query)
    console.log('[ZONES API] Params:', params)

    const result = await db.query(query, params.length > 0 ? params : undefined)

    console.log('[ZONES API] Result count:', result.rows.length)

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

export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const data = await request.json()
    const companyId = isSuperAdmin ? (data.companyId || headerCompanyId) : headerCompanyId

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa del usuario'
      }, { status: 400 })
    }
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