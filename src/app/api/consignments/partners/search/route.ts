import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/partners/search
 * Search for markets (companies) by phone or name to create consignments
 *
 * Query params:
 * - q: Search query (phone or name)
 * - limit: Max results (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          markets: [],
          message: 'Ingrese al menos 2 caracteres para buscar'
        }
      })
    }

    // Search for markets by name or phone, excluding current company
    const searchQuery = `%${query}%`

    const result = await db.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.state,
        c.logo_url,
        c.company_type,
        (
          SELECT COUNT(*)
          FROM consignment_orders co
          WHERE co.receiver_company_id = c.id
          AND co.provider_company_id = $1
        ) as total_consignments,
        (
          SELECT COALESCE(SUM(cw.balance), 0)
          FROM consignment_wallets cw
          WHERE cw.receiver_company_id = c.id
          AND cw.provider_company_id = $1
        ) as pending_balance
      FROM companies c
      WHERE c.id != $1
        AND c.company_type = 'market'
        AND c.status = 'active'
        AND (
          c.name ILIKE $2
          OR c.phone ILIKE $2
          OR c.email ILIKE $2
        )
      ORDER BY
        CASE
          WHEN c.phone ILIKE $2 THEN 1
          WHEN c.name ILIKE $2 THEN 2
          ELSE 3
        END,
        c.name
      LIMIT $3
    `, [currentCompanyId, searchQuery, limit])

    // Get recent partners (companies we've sent consignments to before)
    let recentPartners: unknown[] = []
    if (query.length === 0) {
      const recentResult = await db.query(`
        SELECT DISTINCT ON (c.id)
          c.id,
          c.name,
          c.phone,
          c.email,
          c.address,
          c.city,
          c.logo_url,
          co.created_at as last_consignment_at
        FROM companies c
        INNER JOIN consignment_orders co ON co.receiver_company_id = c.id
        WHERE co.provider_company_id = $1
          AND c.status = 'active'
        ORDER BY c.id, co.created_at DESC
        LIMIT 5
      `, [currentCompanyId])
      recentPartners = recentResult.rows
    }

    return NextResponse.json({
      success: true,
      data: {
        markets: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          city: row.city,
          state: row.state,
          logoUrl: row.logo_url,
          companyType: row.company_type,
          totalConsignments: parseInt(row.total_consignments) || 0,
          pendingBalance: parseFloat(row.pending_balance) || 0
        })),
        recentPartners: recentPartners.map((row: Record<string, unknown>) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          city: row.city,
          logoUrl: row.logo_url,
          lastConsignmentAt: row.last_consignment_at
        })),
        total: result.rows.length
      }
    })

  } catch (error) {
    console.error('[Consignment Partners Search] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar mercados'
    }, { status: 500 })
  }
}
