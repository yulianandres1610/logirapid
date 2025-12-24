import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/partners/debug?q=infanta
 * Debug endpoint to check company data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'infanta'

    const result = await db.query(`
      SELECT
        c.id,
        c.legalname,
        c.phone,
        c.email,
        c.companytype,
        c.status
      FROM companies c
      WHERE c.legalname ILIKE $1
      ORDER BY c.id DESC
      LIMIT 10
    `, [`%${query}%`])

    return NextResponse.json({
      success: true,
      query,
      total: result.rows.length,
      companies: result.rows
    })

  } catch (error) {
    console.error('[Debug Partners] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
