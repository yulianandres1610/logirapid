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

// Ensure table exists - called before each operation
async function ensureTableExists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_exchange_rate_config (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL UNIQUE,
        manual_rate DECIMAL(10,4),
        updated_by INTEGER,
        updated_by_email VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
  } catch (error) {
    console.error('[Exchange Rate Config] Error creating table:', error)
  }
}

// Helper to get current user from JWT token (same as products endpoint)
async function getCurrentUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      console.log('[Exchange Rate Config] No auth token found')
      return null
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      const payload = jwt.verify(authToken, secret) as JWTPayload
      console.log('[Exchange Rate Config] User authenticated:', {
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId
      })
      return payload
    } catch (jwtError) {
      console.error('[Exchange Rate Config] JWT verification failed:', jwtError)
      return null
    }
  } catch (cookieError) {
    console.error('[Exchange Rate Config] Cookie access error:', cookieError)
    return null
  }
}

// Fetch ElToque rates for reference
async function fetchElToqueRate(): Promise<{ rate: number; timestamp: string } | null> {
  try {
    const response = await fetch('http://173.249.39.167:8000/tasas', {
      method: 'GET',
      headers: { 'access_token': 'tu_clave_secreta_aqui' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data.monedas && Array.isArray(data.monedas)) {
      const usdRate = data.monedas.find((m: { moneda: string }) => m.moneda === 'USD')
      if (usdRate) {
        return {
          rate: usdRate.precio_cup,
          timestamp: data.fecha_actualizacion || new Date().toISOString()
        }
      }
    }
    return null
  } catch (error) {
    console.error('[Exchange Rate Config] Error fetching ElToque:', error)
    return null
  }
}

/**
 * GET /api/market/exchange-rate-config
 * Obtiene la configuración de tasa de cambio manual para la empresa
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure table exists
    await ensureTableExists()

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const companyId = user.companyId

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID requerido' },
        { status: 400 }
      )
    }

    // Get current config from database
    const result = await db.query(
      `SELECT * FROM market_exchange_rate_config WHERE company_id = $1`,
      [companyId]
    )

    const config = result.rows[0]

    // Fetch ElToque rate for reference
    const elToqueData = await fetchElToqueRate()

    // Determine effective rate and source
    const manualRate = config?.manual_rate ? parseFloat(config.manual_rate) : null
    const elToqueRate = elToqueData?.rate || 440 // Fallback

    let effectiveRate: number
    let source: 'manual' | 'eltoque' | 'none'

    if (manualRate && manualRate > 0) {
      effectiveRate = manualRate
      source = 'manual'
    } else {
      effectiveRate = elToqueRate
      source = config ? 'eltoque' : 'none'
    }

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        manualRate,
        elToqueRate,
        elToqueTimestamp: elToqueData?.timestamp || null,
        effectiveRate,
        source,
        updatedAt: config?.updated_at || null,
        updatedBy: config?.updated_by_email || null,
        createdAt: config?.created_at || null
      }
    })

  } catch (error) {
    console.error('[Exchange Rate Config] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/market/exchange-rate-config
 * Actualiza la tasa de cambio manual para la empresa
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure table exists
    await ensureTableExists()

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Check permissions - allow ADMIN, SUPER_ADMIN, and MARKET roles that manage
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER']
    const userRole = user.role || ''

    console.log('[Exchange Rate Config] POST - User role:', userRole, 'companyId:', user.companyId)

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: `No tiene permisos para modificar la tasa de cambio. Rol actual: ${userRole}` },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { manualRate } = body

    console.log('[Exchange Rate Config] POST body:', { manualRate })

    // Validate manualRate
    if (manualRate !== null && manualRate !== undefined) {
      const rate = parseFloat(manualRate)
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json(
          { success: false, error: 'La tasa debe ser un número positivo' },
          { status: 400 }
        )
      }
    }

    const companyId = user.companyId

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID requerido' },
        { status: 400 }
      )
    }

    console.log('[Exchange Rate Config] Saving for company:', companyId, 'rate:', manualRate)

    // Upsert the configuration
    const result = await db.query(
      `INSERT INTO market_exchange_rate_config
        (company_id, manual_rate, updated_by, updated_by_email, updated_at, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         manual_rate = $2,
         updated_by = $3,
         updated_by_email = $4,
         updated_at = NOW()
       RETURNING *`,
      [companyId, manualRate, user.userId, user.email]
    )

    const savedConfig = result.rows[0]
    console.log('[Exchange Rate Config] Saved successfully')

    // Fetch ElToque for response
    const elToqueData = await fetchElToqueRate()

    return NextResponse.json({
      success: true,
      message: 'Tasa de cambio actualizada correctamente',
      data: {
        companyId,
        manualRate: savedConfig.manual_rate ? parseFloat(savedConfig.manual_rate) : null,
        elToqueRate: elToqueData?.rate || 440,
        effectiveRate: savedConfig.manual_rate ? parseFloat(savedConfig.manual_rate) : (elToqueData?.rate || 440),
        source: savedConfig.manual_rate && parseFloat(savedConfig.manual_rate) > 0 ? 'manual' : 'eltoque',
        updatedAt: savedConfig.updated_at,
        updatedBy: savedConfig.updated_by_email
      }
    })

  } catch (error: any) {
    console.error('[Exchange Rate Config] POST Error:', error)
    return NextResponse.json(
      { success: false, error: `Error al actualizar configuración: ${error.message || 'Unknown error'}` },
      { status: 500 }
    )
  }
}
