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

    // First, get all columns from companies table
    const columnsResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'companies'
      ORDER BY ordinal_position
    `)

    // Search in multiple possible name columns
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
         OR c.phone ILIKE $1
         OR c.email ILIKE $1
      ORDER BY c.id DESC
      LIMIT 20
    `, [`%${query}%`])

    // Also get ALL companies to see what's there
    const allCompanies = await db.query(`
      SELECT id, legalname, companytype, status
      FROM companies
      ORDER BY id DESC
      LIMIT 50
    `)

    return NextResponse.json({
      success: true,
      query,
      columns: columnsResult.rows.map(r => r.column_name),
      matchingCompanies: result.rows,
      allCompanies: allCompanies.rows
    })

  } catch (error) {
    console.error('[Debug Partners] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
