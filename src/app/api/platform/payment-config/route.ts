import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// Helper to mask sensitive values
function maskValue(value: string | undefined, showChars: number = 8): string {
  if (!value) return ''
  if (value.length <= showChars * 2) {
    return value.substring(0, 4) + '...' + value.substring(value.length - 4)
  }
  return value.substring(0, showChars) + '...' + value.substring(value.length - showChars)
}

// Helper to check if Square credentials are configured
function isSquareConfigured(): boolean {
  return !!(
    process.env.SQUARE_PLATFORM_ACCESS_TOKEN &&
    process.env.SQUARE_PLATFORM_APPLICATION_ID &&
    process.env.SQUARE_PLATFORM_LOCATION_ID
  )
}

// Helper to check if Stripe credentials are configured
function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_PLATFORM_SECRET_KEY &&
    process.env.STRIPE_PLATFORM_PUBLISHABLE_KEY
  )
}

/**
 * GET /api/platform/payment-config
 * Returns the platform payment configuration status (SUPER_ADMIN only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify SUPER_ADMIN role
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

    // Only SUPER_ADMIN can access platform config
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Acceso denegado. Solo SUPER_ADMIN puede ver esta configuración.'
      }, { status: 403 })
    }

    // Build response with masked credentials
    const config = {
      square: {
        configured: isSquareConfigured(),
        applicationId: maskValue(process.env.SQUARE_PLATFORM_APPLICATION_ID),
        locationId: maskValue(process.env.SQUARE_PLATFORM_LOCATION_ID),
        environment: process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox',
        hasAccessToken: !!process.env.SQUARE_PLATFORM_ACCESS_TOKEN
      },
      stripe: {
        configured: isStripeConfigured(),
        publishableKey: maskValue(process.env.STRIPE_PLATFORM_PUBLISHABLE_KEY),
        hasSecretKey: !!process.env.STRIPE_PLATFORM_SECRET_KEY,
        hasWebhookSecret: !!process.env.STRIPE_PLATFORM_WEBHOOK_SECRET,
        environment: process.env.STRIPE_PLATFORM_PUBLISHABLE_KEY?.startsWith('pk_live') ? 'production' : 'sandbox'
      }
    }

    return NextResponse.json({
      success: true,
      data: config
    })

  } catch (error) {
    console.error('Error getting platform payment config:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener configuración'
    }, { status: 500 })
  }
}

/**
 * POST /api/platform/payment-config
 * Test connection to Square or Stripe (SUPER_ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify SUPER_ADMIN role
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

    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Acceso denegado'
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

    if (provider === 'square') {
      // Test Square connection
      if (!isSquareConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Square no está configurado. Configure las variables de entorno.'
        }, { status: 400 })
      }

      try {
        const squareEnv = process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox'
        const baseUrl = squareEnv === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com'

        const response = await fetch(`${baseUrl}/v2/locations`, {
          method: 'GET',
          headers: {
            'Square-Version': '2025-01-16',
            'Authorization': `Bearer ${process.env.SQUARE_PLATFORM_ACCESS_TOKEN}`,
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
      // Test Stripe connection
      if (!isStripeConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Stripe no está configurado. Configure las variables de entorno.'
        }, { status: 400 })
      }

      try {
        const response = await fetch('https://api.stripe.com/v1/balance', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_PLATFORM_SECRET_KEY}`
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
    console.error('Error testing platform payment config:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al probar configuración'
    }, { status: 500 })
  }
}
