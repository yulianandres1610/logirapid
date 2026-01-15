import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apaCargoClient } from '@/lib/apacargo-client'

export async function GET() {
  try {
    // Verificar autenticacion
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const userRole = cookieStore.get('user-role')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo SUPER_ADMIN puede ver productos disponibles
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Obtener productos de ApaCargo
    console.log('[ApaCargo] Obteniendo productos de envio disponibles...')
    const products = await apaCargoClient.getIntegrationShippingProducts()

    console.log(`[ApaCargo] Se obtuvieron ${products.length} productos`)

    return NextResponse.json({
      success: true,
      data: {
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          code: p.code || '',
          price: p.price || 0,
          weight: p.weight || 0,
          dimensions: p.dimensions || ''
        })),
        total: products.length
      }
    })
  } catch (error) {
    console.error('[ApaCargo] Error obteniendo productos disponibles:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener productos de ApaCargo',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
