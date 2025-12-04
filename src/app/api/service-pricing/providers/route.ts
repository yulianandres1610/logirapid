import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/service-pricing/providers
 * Returns list of provider companies with their services
 * Query params:
 *   - serviceId: Filter by specific service
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    // Only SUPER_ADMIN can view providers
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo SUPER_ADMIN puede ver proveedores.'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    let query = `
      SELECT
        c.id,
        c.legalname,
        c.phone,
        c.email,
        c.status,
        c.is_provider,
        c.provider_services,
        c.created_at
      FROM companies c
      WHERE c.is_provider = true
    `
    const params: (string | null)[] = []

    if (serviceId) {
      query += ` AND c.provider_services::text LIKE $1`
      params.push(`%"${serviceId}"%`)
    }

    query += ` ORDER BY c.legalname`

    const result = await db.query(query, params)

    // Parse provider_services JSON for each company
    const providers = result.rows.map(row => {
      let providerServices: string[] = []
      try {
        providerServices = typeof row.provider_services === 'string'
          ? JSON.parse(row.provider_services)
          : row.provider_services || []
      } catch (e) {
        providerServices = []
      }

      return {
        id: row.id,
        legalName: row.legalname,
        phone: row.phone,
        email: row.email,
        status: row.status,
        isProvider: row.is_provider,
        providerServices,
        createdAt: row.created_at
      }
    })

    // Group by service if requested
    const byService: Record<string, typeof providers> = {}
    if (!serviceId) {
      providers.forEach(provider => {
        provider.providerServices.forEach(svc => {
          if (!byService[svc]) byService[svc] = []
          byService[svc].push(provider)
        })
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        providers,
        byService: Object.keys(byService).length > 0 ? byService : undefined,
        total: providers.length
      }
    })

  } catch (error) {
    console.error('[Providers API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}
