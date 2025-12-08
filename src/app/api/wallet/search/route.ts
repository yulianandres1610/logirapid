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
 * - type: 'company' | 'user' | 'customer' | 'all' (default: 'all')
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

    // Search companies - only those with wallet number
    if (type === 'all' || type === 'company') {
      let companyQuery = `
        SELECT
          id,
          legalname as name,
          walletnumber as wallet_number,
          walletbalance as balance,
          phone,
          email,
          status,
          dailylimit as daily_limit,
          monthlylimit as monthly_limit,
          logo,
          currency,
          credit_limit,
          credit_enabled,
          negative_since,
          'company' as type
        FROM companies
        WHERE walletnumber IS NOT NULL
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
        walletnumber ILIKE $${paramIndex}
        OR phone ILIKE $${paramIndex}
        OR legalname ILIKE $${paramIndex}
      )`
      params.push(`%${query}%`)

      const companyResults = await db.query(companyQuery, params)
      results.push(...companyResults.rows.map(row => {
        const balance = parseFloat(row.balance || '0')
        const creditLimit = parseFloat(row.credit_limit || '-200')
        const creditEnabled = row.credit_enabled !== false
        const creditLimitAbs = Math.abs(creditLimit)
        const isNegative = balance < 0
        const creditUsed = isNegative ? Math.abs(balance) : 0
        const availableCredit = creditLimitAbs - creditUsed

        // Calculate days in negative
        let daysInNegative = 0
        if (row.negative_since) {
          const negativeSince = new Date(row.negative_since)
          const now = new Date()
          daysInNegative = Math.floor((now.getTime() - negativeSince.getTime()) / (1000 * 60 * 60 * 24))
        }

        return {
          id: row.id,
          uniqueId: `company_${row.id}`,
          name: row.name,
          walletNumber: row.wallet_number,
          balance,
          balanceFormatted: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          phone: row.phone,
          email: row.email,
          status: row.status,
          dailyLimit: parseFloat(row.daily_limit || '5000'),
          monthlyLimit: parseFloat(row.monthly_limit || '50000'),
          logo: row.logo,
          currency: row.currency || 'USD',
          type: 'company',
          typeLabel: 'Empresa',
          // Credit fields (only for companies)
          creditLimit,
          creditLimitFormatted: `$${creditLimitAbs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          creditEnabled,
          availableCredit,
          availableCreditFormatted: `$${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isNegative,
          daysInNegative,
          negativeSince: row.negative_since
        }
      }))
    }

    // Search users - use DISTINCT to avoid duplicates from multiple companies
    if (type === 'all' || type === 'user') {
      let userQuery = `
        SELECT DISTINCT ON (u.id)
          u.id,
          CONCAT(u.firstname, ' ', u.lastname) as name,
          u.wallet_number,
          u.wallet_balance as balance,
          u.phone,
          u.email,
          u.status,
          c.id as company_id,
          c.legalname as company_name,
          'user' as type
        FROM users u
        LEFT JOIN user_companies uc ON u.id = uc.userid
        LEFT JOIN companies c ON uc.companyid = c.id
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

      userQuery += ` ORDER BY u.id, c.id`

      const userResults = await db.query(userQuery, params)
      results.push(...userResults.rows.map(row => ({
        id: row.id,
        uniqueId: `user_${row.id}`,
        name: row.name,
        walletNumber: row.wallet_number,
        balance: parseFloat(row.balance || '0'),
        balanceFormatted: `$${parseFloat(row.balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        phone: row.phone,
        email: row.email,
        status: row.status,
        companyId: row.company_id,
        companyName: row.company_name,
        type: 'user',
        typeLabel: 'Usuario'
      })))
    }

    // Search customers - filter duplicates by selecting only one per phone+name combo
    if (type === 'all' || type === 'customer') {
      let customerQuery = `
        SELECT DISTINCT ON (cust.phone, CONCAT(cust.firstname, ' ', cust.lastname))
          cust.id,
          CONCAT(cust.firstname, ' ', cust.lastname) as name,
          cust.wallet_number,
          cust.wallet_balance as balance,
          cust.phone,
          cust.email,
          cust.company_id,
          comp.legalname as company_name,
          'customer' as type
        FROM customers cust
        LEFT JOIN companies comp ON cust.company_id = comp.id
        WHERE cust.wallet_number IS NOT NULL
      `
      const params: any[] = []
      let paramIndex = 1

      // SUPER_ADMIN can search all customers, others only their company's customers
      if (payload.role !== 'SUPER_ADMIN') {
        customerQuery += ` AND cust.company_id = $${paramIndex}`
        params.push(payload.companyId)
        paramIndex++
      }

      // Search by wallet number, phone or name
      customerQuery += ` AND (
        cust.wallet_number ILIKE $${paramIndex}
        OR cust.phone ILIKE $${paramIndex}
        OR CONCAT(cust.firstname, ' ', cust.lastname) ILIKE $${paramIndex}
      )`
      params.push(`%${query}%`)

      customerQuery += ` ORDER BY cust.phone, CONCAT(cust.firstname, ' ', cust.lastname), cust.id`

      const customerResults = await db.query(customerQuery, params)
      results.push(...customerResults.rows.map(row => ({
        id: row.id,
        uniqueId: `customer_${row.id}`,
        name: row.name,
        walletNumber: row.wallet_number,
        balance: parseFloat(row.balance || '0'),
        balanceFormatted: `$${parseFloat(row.balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        phone: row.phone,
        email: row.email,
        status: 'active',
        companyId: row.company_id,
        companyName: row.company_name,
        type: 'customer',
        typeLabel: 'Cliente'
      })))
    }

    // Sort by balance descending
    results.sort((a, b) => b.balance - a.balance)

    // Remove any remaining duplicates by uniqueId
    const uniqueResults = results.filter((item, index, self) =>
      index === self.findIndex(t => t.uniqueId === item.uniqueId)
    )

    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        count: uniqueResults.length,
        results: uniqueResults
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
