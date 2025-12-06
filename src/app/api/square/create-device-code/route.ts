import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import crypto from 'crypto'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/square/create-device-code
 * Create a Square Terminal device code for pairing a physical terminal
 *
 * Body:
 * {
 *   terminalId: number - ID of the terminal in our database
 *   usePlatformCredentials: boolean - true for platform terminals, false for company terminals
 *   companyId?: number - required if usePlatformCredentials is false
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
    const { terminalId, usePlatformCredentials, companyId } = body

    if (!terminalId) {
      return NextResponse.json({
        success: false,
        error: 'terminalId es requerido'
      }, { status: 400 })
    }

    // Get terminal info
    const terminalResult = await db.query(`
      SELECT
        id,
        company_id as "companyId",
        name,
        provider,
        status
      FROM payment_terminals
      WHERE id = $1
    `, [terminalId])

    const terminal = terminalResult.rows[0]

    if (!terminal) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    if (terminal.provider !== 'square') {
      return NextResponse.json({
        success: false,
        error: 'Este terminal no es de Square'
      }, { status: 400 })
    }

    // Determine which credentials to use
    let accessToken: string | undefined
    let locationId: string | undefined
    let environment: string = 'sandbox'

    if (usePlatformCredentials || terminal.companyId === null) {
      // Platform credentials - only SUPER_ADMIN
      if (payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo SUPER_ADMIN puede usar credenciales de plataforma'
        }, { status: 403 })
      }

      accessToken = process.env.SQUARE_PLATFORM_ACCESS_TOKEN
      locationId = process.env.SQUARE_PLATFORM_LOCATION_ID
      environment = process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox'

      if (!accessToken || !locationId) {
        return NextResponse.json({
          success: false,
          error: 'Square de plataforma no está configurado'
        }, { status: 400 })
      }
    } else {
      // Company credentials
      const targetCompanyId = companyId || terminal.companyId

      // Verify access
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== targetCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a esta empresa'
        }, { status: 403 })
      }

      // Get company Square credentials
      const settingsResult = await db.query(`
        SELECT
          square_access_token,
          square_location_id,
          square_environment,
          square_configured
        FROM company_payment_settings
        WHERE company_id = $1
      `, [targetCompanyId])

      const settings = settingsResult.rows[0]

      if (!settings || !settings.square_configured) {
        return NextResponse.json({
          success: false,
          error: 'Square no está configurado para esta empresa'
        }, { status: 400 })
      }

      accessToken = settings.square_access_token
      locationId = settings.square_location_id
      environment = settings.square_environment || 'sandbox'
    }

    // Call Square API to create device code
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    const idempotencyKey = crypto.randomUUID()

    const squareResponse = await fetch(`${baseUrl}/v2/devices/codes`, {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-16',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        device_code: {
          product_type: 'TERMINAL_API',
          location_id: locationId,
          name: terminal.name
        }
      })
    })

    const squareData = await squareResponse.json()

    if (!squareResponse.ok) {
      console.error('Square API error:', squareData)
      return NextResponse.json({
        success: false,
        error: `Error de Square: ${squareData.errors?.[0]?.detail || 'Error al crear device code'}`,
        squareErrors: squareData.errors
      }, { status: 400 })
    }

    const deviceCode = squareData.device_code

    // Update terminal with device code info
    await db.query(`
      UPDATE payment_terminals
      SET
        device_code = $1,
        device_code_id = $2,
        status = 'pending',
        updated_at = NOW()
      WHERE id = $3
    `, [
      deviceCode.code,
      deviceCode.id,
      terminalId
    ])

    return NextResponse.json({
      success: true,
      message: 'Device code creado exitosamente',
      data: {
        terminalId,
        deviceCodeId: deviceCode.id,
        code: deviceCode.code,
        status: deviceCode.status,
        productType: deviceCode.product_type,
        locationId: deviceCode.location_id,
        expiresAt: deviceCode.pair_by,
        createdAt: deviceCode.created_at
      }
    })

  } catch (error) {
    console.error('Error creating Square device code:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear device code'
    }, { status: 500 })
  }
}

/**
 * GET /api/square/create-device-code
 * Check the status of a device code
 *
 * Query params:
 *   deviceCodeId: string - The Square device code ID
 *   usePlatformCredentials: boolean
 *   companyId?: number
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const deviceCodeId = searchParams.get('deviceCodeId')
    const usePlatformCredentials = searchParams.get('usePlatformCredentials') === 'true'
    const companyId = searchParams.get('companyId')

    if (!deviceCodeId) {
      return NextResponse.json({
        success: false,
        error: 'deviceCodeId es requerido'
      }, { status: 400 })
    }

    // Determine which credentials to use
    let accessToken: string | undefined
    let environment: string = 'sandbox'

    if (usePlatformCredentials) {
      if (payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo SUPER_ADMIN puede usar credenciales de plataforma'
        }, { status: 403 })
      }

      accessToken = process.env.SQUARE_PLATFORM_ACCESS_TOKEN
      environment = process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox'
    } else if (companyId) {
      const targetCompanyId = parseInt(companyId)

      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== targetCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a esta empresa'
        }, { status: 403 })
      }

      const settingsResult = await db.query(`
        SELECT square_access_token, square_environment
        FROM company_payment_settings
        WHERE company_id = $1
      `, [targetCompanyId])

      const settings = settingsResult.rows[0]
      if (!settings) {
        return NextResponse.json({
          success: false,
          error: 'Empresa sin configuración de pagos'
        }, { status: 400 })
      }

      accessToken = settings.square_access_token
      environment = settings.square_environment || 'sandbox'
    } else {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar usePlatformCredentials o companyId'
      }, { status: 400 })
    }

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No hay credenciales de Square configuradas'
      }, { status: 400 })
    }

    // Call Square API to check device code status
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    const squareResponse = await fetch(`${baseUrl}/v2/devices/codes/${deviceCodeId}`, {
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
        error: `Error de Square: ${squareData.errors?.[0]?.detail || 'Error al consultar device code'}`
      }, { status: 400 })
    }

    const deviceCode = squareData.device_code

    // If device is paired, update terminal in our database
    if (deviceCode.status === 'PAIRED' && deviceCode.device_id) {
      await db.query(`
        UPDATE payment_terminals
        SET
          device_id = $1,
          status = 'paired',
          paired_at = NOW(),
          updated_at = NOW()
        WHERE device_code_id = $2
      `, [deviceCode.device_id, deviceCodeId])
    }

    return NextResponse.json({
      success: true,
      data: {
        deviceCodeId: deviceCode.id,
        code: deviceCode.code,
        status: deviceCode.status,
        deviceId: deviceCode.device_id || null,
        productType: deviceCode.product_type,
        locationId: deviceCode.location_id,
        expiresAt: deviceCode.pair_by,
        pairingCode: deviceCode.status === 'UNPAIRED' ? deviceCode.code : null
      }
    })

  } catch (error) {
    console.error('Error checking Square device code:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar device code'
    }, { status: 500 })
  }
}
