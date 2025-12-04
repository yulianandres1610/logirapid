import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/service-pricing/history
 * Returns pricing change history
 * Query params:
 *   - serviceId: Filter by specific service
 *   - companyId: Filter by specific company
 *   - days: Number of days to look back (default 30)
 *   - limit: Max number of records (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    // Only SUPER_ADMIN can view history
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo SUPER_ADMIN puede ver historial de precios.'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')
    const companyId = searchParams.get('companyId')
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = `
      SELECT
        sph.id,
        sph.service_pricing_id,
        sph.company_service_pricing_id,
        sph.change_type,
        sph.service_id,
        sph.company_id,
        sph.old_provider_cost,
        sph.old_platform_price,
        sph.old_buy_price,
        sph.old_sell_price,
        sph.new_provider_cost,
        sph.new_platform_price,
        sph.new_buy_price,
        sph.new_sell_price,
        sph.changed_by_user_id,
        sph.changed_by_user_name,
        sph.changed_at,
        sph.notes,
        c.legalname as company_name
      FROM service_pricing_history sph
      LEFT JOIN companies c ON sph.company_id = c.id
      WHERE sph.changed_at >= NOW() - INTERVAL '${days} days'
    `
    const params: (string | number)[] = []
    let paramIndex = 1

    if (serviceId) {
      query += ` AND sph.service_id = $${paramIndex}`
      params.push(serviceId)
      paramIndex++
    }

    if (companyId) {
      query += ` AND sph.company_id = $${paramIndex}`
      params.push(parseInt(companyId))
      paramIndex++
    }

    query += ` ORDER BY sph.changed_at DESC LIMIT $${paramIndex}`
    params.push(limit)

    const result = await db.query(query, params)

    const history = result.rows.map(row => ({
      id: row.id,
      servicePricingId: row.service_pricing_id,
      companyServicePricingId: row.company_service_pricing_id,
      changeType: row.change_type,
      serviceId: row.service_id,
      companyId: row.company_id,
      companyName: row.company_name,
      oldValues: {
        providerCost: row.old_provider_cost ? parseFloat(row.old_provider_cost) : null,
        platformPrice: row.old_platform_price ? parseFloat(row.old_platform_price) : null,
        buyPrice: row.old_buy_price ? parseFloat(row.old_buy_price) : null,
        sellPrice: row.old_sell_price ? parseFloat(row.old_sell_price) : null
      },
      newValues: {
        providerCost: row.new_provider_cost ? parseFloat(row.new_provider_cost) : null,
        platformPrice: row.new_platform_price ? parseFloat(row.new_platform_price) : null,
        buyPrice: row.new_buy_price ? parseFloat(row.new_buy_price) : null,
        sellPrice: row.new_sell_price ? parseFloat(row.new_sell_price) : null
      },
      changedByUserId: row.changed_by_user_id,
      changedByUserName: row.changed_by_user_name,
      changedAt: row.changed_at,
      notes: row.notes
    }))

    return NextResponse.json({
      success: true,
      data: {
        history,
        total: history.length,
        filters: {
          serviceId,
          companyId,
          days,
          limit
        }
      }
    })

  } catch (error) {
    console.error('[Pricing History API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}
