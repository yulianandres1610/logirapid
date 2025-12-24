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

    // First, search in companies table (simpler query without consignment tables)
    // Note: companies table uses 'status' column, not 'is_active'
    // Also uses 'legalname' instead of 'name'
    const result = await db.query(`
      SELECT
        c.id,
        c.legalname as name,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.state,
        c.logo_url
      FROM companies c
      WHERE c.id != $1
        AND c.status = 'active'
        AND (
          c.legalname ILIKE $2
          OR c.phone ILIKE $2
          OR c.email ILIKE $2
        )
      ORDER BY
        CASE
          WHEN c.phone ILIKE $2 THEN 1
          WHEN c.legalname ILIKE $2 THEN 2
          ELSE 3
        END,
        c.legalname
      LIMIT $3
    `, [currentCompanyId, searchQuery, limit])

    // Try to get consignment stats if tables exist
    const marketsWithStats = await Promise.all(result.rows.map(async (row) => {
      let totalConsignments = 0
      let pendingBalance = 0

      try {
        const statsResult = await db.query(`
          SELECT
            (SELECT COUNT(*) FROM consignment_orders WHERE receiver_company_id = $1 AND provider_company_id = $2) as total,
            (SELECT COALESCE(balance, 0) FROM consignment_wallets WHERE receiver_company_id = $1 AND provider_company_id = $2) as balance
        `, [row.id, currentCompanyId])

        if (statsResult.rows[0]) {
          totalConsignments = parseInt(statsResult.rows[0].total) || 0
          pendingBalance = parseFloat(statsResult.rows[0].balance) || 0
        }
      } catch {
        // Tables don't exist yet, ignore
      }

      return {
        ...row,
        totalConsignments,
        pendingBalance
      }
    }))

    // Get recent partners (companies we've sent consignments to before)
    let recentPartners: { id: number; name: string; phone: string | null; email: string | null; address: string | null; city: string | null; logoUrl: string | null }[] = []
    try {
      const recentResult = await db.query(`
        SELECT DISTINCT ON (c.id)
          c.id,
          c.legalname as name,
          c.phone,
          c.email,
          c.address,
          c.city,
          c.logo_url
        FROM companies c
        INNER JOIN consignment_orders co ON co.receiver_company_id = c.id
        WHERE co.provider_company_id = $1
          AND c.status = 'active'
        ORDER BY c.id, co.created_at DESC
        LIMIT 5
      `, [currentCompanyId])
      recentPartners = recentResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        city: row.city,
        logoUrl: row.logo_url
      }))
    } catch {
      // Tables don't exist yet, ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        markets: marketsWithStats.map(row => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          city: row.city,
          state: row.state,
          logoUrl: row.logo_url,
          totalConsignments: row.totalConsignments,
          pendingBalance: row.pendingBalance
        })),
        recentPartners,
        total: marketsWithStats.length
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
