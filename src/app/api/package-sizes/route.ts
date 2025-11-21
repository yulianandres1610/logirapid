import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const { searchParams } = new URL(request.url)
    const companyIdParam = searchParams.get('companyId')

    console.log('[PACKAGE-SIZES API] isSuperAdmin:', isSuperAdmin)
    console.log('[PACKAGE-SIZES API] headerCompanyId:', headerCompanyId)
    console.log('[PACKAGE-SIZES API] companyIdParam:', companyIdParam)

    let query = `
      SELECT * FROM package_sizes
      WHERE status = 'active'`
    const params: any[] = []

    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      query += ' AND companyid = $1'
      params.push(headerCompanyId)
    } else if (companyIdParam) {
      query += ' AND companyid = $1'
      params.push(parseInt(companyIdParam))
    }

    query += ' ORDER BY isdefault DESC, name'

    console.log('[PACKAGE-SIZES API] Final query:', query)
    console.log('[PACKAGE-SIZES API] Params:', params)

    const result = await db.query(query, params.length > 0 ? params : undefined)

    console.log('[PACKAGE-SIZES API] Result count:', result.rows.length)

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching package sizes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch package sizes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const data = await request.json()
    const companyId = isSuperAdmin ? (data.companyId || headerCompanyId) : headerCompanyId

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa del usuario'
      }, { status: 400 })
    }
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