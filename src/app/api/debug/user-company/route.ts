import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/debug/user-company
 * Debug endpoint to check user company association
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const companyIdCookie = cookieStore.get('user-company-id')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No auth token'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 401 })
    }

    // Query user_companies table
    const userCompanies = await db.query(`
      SELECT uc.*, c.legalname, c.companytype
      FROM user_companies uc
      JOIN companies c ON uc.companyid = c.id
      WHERE uc.userid = $1
    `, [payload.userId])

    // Query latest remittance orders
    const latestOrders = await db.query(`
      SELECT id, order_number, selling_company_id, created_at
      FROM remittance_orders
      ORDER BY created_at DESC
      LIMIT 5
    `)

    return NextResponse.json({
      success: true,
      debug: {
        jwt: {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          companyId: payload.companyId,
          companyIdType: typeof payload.companyId,
          companyName: payload.companyName
        },
        cookies: {
          companyIdCookie: companyIdCookie,
          companyIdCookieType: typeof companyIdCookie
        },
        userCompanies: userCompanies.rows,
        latestOrders: latestOrders.rows,
        analysis: {
          jwtHasCompanyId: payload.companyId !== undefined && payload.companyId !== null,
          companyIdMatch: userCompanies.rows.some(uc => uc.companyid === payload.companyId),
          ordersWithMatchingCompany: latestOrders.rows.filter(o => o.selling_company_id === payload.companyId).length
        }
      }
    })
  } catch (error) {
    console.error('[Debug User Company] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
