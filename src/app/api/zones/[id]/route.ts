import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

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
    console.log('PUT /api/zones/[id] - Received data:', JSON.stringify(data, null, 2))

    const { name, description, zipCodes, color, timeSlots, status } = data

    if (!name || !zipCodes || zipCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name and zip codes are required' },
        { status: 400 }
      )
    }

    // Check for duplicate zipcodes in other zones (excluding current zone)
    const { hasDuplicates, duplicates } = await checkDuplicateZipCodes(
      zipCodes,
      parseInt(companyId),
      parseInt(id) // Exclude current zone from duplicate check
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

    // No incluir updatedat aquí porque el trigger update_updated_at_column() lo maneja automáticamente
    console.log('Executing UPDATE query with params:', {
      name,
      description: description || '',
      zipCodes: JSON.stringify(zipCodes),
      color: color || '#8B5CF6',
      timeSlots: JSON.stringify(timeSlots || []),
      status: status || 'active',
      id: parseInt(id),
      companyId: parseInt(companyId)
    })

    const result = await db.query(`
      UPDATE zones
      SET name = $1, description = $2, zipcodes = $3, color = $4, timeslot = $5, status = $6, updatedat = NOW()
      WHERE id = $7 AND companyid = $8
      RETURNING *
    `, [
      name,
      description || '',
      JSON.stringify(zipCodes),
      color || '#8B5CF6',
      JSON.stringify(timeSlots || []),
      status || 'active',
      parseInt(id),
      parseInt(companyId)
    ])

    console.log('UPDATE query result:', {
      rowCount: result.rowCount,
      command: result.command
    })

    if (result.rowCount === 0) {
      console.error('No rows updated - zone not found or unauthorized')
      return NextResponse.json(
        { success: false, error: 'Zone not found or unauthorized' },
        { status: 404 }
      )
    }

    console.log('Zone updated successfully')
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
    // No incluir updatedat aquí porque el trigger update_updated_at_column() lo maneja automáticamente
    const result = await db.query(`
      UPDATE zones
      SET status = 'deleted'
      WHERE id = $1 AND companyid = $2
    `, [parseInt(id), parseInt(companyId)])

    if (result.rowCount === 0) {
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