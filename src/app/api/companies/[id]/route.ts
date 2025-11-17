import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener una empresa por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const query = `
      SELECT
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        phone,
        address,
        city,
        country,
        status,
        logo,
        primary_color as "primaryColor",
        createdat as "createdAt"
      FROM companies
      WHERE id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error getting company:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener empresa'
    }, { status: 500 })
  }
}
