import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// GET: Obtener todas las empresas
export async function GET(request: NextRequest) {
  try {
    const query = `
      SELECT
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        phone,
        email,
        address,
        city,
        state,
        country,
        zipcode as "zipCode",
        status,
        createdat as "createdAt"
      FROM companies
      ORDER BY legalname ASC
    `

    const result = await db.query(query)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting companies:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener empresas'
    }, { status: 500 })
  }
}