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

/**
 * GET /api/terminals
 * List payment terminals
 * Query params:
 *  - companyId: filter by company (optional)
 *  - platform: if 'true', show platform terminals (company_id IS NULL)
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
    const companyIdParam = searchParams.get('companyId')
    const platformParam = searchParams.get('platform')

    let query: string
    let params: any[] = []

    if (platformParam === 'true') {
      // Only SUPER_ADMIN can see platform terminals
      if (payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo SUPER_ADMIN puede ver terminales de plataforma'
        }, { status: 403 })
      }

      query = `
        SELECT
          id,
          company_id as "companyId",
          name,
          provider,
          device_id as "deviceId",
          device_code as "deviceCode",
          device_code_id as "deviceCodeId",
          status,
          last_seen_at as "lastSeenAt",
          paired_at as "pairedAt",
          location_name as "locationName",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM payment_terminals
        WHERE company_id IS NULL
        ORDER BY created_at DESC
      `
    } else if (companyIdParam) {
      const companyId = parseInt(companyIdParam)

      // Check access
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a los terminales de esta empresa'
        }, { status: 403 })
      }

      query = `
        SELECT
          id,
          company_id as "companyId",
          name,
          provider,
          device_id as "deviceId",
          device_code as "deviceCode",
          device_code_id as "deviceCodeId",
          status,
          last_seen_at as "lastSeenAt",
          paired_at as "pairedAt",
          location_name as "locationName",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM payment_terminals
        WHERE company_id = $1
        ORDER BY created_at DESC
      `
      params = [companyId]
    } else {
      // Default: show terminals for user's company
      if (payload.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN sees all terminals
        query = `
          SELECT
            t.id,
            t.company_id as "companyId",
            t.name,
            t.provider,
            t.device_id as "deviceId",
            t.device_code as "deviceCode",
            t.device_code_id as "deviceCodeId",
            t.status,
            t.last_seen_at as "lastSeenAt",
            t.paired_at as "pairedAt",
            t.location_name as "locationName",
            t.created_at as "createdAt",
            t.updated_at as "updatedAt",
            c.legalname as "companyName"
          FROM payment_terminals t
          LEFT JOIN companies c ON t.company_id = c.id
          ORDER BY t.created_at DESC
        `
      } else {
        query = `
          SELECT
            id,
            company_id as "companyId",
            name,
            provider,
            device_id as "deviceId",
            device_code as "deviceCode",
            device_code_id as "deviceCodeId",
            status,
            last_seen_at as "lastSeenAt",
            paired_at as "pairedAt",
            location_name as "locationName",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM payment_terminals
          WHERE company_id = $1
          ORDER BY created_at DESC
        `
        params = [payload.companyId]
      }
    }

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        terminals: result.rows
      }
    })

  } catch (error) {
    console.error('Error getting terminals:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener terminales'
    }, { status: 500 })
  }
}

/**
 * POST /api/terminals
 * Register a new payment terminal
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
    const { companyId, name, provider, locationName } = body

    // Validate required fields
    if (!name || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Nombre y proveedor son requeridos'
      }, { status: 400 })
    }

    if (!['square', 'stripe'].includes(provider)) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor inválido. Debe ser "square" o "stripe".'
      }, { status: 400 })
    }

    // Check access for company terminals
    if (companyId !== null && companyId !== undefined) {
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso para crear terminales en esta empresa'
        }, { status: 403 })
      }
    } else {
      // Platform terminal - only SUPER_ADMIN
      if (payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo SUPER_ADMIN puede crear terminales de plataforma'
        }, { status: 403 })
      }
    }

    // Insert terminal
    const insertResult = await db.query(`
      INSERT INTO payment_terminals (
        company_id,
        name,
        provider,
        status,
        location_name,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())
      RETURNING
        id,
        company_id as "companyId",
        name,
        provider,
        device_id as "deviceId",
        device_code as "deviceCode",
        device_code_id as "deviceCodeId",
        status,
        location_name as "locationName",
        created_at as "createdAt"
    `, [
      companyId || null,
      name,
      provider,
      locationName || null
    ])

    return NextResponse.json({
      success: true,
      message: 'Terminal registrado. Ahora debe crear un device code para emparejarlo.',
      data: insertResult.rows[0]
    })

  } catch (error) {
    console.error('Error creating terminal:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear terminal'
    }, { status: 500 })
  }
}
