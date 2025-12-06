import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/wallet/search
 * Search for wallets by wallet number or phone number
 *
 * Query params:
 * - q: search query (wallet number or phone)
 * - type: 'company' | 'user' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'all'

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'La busqueda debe tener al menos 2 caracteres'
      }, { status: 400 })
    }

    const results: any[] = []

    // Search companies
    if (type === 'all' || type === 'company') {
      let companyQuery = `
        SELECT
          id,
          "legalName" as name,
          "walletNumber" as wallet_number,
          "walletBalance"::numeric as balance,
          phone,
          email,
          status,
          "dailyLimit"::numeric as daily_limit,
          "monthlyLimit"::numeric as monthly_limit,
          logo,
          currency,
          'company' as type
        FROM companies
        WHERE 1=1
      `
      const params: any[] = []
      let paramIndex = 1

      // SUPER_ADMIN can search all companies, others only their own
      if (payload.role !== 'SUPER_ADMIN') {
        companyQuery += ` AND id = $${paramIndex}`
        params.push(payload.companyId)
        paramIndex++
      }

      // Search by wallet number or phone
      companyQuery += ` AND (
        "walletNumber" ILIKE $${paramIndex}
        OR phone ILIKE $${paramIndex}
        OR "legalName" ILIKE $${paramIndex}
      )`
      params.push(`%${query}%`)

      const companyResults = await db.query(companyQuery, params)
      results.push(...companyResults.rows.map(row => ({
        id: row.id,
        name: row.name,
        walletNumber: row.wallet_number,
        balance: parseFloat(row.balance || '0'),
        balanceFormatted: `$${parseFloat(row.balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        phone: row.phone,
        email: row.email,
        status: row.status,
        dailyLimit: parseFloat(row.daily_limit || '0'),
        monthlyLimit: parseFloat(row.monthly_limit || '0'),
        logo: row.logo,
        currency: row.currency || 'USD',
        type: 'company'
      })))
    }

    // Search users
    if (type === 'all' || type === 'user') {
      let userQuery = `
        SELECT
          u.id,
          CONCAT(u.firstname, ' ', u.lastname) as name,
          u.wallet_number,
          u.wallet_balance as balance,
          u.phone,
          u.email,
          u.status,
          c.id as company_id,
          c."legalName" as company_name,
          'user' as type
        FROM users u
        LEFT JOIN user_companies uc ON u.id = uc.user_id
        LEFT JOIN companies c ON uc.company_id = c.id
        WHERE u.wallet_number IS NOT NULL
      `
      const params: any[] = []
      let paramIndex = 1

      // SUPER_ADMIN can search all users, others only their company's users
      if (payload.role !== 'SUPER_ADMIN') {
        userQuery += ` AND c.id = $${paramIndex}`
        params.push(payload.companyId)
        paramIndex++
      }

      // Search by wallet number or phone
      userQuery += ` AND (
        u.wallet_number ILIKE $${paramIndex}
        OR u.phone ILIKE $${paramIndex}
        OR CONCAT(u.firstname, ' ', u.lastname) ILIKE $${paramIndex}
      )`
      params.push(`%${query}%`)

      const userResults = await db.query(userQuery, params)
      results.push(...userResults.rows.map(row => ({
        id: row.id,
        name: row.name,
        walletNumber: row.wallet_number,
        balance: parseFloat(row.balance || '0'),
        balanceFormatted: `$${parseFloat(row.balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        phone: row.phone,
        email: row.email,
        status: row.status,
        companyId: row.company_id,
        companyName: row.company_name,
        type: 'user'
      })))
    }

    // Sort by balance descending
    results.sort((a, b) => b.balance - a.balance)

    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        count: results.length,
        results
      }
    })

  } catch (error) {
    console.error('Error searching wallets:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar wallets'
    }, { status: 500 })
  }
}
