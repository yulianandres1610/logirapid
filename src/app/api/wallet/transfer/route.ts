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
 * POST /api/wallet/transfer
 * Transfer funds between wallets
 *
 * Body:
 * {
 *   sourceWalletNumber: string,
 *   sourceType: 'company' | 'user',
 *   targetWalletNumber: string,
 *   targetType: 'company' | 'user',
 *   amount: number,
 *   description?: string
 * }
 */
export async function POST(request: NextRequest) {
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

    // Only SUPER_ADMIN can make transfers
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede realizar transferencias'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      sourceWalletNumber,
      sourceType,
      targetWalletNumber,
      targetType,
      amount,
      description
    } = body

    // Validate required fields
    if (!sourceWalletNumber || !sourceType || !targetWalletNumber || !targetType || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    if (sourceWalletNumber === targetWalletNumber) {
      return NextResponse.json({
        success: false,
        error: 'No puede transferir al mismo wallet'
      }, { status: 400 })
    }

    // Find source wallet
    let sourceId: number | null = null
    let sourceName: string = ''
    let sourceBalance: number = 0

    if (sourceType === 'company') {
      const result = await db.query(`
        SELECT id, legalname, walletbalance as balance
        FROM companies
        WHERE walletnumber = $1
      `, [sourceWalletNumber])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Wallet origen no encontrado'
        }, { status: 404 })
      }

      sourceId = result.rows[0].id
      sourceName = result.rows[0].legalname
      sourceBalance = parseFloat(result.rows[0].balance || '0')
    } else if (sourceType === 'user') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance
        FROM users
        WHERE wallet_number = $1
      `, [sourceWalletNumber])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Wallet origen no encontrado'
        }, { status: 404 })
      }

      sourceId = result.rows[0].id
      sourceName = result.rows[0].name
      sourceBalance = parseFloat(result.rows[0].balance || '0')
    }

    // Check sufficient balance
    if (sourceBalance < amount) {
      return NextResponse.json({
        success: false,
        error: `Balance insuficiente. Disponible: $${sourceBalance.toFixed(2)}`
      }, { status: 400 })
    }

    // Find target wallet
    let targetId: number | null = null
    let targetName: string = ''
    let targetBalance: number = 0

    if (targetType === 'company') {
      const result = await db.query(`
        SELECT id, legalname, walletbalance as balance
        FROM companies
        WHERE walletnumber = $1
      `, [targetWalletNumber])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Wallet destino no encontrado'
        }, { status: 404 })
      }

      targetId = result.rows[0].id
      targetName = result.rows[0].legalname
      targetBalance = parseFloat(result.rows[0].balance || '0')
    } else if (targetType === 'user') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance
        FROM users
        WHERE wallet_number = $1
      `, [targetWalletNumber])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Wallet destino no encontrado'
        }, { status: 404 })
      }

      targetId = result.rows[0].id
      targetName = result.rows[0].name
      targetBalance = parseFloat(result.rows[0].balance || '0')
    }

    // Process transfer atomically
    const transactionResult = await db.transaction(async (client) => {
      // Deduct from source
      if (sourceType === 'company') {
        await client.query(`
          UPDATE companies
          SET walletbalance = walletbalance - $1
          WHERE id = $2
        `, [amount, sourceId])
      } else {
        await client.query(`
          UPDATE users
          SET wallet_balance = wallet_balance - $1
          WHERE id = $2
        `, [amount, sourceId])
      }

      // Add to target
      if (targetType === 'company') {
        await client.query(`
          UPDATE companies
          SET walletbalance = walletbalance + $1
          WHERE id = $2
        `, [amount, targetId])
      } else {
        await client.query(`
          UPDATE users
          SET wallet_balance = wallet_balance + $1
          WHERE id = $2
        `, [amount, targetId])
      }

      // Create transfer_out transaction
      const outResult = await client.query(`
        INSERT INTO wallet_transactions (
          type,
          source_type,
          source_company_id,
          source_user_id,
          source_wallet_number,
          target_type,
          target_company_id,
          target_user_id,
          target_wallet_number,
          amount,
          fee,
          net_amount,
          currency,
          status,
          description,
          created_by,
          created_by_name,
          completed_at
        ) VALUES (
          'transfer_out',
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          0,
          $9,
          'USD',
          'completed',
          $10,
          $11,
          $12,
          NOW()
        ) RETURNING id
      `, [
        sourceType,
        sourceType === 'company' ? sourceId : null,
        sourceType === 'user' ? sourceId : null,
        sourceWalletNumber,
        targetType,
        targetType === 'company' ? targetId : null,
        targetType === 'user' ? targetId : null,
        targetWalletNumber,
        amount,
        description || `Transferencia de ${sourceName} a ${targetName}`,
        payload.userId,
        payload.email
      ])

      // Create transfer_in transaction
      const inResult = await client.query(`
        INSERT INTO wallet_transactions (
          type,
          source_type,
          source_company_id,
          source_user_id,
          source_wallet_number,
          target_type,
          target_company_id,
          target_user_id,
          target_wallet_number,
          amount,
          fee,
          net_amount,
          currency,
          status,
          description,
          created_by,
          created_by_name,
          completed_at
        ) VALUES (
          'transfer_in',
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          0,
          $9,
          'USD',
          'completed',
          $10,
          $11,
          $12,
          NOW()
        ) RETURNING id
      `, [
        sourceType,
        sourceType === 'company' ? sourceId : null,
        sourceType === 'user' ? sourceId : null,
        sourceWalletNumber,
        targetType,
        targetType === 'company' ? targetId : null,
        targetType === 'user' ? targetId : null,
        targetWalletNumber,
        amount,
        description || `Transferencia de ${sourceName} a ${targetName}`,
        payload.userId,
        payload.email
      ])

      return {
        outId: outResult.rows[0].id,
        inId: inResult.rows[0].id
      }
    })

    const sourceNewBalance = sourceBalance - amount
    const targetNewBalance = targetBalance + amount

    return NextResponse.json({
      success: true,
      message: 'Transferencia completada exitosamente',
      data: {
        transactionIds: {
          out: transactionResult.outId,
          in: transactionResult.inId
        },
        source: {
          walletNumber: sourceWalletNumber,
          name: sourceName,
          previousBalance: sourceBalance,
          newBalance: sourceNewBalance,
          newBalanceFormatted: `$${sourceNewBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        target: {
          walletNumber: targetWalletNumber,
          name: targetName,
          previousBalance: targetBalance,
          newBalance: targetNewBalance,
          newBalanceFormatted: `$${targetNewBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        amount,
        amountFormatted: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    })

  } catch (error) {
    console.error('Error processing transfer:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar transferencia'
    }, { status: 500 })
  }
}
