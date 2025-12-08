import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/square/config
 * Returns Square configuration for client-side SDK initialization
 * This endpoint allows the frontend to get Square credentials without exposing them in NEXT_PUBLIC_ env vars
 */
export async function GET() {
  try {
    // Get Square credentials from server-side environment variables
    const applicationId = process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_PLATFORM_APPLICATION_ID
    const locationId = process.env.SQUARE_LOCATION_ID || process.env.SQUARE_PLATFORM_LOCATION_ID
    const environment = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_PLATFORM_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'

    // Check if credentials are configured
    if (!applicationId || applicationId === 'tu_application_id_aqui') {
      console.error('[Square Config] Missing SQUARE_APPLICATION_ID')
      return NextResponse.json({
        success: false,
        error: 'Square Application ID no configurado. Contacte al administrador.'
      }, { status: 500 })
    }

    if (!locationId || locationId === 'tu_location_id_aqui') {
      console.error('[Square Config] Missing SQUARE_LOCATION_ID')
      return NextResponse.json({
        success: false,
        error: 'Square Location ID no configurado. Contacte al administrador.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        applicationId,
        locationId,
        environment
      }
    })

  } catch (error) {
    console.error('[Square Config] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener configuración de Square'
    }, { status: 500 })
  }
}
