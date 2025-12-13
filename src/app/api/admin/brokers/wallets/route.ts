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
 * GET /api/admin/brokers/wallets
 * Get all broker wallets with balances (SUPER_ADMIN only)
 */
export async function GET(request: NextRequest) {
  try {
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
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency')
    const brokerId = searchParams.get('brokerId')

    // Get all balances grouped by broker
    let whereClause = "WHERE c.companytype = 'broker'"
    const params: any[] = []

    if (brokerId) {
      params.push(parseInt(brokerId))
      whereClause += ` AND c.id = $${params.length}`
    }

    const result = await db.query(`
      SELECT
        c.id as broker_id,
        c.legalname as broker_name,
        c.broker_province,
        c.broker_municipality,
        c.broker_is_active,
        bwb.currency,
        bwb.available_balance,
        bwb.reserved_balance,
        bwb.total_balance,
        bwb.low_balance_threshold,
        bwb.last_updated
      FROM companies c
      LEFT JOIN broker_wallet_balances bwb ON bwb.company_id = c.id
      ${whereClause}
      ORDER BY c.legalname, bwb.currency
    `, params)

    // Group by broker
    const brokersMap: Record<number, {
      id: number
      name: string
      province: string
      municipality: string
      isActive: boolean
      balances: any[]
    }> = {}

    for (const row of result.rows) {
      if (!brokersMap[row.broker_id]) {
        brokersMap[row.broker_id] = {
          id: row.broker_id,
          name: row.broker_name,
          province: row.broker_province,
          municipality: row.broker_municipality,
          isActive: row.broker_is_active,
          balances: []
        }
      }

      if (row.currency) {
        if (!currency || row.currency === currency) {
          brokersMap[row.broker_id].balances.push({
            currency: row.currency,
            available: parseFloat(row.available_balance) || 0,
            reserved: parseFloat(row.reserved_balance) || 0,
            total: parseFloat(row.total_balance) || 0,
            lowThreshold: parseFloat(row.low_balance_threshold) || 100,
            isLow: parseFloat(row.available_balance) < parseFloat(row.low_balance_threshold),
            lastUpdated: row.last_updated
          })
        }
      }
    }

    const brokers = Object.values(brokersMap)

    // Calculate totals by currency
    const totalsResult = await db.query(`
      SELECT
        currency,
        SUM(available_balance) as total_available,
        SUM(reserved_balance) as total_reserved,
        SUM(total_balance) as grand_total,
        COUNT(*) as broker_count
      FROM broker_wallet_balances
      GROUP BY currency
      ORDER BY currency
    `)

    const totals = totalsResult.rows.map(row => ({
      currency: row.currency,
      totalAvailable: parseFloat(row.total_available) || 0,
      totalReserved: parseFloat(row.total_reserved) || 0,
      grandTotal: parseFloat(row.grand_total) || 0,
      brokerCount: parseInt(row.broker_count)
    }))

    // Get recent transactions
    const transactionsResult = await db.query(`
      SELECT
        bwt.id,
        bwt.broker_company_id,
        c.legalname as broker_name,
        bwt.currency,
        bwt.transaction_type,
        bwt.amount,
        bwt.balance_after,
        bwt.reference_type,
        bwt.reference_id,
        bwt.notes,
        bwt.created_at,
        u.full_name as created_by_name
      FROM broker_wallet_transactions bwt
      JOIN companies c ON c.id = bwt.broker_company_id
      LEFT JOIN users u ON u.id = bwt.created_by
      ORDER BY bwt.created_at DESC
      LIMIT 50
    `)

    const recentTransactions = transactionsResult.rows.map(row => ({
      id: row.id,
      brokerId: row.broker_company_id,
      brokerName: row.broker_name,
      currency: row.currency,
      type: row.transaction_type,
      amount: parseFloat(row.amount),
      balanceAfter: parseFloat(row.balance_after),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      createdAt: row.created_at,
      createdByName: row.created_by_name
    }))

    return NextResponse.json({
      success: true,
      data: {
        brokers,
        totals,
        recentTransactions
      }
    })

  } catch (error) {
    console.error('[Admin Brokers Wallets API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener wallets'
    }, { status: 500 })
  }
}
