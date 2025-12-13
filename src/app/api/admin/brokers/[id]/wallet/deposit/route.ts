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
 * POST /api/admin/brokers/[id]/wallet/deposit
 * Deposit funds to a broker's wallet (SUPER_ADMIN only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const brokerId = parseInt(id)

    if (isNaN(brokerId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de broker inválido'
      }, { status: 400 })
    }

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

    const body = await request.json()
    const { currency, amount, notes } = body

    if (!currency || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere currency y amount'
      }, { status: 400 })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Verify broker exists
    const brokerCheck = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1 AND companytype = 'broker'
    `, [brokerId])

    if (brokerCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Broker no encontrado'
      }, { status: 404 })
    }

    const brokerName = brokerCheck.rows[0].legalname

    await db.query('BEGIN')

    try {
      // Get or create balance record
      let balanceResult = await db.query(`
        SELECT * FROM broker_wallet_balances
        WHERE company_id = $1 AND currency = $2
        FOR UPDATE
      `, [brokerId, currency])

      if (balanceResult.rows.length === 0) {
        // Create new balance record
        await db.query(`
          INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
          VALUES ($1, $2, 0, 0)
        `, [brokerId, currency])

        balanceResult = await db.query(`
          SELECT * FROM broker_wallet_balances
          WHERE company_id = $1 AND currency = $2
          FOR UPDATE
        `, [brokerId, currency])
      }

      const currentBalance = parseFloat(balanceResult.rows[0].available_balance) || 0
      const currentReserved = parseFloat(balanceResult.rows[0].reserved_balance) || 0
      const newBalance = currentBalance + numAmount

      // Update balance
      await db.query(`
        UPDATE broker_wallet_balances
        SET available_balance = $1, last_updated = NOW()
        WHERE company_id = $2 AND currency = $3
      `, [newBalance, brokerId, currency])

      // Record transaction
      await db.query(`
        INSERT INTO broker_wallet_transactions (
          broker_company_id, currency, transaction_type, amount,
          balance_before, balance_after, reserved_before, reserved_after,
          reference_type, notes, created_by
        ) VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $6, 'admin_deposit', $7, $8)
      `, [
        brokerId, currency, numAmount,
        currentBalance, newBalance, currentReserved,
        notes || `Depósito administrativo por SUPER_ADMIN`,
        payload.userId
      ])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Depósito de ${numAmount} ${currency} realizado a ${brokerName}`,
        data: {
          brokerId,
          brokerName,
          currency,
          previousBalance: currentBalance,
          depositAmount: numAmount,
          newBalance
        }
      })

    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Admin Broker Deposit API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al depositar'
    }, { status: 500 })
  }
}
