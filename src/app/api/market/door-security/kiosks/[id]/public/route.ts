import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/market/door-security/kiosks/[id]/public
 * Get basic kiosk info for public kiosk display (no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log('[Door Kiosk Public] Fetching kiosk with ID:', id)

    // Check if ID is numeric
    const isNumericId = /^\d+$/.test(id)
    console.log('[Door Kiosk Public] Is numeric ID:', isNumericId)

    // Fetch kiosk by ID (numeric) or deviceId (string)
    // Use CAST to handle both cases properly
    const result = await db.query(`
      SELECT
        k.id,
        k.companyid,
        k.name,
        k.location,
        k.deviceid,
        k.isactive,
        c.name as companyname,
        c.logo as companylogo
      FROM market_door_kiosks k
      LEFT JOIN companies c ON k.companyid = c.id
      WHERE k.id::text = $1 OR k.deviceid = $1
    `, [id])

    console.log('[Door Kiosk Public] Query result rows:', result.rows.length)
    if (result.rows.length > 0) {
      console.log('[Door Kiosk Public] Found kiosk:', result.rows[0].id, result.rows[0].name, 'isactive:', result.rows[0].isactive)
    }

    if (result.rows.length === 0) {
      console.log('[Door Kiosk Public] Kiosk not found for ID:', id)
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado'
      }, { status: 404 })
    }

    const kiosk = result.rows[0]

    if (!kiosk.isactive) {
      return NextResponse.json({
        success: false,
        error: 'Este kiosk está desactivado'
      }, { status: 403 })
    }

    // Update last ping
    await db.query(`
      UPDATE market_door_kiosks
      SET lastping = NOW()
      WHERE id = $1
    `, [kiosk.id])

    return NextResponse.json({
      success: true,
      data: {
        id: kiosk.id,
        companyId: kiosk.companyid,
        companyName: kiosk.companyname,
        companyLogo: kiosk.companylogo,
        name: kiosk.name,
        location: kiosk.location,
        deviceId: kiosk.deviceid,
        isActive: kiosk.isactive
      }
    })

  } catch (error) {
    console.error('[Door Kiosk Public] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener kiosk'
    }, { status: 500 })
  }
}
