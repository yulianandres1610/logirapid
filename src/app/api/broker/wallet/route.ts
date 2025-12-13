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
 * GET /api/broker/wallet
 * Get broker's wallet balances by currency
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

    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('historyLimit') || '20')

    // Verify company is a broker
    const companyCheck = await db.query(`
      SELECT companytype, legalname FROM companies WHERE id = $1
    `, [payload.companyId])

    if (companyCheck.rows.length === 0 || companyCheck.rows[0].companytype !== 'broker') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    // Get balances
    const balancesResult = await db.query(`
      SELECT
        currency,
        available_balance,
        reserved_balance,
        total_balance,
        low_balance_threshold,
        last_updated
      FROM broker_wallet_balances
      WHERE company_id = $1
      ORDER BY currency
    `, [payload.companyId])

    // Get pending reservations
    const reservationsResult = await db.query(`
      SELECT
        br.currency,
        COUNT(*) as count,
        SUM(br.amount) as total
      FROM broker_reservations br
      WHERE br.broker_company_id = $1 AND br.status = 'reserved'
      GROUP BY br.currency
    `, [payload.companyId])

    const reservationsMap: Record<string, { count: number; total: number }> = {}
    for (const row of reservationsResult.rows) {
      reservationsMap[row.currency] = {
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }
    }

    // Format balances
    const balances = balancesResult.rows.map(row => ({
      currency: row.currency,
      availableBalance: parseFloat(row.available_balance) || 0,
      reservedBalance: parseFloat(row.reserved_balance) || 0,
      totalBalance: parseFloat(row.total_balance) || 0,
      lowBalanceThreshold: parseFloat(row.low_balance_threshold) || 100,
      lastUpdated: row.last_updated,
      isLowBalance: parseFloat(row.available_balance) < parseFloat(row.low_balance_threshold),
      pendingOrders: reservationsMap[row.currency]?.count || 0
    }))

    // Calculate totals (convert all to USD equivalent for summary)
    const totalAvailable = balances
      .filter(b => b.currency === 'USD')
      .reduce((sum, b) => sum + b.availableBalance, 0)
    const totalReserved = balances
      .filter(b => b.currency === 'USD')
      .reduce((sum, b) => sum + b.reservedBalance, 0)

    let history: any[] = []
    if (includeHistory) {
      const historyResult = await db.query(`
        SELECT
          id,
          currency,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          reserved_before,
          reserved_after,
          reference_type,
          reference_id,
          notes,
          created_at
        FROM broker_wallet_transactions
        WHERE broker_company_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [payload.companyId, historyLimit])

      history = historyResult.rows.map(row => ({
        id: row.id,
        currency: row.currency,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        balanceBefore: parseFloat(row.balance_before),
        balanceAfter: parseFloat(row.balance_after),
        reservedBefore: parseFloat(row.reserved_before),
        reservedAfter: parseFloat(row.reserved_after),
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        notes: row.notes,
        createdAt: row.created_at
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        companyName: companyCheck.rows[0].legalname,
        balances,
        summary: {
          totalAvailableUSD: totalAvailable,
          totalReservedUSD: totalReserved,
          currencyCount: balances.length
        },
        history: includeHistory ? history : undefined
      }
    })

  } catch (error) {
    console.error('[Broker Wallet API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener balances'
    }, { status: 500 })
  }
}

/**
 * POST /api/broker/wallet
 * Deposit or withdraw from broker wallet (self-service)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { currency, amount, type, notes } = body

    if (!currency || !amount || !type) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere currency, amount y type'
      }, { status: 400 })
    }

    if (!['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'type debe ser deposit o withdrawal'
      }, { status: 400 })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Verify company is a broker
    const companyCheck = await db.query(`
      SELECT companytype FROM companies WHERE id = $1
    `, [payload.companyId])

    if (companyCheck.rows.length === 0 || companyCheck.rows[0].companytype !== 'broker') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    await db.query('BEGIN')

    try {
      // Get or create balance record
      let balanceResult = await db.query(`
        SELECT * FROM broker_wallet_balances
        WHERE company_id = $1 AND currency = $2
        FOR UPDATE
      `, [payload.companyId, currency])

      if (balanceResult.rows.length === 0) {
        // Create new balance record
        await db.query(`
          INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
          VALUES ($1, $2, 0, 0)
        `, [payload.companyId, currency])

        balanceResult = await db.query(`
          SELECT * FROM broker_wallet_balances
          WHERE company_id = $1 AND currency = $2
          FOR UPDATE
        `, [payload.companyId, currency])
      }

      const currentBalance = parseFloat(balanceResult.rows[0].available_balance) || 0
      const currentReserved = parseFloat(balanceResult.rows[0].reserved_balance) || 0

      // Validate withdrawal
      if (type === 'withdrawal' && numAmount > currentBalance) {
        await db.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Fondos insuficientes para retiro'
        }, { status: 400 })
      }

      // Calculate new balance
      const newBalance = type === 'deposit'
        ? currentBalance + numAmount
        : currentBalance - numAmount

      // Update balance
      await db.query(`
        UPDATE broker_wallet_balances
        SET available_balance = $1, last_updated = NOW()
        WHERE company_id = $2 AND currency = $3
      `, [newBalance, payload.companyId, currency])

      // Record transaction
      await db.query(`
        INSERT INTO broker_wallet_transactions (
          broker_company_id, currency, transaction_type, amount,
          balance_before, balance_after, reserved_before, reserved_after,
          reference_type, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
      `, [
        payload.companyId, currency, type, numAmount,
        currentBalance, newBalance, currentReserved,
        type === 'deposit' ? 'manual_deposit' : 'manual_withdrawal',
        notes || `${type === 'deposit' ? 'Depósito' : 'Retiro'} manual`,
        payload.userId
      ])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: type === 'deposit' ? 'Depósito realizado' : 'Retiro realizado',
        data: {
          currency,
          previousBalance: currentBalance,
          amount: numAmount,
          newBalance,
          type
        }
      })

    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Broker Wallet API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar transacción'
    }, { status: 500 })
  }
}
