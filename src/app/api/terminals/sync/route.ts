import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface SquareDevice {
  id: string
  attributes: {
    type: string
    manufacturer: string
    model: string
    name: string
    manufacturers_id: string
    updated_at: string
    version: string
    merchant_token: string
  }
  components: Array<{
    type: string
    application_details?: {
      application_type: string
      version: string
      session_location: string
      device_code_id: string
    }
  }>
  status: {
    category: string
  }
}

/**
 * POST /api/terminals/sync
 * Sync terminals from Square API
 *
 * Body:
 * {
 *   isPlatform: boolean - true to sync platform terminals (company_id IS NULL)
 *   companyId?: number - company to sync for (if isPlatform is false)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const body = await request.json()
    const { isPlatform, companyId } = body

    let accessToken: string | undefined
    let environment: string = 'sandbox'
    let targetCompanyId: number | null = null

    if (isPlatform) {
      // Platform sync - only SUPER_ADMIN
      if (payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo SUPER_ADMIN puede sincronizar terminales de plataforma'
        }, { status: 403 })
      }

      accessToken = process.env.SQUARE_PLATFORM_ACCESS_TOKEN
      environment = process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox'
      targetCompanyId = null
    } else if (companyId) {
      // Company sync
      targetCompanyId = companyId

      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a esta empresa'
        }, { status: 403 })
      }

      // Get company credentials
      const settingsResult = await db.query(`
        SELECT square_access_token, square_environment, square_configured
        FROM company_payment_settings
        WHERE company_id = $1
      `, [companyId])

      const settings = settingsResult.rows[0]
      if (!settings || !settings.square_configured) {
        return NextResponse.json({
          success: false,
          error: 'Square no está configurado para esta empresa'
        }, { status: 400 })
      }

      accessToken = settings.square_access_token
      environment = settings.square_environment || 'sandbox'
    } else {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar isPlatform o companyId'
      }, { status: 400 })
    }

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No hay credenciales de Square configuradas'
      }, { status: 400 })
    }

    // Call Square API to get devices
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    const squareResponse = await fetch(`${baseUrl}/v2/devices`, {
      method: 'GET',
      headers: {
        'Square-Version': '2025-01-16',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const squareData = await squareResponse.json()

    if (!squareResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Error de Square: ${squareData.errors?.[0]?.detail || 'Error al obtener dispositivos'}`
      }, { status: 400 })
    }

    const devices: SquareDevice[] = squareData.devices || []
    let synced = 0
    let created = 0
    let updated = 0

    for (const device of devices) {
      // Find the TERMINAL_API application component
      const terminalApp = device.components?.find(
        c => c.type === 'APPLICATION' && c.application_details?.application_type === 'TERMINAL_API'
      )

      if (!terminalApp) continue

      const deviceId = device.id
      const deviceCodeId = terminalApp.application_details?.device_code_id
      const locationId = terminalApp.application_details?.session_location
      const name = device.attributes?.name || 'Square Terminal'
      const status = device.status?.category === 'AVAILABLE' ? 'paired' : 'offline'

      // Check if terminal already exists
      const existingResult = await db.query(`
        SELECT id FROM payment_terminals WHERE device_id = $1
      `, [deviceId])

      if (existingResult.rows.length > 0) {
        // Update existing terminal
        await db.query(`
          UPDATE payment_terminals
          SET
            name = $1,
            status = $2,
            device_code_id = $3,
            location_name = $4,
            last_seen_at = NOW(),
            updated_at = NOW()
          WHERE device_id = $5
        `, [name, status, deviceCodeId, locationId, deviceId])
        updated++
      } else {
        // Create new terminal
        await db.query(`
          INSERT INTO payment_terminals (
            company_id, name, provider, device_id, device_code_id, status, location_name, paired_at, created_at, updated_at
          ) VALUES ($1, $2, 'square', $3, $4, $5, $6, NOW(), NOW(), NOW())
        `, [targetCompanyId, name, deviceId, deviceCodeId, status, locationId])
        created++
      }
      synced++
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización completada: ${synced} terminales procesados (${created} nuevos, ${updated} actualizados)`,
      data: {
        total: synced,
        created,
        updated
      }
    })

  } catch (error) {
    console.error('Error syncing terminals:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar terminales'
    }, { status: 500 })
  }
}
