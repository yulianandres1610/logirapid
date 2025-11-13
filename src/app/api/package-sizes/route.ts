import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET() {
  try {
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const result = await db.query(`
      SELECT * FROM package_sizes
      WHERE companyid = $1 AND status = 'active'
      ORDER BY isdefault DESC, name
    `, [companyId])

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching package sizes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch package sizes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    let companyId = cookieStore.get('user-company-id')?.value

    // Si no hay cookie, usar ID 1 por defecto (para pruebas)
    if (!companyId) {
      console.warn('No company ID cookie found, using default ID 1')
      companyId = '1'
    }

    const data = await request.json()
    const { name, dimensions, weight, price, description, isDefault } = data

    if (!name || !dimensions || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, dimensions and price are required' },
        { status: 400 }
      )
    }

    // If this is being set as default, unset all other defaults
    if (isDefault) {
      await db.query(`
        UPDATE package_sizes
        SET isdefault = false
        WHERE companyid = $1 AND status = 'active'
      `, [companyId])
    }

    const result = await db.query(`
      INSERT INTO package_sizes (
        companyid, name, dimensions, weight, price, description, isdefault, status, createdat, updatedat
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      companyId,
      name,
      dimensions,
      weight || 0,
      price,
      description || '',
      isDefault ? true : false
    ])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating package size:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create package size' },
      { status: 500 }
    )
  }
}