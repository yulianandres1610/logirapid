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

// Helper to mask sensitive values
function maskValue(value: string | undefined | null, showChars: number = 8): string {
  if (!value) return ''
  if (value.length <= showChars * 2) {
    return value.substring(0, 4) + '...' + value.substring(value.length - 4)
  }
  return value.substring(0, showChars) + '...' + value.substring(value.length - showChars)
}

// Verify user has access to company
async function verifyCompanyAccess(payload: JWTPayload, companyId: number): Promise<boolean> {
  // SUPER_ADMIN can access any company
  if (payload.role === 'SUPER_ADMIN') return true

  // ADMIN can only access their own company
  if (payload.role === 'ADMIN' && payload.companyId === companyId) return true

  return false
}

/**
 * GET /api/companies/[id]/payment-settings
 * Returns the payment configuration for a specific company
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

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

    // Verify access
    if (!await verifyCompanyAccess(payload, companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a esta empresa'
      }, { status: 403 })
    }

    // Get company payment settings
    const settingsResult = await db.query(`
      SELECT
        id,
        company_id as "companyId",
        active_provider as "activeProvider",
        square_application_id as "squareApplicationId",
        square_location_id as "squareLocationId",
        square_environment as "squareEnvironment",
        square_configured as "squareConfigured",
        stripe_publishable_key as "stripePublishableKey",
        stripe_configured as "stripeConfigured",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM company_payment_settings
      WHERE company_id = $1
    `, [companyId])

    const settings = settingsResult.rows[0]

    if (!settings) {
      // Return default empty settings
      return NextResponse.json({
        success: true,
        data: {
          companyId,
          activeProvider: 'none',
          square: {
            configured: false,
            applicationId: null,
            locationId: null,
            environment: 'sandbox'
          },
          stripe: {
            configured: false,
            publishableKey: null
          }
        }
      })
    }

    // Return masked settings
    return NextResponse.json({
      success: true,
      data: {
        companyId: settings.companyId,
        activeProvider: settings.activeProvider,
        square: {
          configured: settings.squareConfigured,
          applicationId: maskValue(settings.squareApplicationId),
          locationId: maskValue(settings.squareLocationId),
          environment: settings.squareEnvironment
        },
        stripe: {
          configured: settings.stripeConfigured,
          publishableKey: maskValue(settings.stripePublishableKey)
        },
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    })

  } catch (error) {
    console.error('Error getting company payment settings:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener configuración'
    }, { status: 500 })
  }
}

/**
 * PUT /api/companies/[id]/payment-settings
 * Update payment configuration for a company
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

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

    // Verify access
    if (!await verifyCompanyAccess(payload, companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a esta empresa'
      }, { status: 403 })
    }

    const body = await request.json()
    const { activeProvider, square, stripe } = body

    // Build upsert query
    const squareConfigured = !!(square?.accessToken && square?.applicationId && square?.locationId)
    const stripeConfigured = !!(stripe?.secretKey && stripe?.publishableKey)

    const upsertResult = await db.query(`
      INSERT INTO company_payment_settings (
        company_id,
        active_provider,
        square_access_token,
        square_application_id,
        square_location_id,
        square_environment,
        square_configured,
        stripe_secret_key,
        stripe_publishable_key,
        stripe_webhook_secret,
        stripe_configured,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (company_id) DO UPDATE SET
        active_provider = COALESCE($2, company_payment_settings.active_provider),
        square_access_token = COALESCE($3, company_payment_settings.square_access_token),
        square_application_id = COALESCE($4, company_payment_settings.square_application_id),
        square_location_id = COALESCE($5, company_payment_settings.square_location_id),
        square_environment = COALESCE($6, company_payment_settings.square_environment),
        square_configured = $7,
        stripe_secret_key = COALESCE($8, company_payment_settings.stripe_secret_key),
        stripe_publishable_key = COALESCE($9, company_payment_settings.stripe_publishable_key),
        stripe_webhook_secret = COALESCE($10, company_payment_settings.stripe_webhook_secret),
        stripe_configured = $11,
        updated_at = NOW()
      RETURNING
        id,
        company_id as "companyId",
        active_provider as "activeProvider",
        square_configured as "squareConfigured",
        stripe_configured as "stripeConfigured",
        updated_at as "updatedAt"
    `, [
      companyId,
      activeProvider || 'none',
      square?.accessToken || null,
      square?.applicationId || null,
      square?.locationId || null,
      square?.environment || 'sandbox',
      squareConfigured,
      stripe?.secretKey || null,
      stripe?.publishableKey || null,
      stripe?.webhookSecret || null,
      stripeConfigured
    ])

    return NextResponse.json({
      success: true,
      message: 'Configuración de pagos actualizada',
      data: upsertResult.rows[0]
    })

  } catch (error) {
    console.error('Error updating company payment settings:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar configuración'
    }, { status: 500 })
  }
}

/**
 * POST /api/companies/[id]/payment-settings
 * Test connection with Square or Stripe using company credentials
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

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

    // Verify access
    if (!await verifyCompanyAccess(payload, companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a esta empresa'
      }, { status: 403 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider || !['square', 'stripe'].includes(provider)) {
      return NextResponse.json({
        success: false,
        error: 'Provider inválido. Debe ser "square" o "stripe".'
      }, { status: 400 })
    }

    // Get company credentials
    const settingsResult = await db.query(`
      SELECT
        square_access_token,
        square_environment,
        stripe_secret_key
      FROM company_payment_settings
      WHERE company_id = $1
    `, [companyId])

    const settings = settingsResult.rows[0]

    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'No hay configuración de pagos para esta empresa.'
      }, { status: 400 })
    }

    if (provider === 'square') {
      if (!settings.square_access_token) {
        return NextResponse.json({
          success: false,
          error: 'Square no está configurado para esta empresa.'
        }, { status: 400 })
      }

      try {
        const squareEnv = settings.square_environment || 'sandbox'
        const baseUrl = squareEnv === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com'

        const response = await fetch(`${baseUrl}/v2/locations`, {
          method: 'GET',
          headers: {
            'Square-Version': '2025-01-16',
            'Authorization': `Bearer ${settings.square_access_token}`,
            'Content-Type': 'application/json'
          }
        })

        const data = await response.json()

        if (!response.ok) {
          return NextResponse.json({
            success: false,
            error: `Error de Square: ${data.errors?.[0]?.detail || 'Conexión fallida'}`,
            connectionStatus: 'error'
          })
        }

        return NextResponse.json({
          success: true,
          message: 'Conexión exitosa con Square',
          connectionStatus: 'connected',
          data: {
            locationsCount: data.locations?.length || 0
          }
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Error de conexión: ${error instanceof Error ? error.message : 'Unknown error'}`,
          connectionStatus: 'error'
        })
      }
    }

    if (provider === 'stripe') {
      if (!settings.stripe_secret_key) {
        return NextResponse.json({
          success: false,
          error: 'Stripe no está configurado para esta empresa.'
        }, { status: 400 })
      }

      try {
        const response = await fetch('https://api.stripe.com/v1/balance', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${settings.stripe_secret_key}`
          }
        })

        const data = await response.json()

        if (!response.ok) {
          return NextResponse.json({
            success: false,
            error: `Error de Stripe: ${data.error?.message || 'Conexión fallida'}`,
            connectionStatus: 'error'
          })
        }

        return NextResponse.json({
          success: true,
          message: 'Conexión exitosa con Stripe',
          connectionStatus: 'connected',
          data: {
            currency: data.available?.[0]?.currency || 'usd'
          }
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Error de conexión: ${error instanceof Error ? error.message : 'Unknown error'}`,
          connectionStatus: 'error'
        })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Provider no soportado'
    }, { status: 400 })

  } catch (error) {
    console.error('Error testing company payment config:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al probar configuración'
    }, { status: 500 })
  }
}
