import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/partners/debug?q=infanta
 * Debug endpoint to check company data
 *
 * POST /api/consignments/partners/debug
 * Fix company name
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'infanta'

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

    return NextResponse.json({
      success: true,
      query,
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

export async function POST(request: NextRequest) {
  try {
    const { id, newName } = await request.json()

    if (!id || !newName) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere id y newName'
      }, { status: 400 })
    }

    // Update company name
    await db.query(`
      UPDATE companies
      SET legalname = $1
      WHERE id = $2
    `, [newName.trim(), id])

    // Verify update
    const result = await db.query(`
      SELECT id, legalname, companytype, status
      FROM companies
      WHERE id = $1
    `, [id])

    return NextResponse.json({
      success: true,
      message: 'Nombre actualizado',
      company: result.rows[0]
    })

  } catch (error) {
    console.error('[Debug Partners] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
