import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { sendWalletNotificationSMS } from '@/lib/sms-service'

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
 *   sourceType: 'company' | 'user' | 'customer',
 *   targetWalletNumber: string,
 *   targetType: 'company' | 'user' | 'customer',
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

    // SUPER_ADMIN, ADMIN, and MANAGER can make transfers
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para realizar transferencias'
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
    let sourcePhone: string | null = null
    let sourceCreditLimit: number = -200 // Default credit limit for companies
    let sourceCreditEnabled: boolean = true // Default credit enabled
    let sourceDailyLimit: number = 0 // 0 = unlimited
    let sourceMonthlyLimit: number = 0 // 0 = unlimited

    if (sourceType === 'company') {
      const result = await db.query(`
        SELECT id, legalname,
          COALESCE("walletBalance"::numeric, walletbalance, 0) as balance,
          phone, credit_limit, credit_enabled, negative_since,
          COALESCE("dailyLimit"::numeric, dailylimit, 0) as daily_limit,
          COALESCE("monthlyLimit"::numeric, monthlylimit, 0) as monthly_limit
        FROM companies
        WHERE COALESCE("walletNumber", walletnumber) = $1
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
      sourcePhone = result.rows[0].phone
      sourceCreditLimit = parseFloat(result.rows[0].credit_limit || '-200')
      sourceCreditEnabled = result.rows[0].credit_enabled !== false // Default to true if null
      sourceDailyLimit = parseFloat(result.rows[0].daily_limit || '0')
      sourceMonthlyLimit = parseFloat(result.rows[0].monthly_limit || '0')
    } else if (sourceType === 'user') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance, phone
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
      sourcePhone = result.rows[0].phone
    } else if (sourceType === 'customer') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance, phone
        FROM customers
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
      sourcePhone = result.rows[0].phone
    }

    // For ADMIN/MANAGER: validate they can only transfer from their own company's wallet
    if (payload.role !== 'SUPER_ADMIN') {
      if (sourceType === 'company' && sourceId !== payload.companyId) {
        return NextResponse.json({
          success: false,
          error: 'Solo puede transferir desde el wallet de su propia empresa'
        }, { status: 403 })
      }
      // ADMIN/MANAGER cannot transfer from user or customer wallets (only from company)
      if (sourceType !== 'company') {
        return NextResponse.json({
          success: false,
          error: 'Solo puede transferir desde el wallet de su empresa'
        }, { status: 403 })
      }
    }

    // Check sufficient balance (with credit for companies)
    if (sourceType === 'company' && sourceCreditEnabled) {
      // Companies with credit enabled can go negative up to their credit limit
      // creditLimit is negative (e.g., -200), so available = balance - creditLimit
      const availableBalance = sourceBalance - sourceCreditLimit
      const newBalanceAfterTransfer = sourceBalance - amount

      if (newBalanceAfterTransfer < sourceCreditLimit) {
        return NextResponse.json({
          success: false,
          error: `Balance insuficiente. Balance actual: $${sourceBalance.toFixed(2)}, Límite de crédito: $${Math.abs(sourceCreditLimit).toFixed(2)}, Disponible total: $${availableBalance.toFixed(2)}`
        }, { status: 400 })
      }
    } else {
      // Users and companies without credit enabled need positive balance
      if (sourceBalance < amount) {
        return NextResponse.json({
          success: false,
          error: `Balance insuficiente. Disponible: $${sourceBalance.toFixed(2)}`
        }, { status: 400 })
      }
    }

    // Check daily and monthly limits for companies (skip for SUPER_ADMIN)
    if (sourceType === 'company' && sourceId && payload.role !== 'SUPER_ADMIN') {
      // Get today's transfers (transfer_out from this company)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      // Calculate daily usage
      if (sourceDailyLimit > 0) {
        const dailyUsageResult = await db.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM wallet_transactions
          WHERE source_company_id = $1
            AND type = 'transfer_out'
            AND status = 'completed'
            AND created_at >= $2
        `, [sourceId, todayStart.toISOString()])

        const dailyUsed = parseFloat(dailyUsageResult.rows[0].total || '0')
        const dailyRemaining = sourceDailyLimit - dailyUsed

        if (amount > dailyRemaining) {
          return NextResponse.json({
            success: false,
            error: `Límite diario excedido. Límite: $${sourceDailyLimit.toFixed(2)}, Usado hoy: $${dailyUsed.toFixed(2)}, Disponible: $${dailyRemaining.toFixed(2)}`
          }, { status: 400 })
        }
      }

      // Calculate monthly usage
      if (sourceMonthlyLimit > 0) {
        const monthlyUsageResult = await db.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM wallet_transactions
          WHERE source_company_id = $1
            AND type = 'transfer_out'
            AND status = 'completed'
            AND created_at >= $2
        `, [sourceId, monthStart.toISOString()])

        const monthlyUsed = parseFloat(monthlyUsageResult.rows[0].total || '0')
        const monthlyRemaining = sourceMonthlyLimit - monthlyUsed

        if (amount > monthlyRemaining) {
          return NextResponse.json({
            success: false,
            error: `Límite mensual excedido. Límite: $${sourceMonthlyLimit.toFixed(2)}, Usado este mes: $${monthlyUsed.toFixed(2)}, Disponible: $${monthlyRemaining.toFixed(2)}`
          }, { status: 400 })
        }
      }
    }

    // Find target wallet
    let targetId: number | null = null
    let targetName: string = ''
    let targetBalance: number = 0
    let targetPhone: string | null = null

    if (targetType === 'company') {
      const result = await db.query(`
        SELECT id, legalname,
          COALESCE("walletBalance"::numeric, walletbalance, 0) as balance,
          phone
        FROM companies
        WHERE COALESCE("walletNumber", walletnumber) = $1
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
      targetPhone = result.rows[0].phone
    } else if (targetType === 'user') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance, phone
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
      targetPhone = result.rows[0].phone
    } else if (targetType === 'customer') {
      const result = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance, phone
        FROM customers
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
      targetPhone = result.rows[0].phone
    }

    // Calculate new balance after transfer to track negative_since
    const sourceNewBalanceCalc = sourceBalance - amount

    // Process transfer atomically
    const transactionResult = await db.transaction(async (client) => {
      // Deduct from source
      if (sourceType === 'company') {
        // Update balance and track negative_since for credit tracking
        // IMPORTANT: Update both walletbalance and "walletBalance" to keep them in sync
        if (sourceNewBalanceCalc < 0 && sourceBalance >= 0) {
          // Going negative for the first time - set negative_since
          await client.query(`
            UPDATE companies
            SET walletbalance = COALESCE(walletbalance, 0) - $1,
                "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) - $1)::varchar,
                negative_since = COALESCE(negative_since, NOW())
            WHERE id = $2
          `, [amount, sourceId])
        } else {
          await client.query(`
            UPDATE companies
            SET walletbalance = COALESCE(walletbalance, 0) - $1,
                "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) - $1)::varchar
            WHERE id = $2
          `, [amount, sourceId])
        }
      } else if (sourceType === 'user') {
        await client.query(`
          UPDATE users
          SET wallet_balance = wallet_balance - $1
          WHERE id = $2
        `, [amount, sourceId])
      } else if (sourceType === 'customer') {
        await client.query(`
          UPDATE customers
          SET wallet_balance = wallet_balance - $1
          WHERE id = $2
        `, [amount, sourceId])
      }

      // Add to target
      if (targetType === 'company') {
        // If target company was negative and is now positive, reset negative_since
        // IMPORTANT: Update both walletbalance and "walletBalance" to keep them in sync
        const targetNewBalanceCalc = targetBalance + amount
        if (targetBalance < 0 && targetNewBalanceCalc >= 0) {
          // Reset negative_since and credit charges tracking
          await client.query(`
            UPDATE companies
            SET walletbalance = COALESCE(walletbalance, 0) + $1,
                "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar,
                negative_since = NULL,
                late_fee_charged_at = NULL,
                last_interest_charge_at = NULL
            WHERE id = $2
          `, [amount, targetId])
        } else {
          await client.query(`
            UPDATE companies
            SET walletbalance = COALESCE(walletbalance, 0) + $1,
                "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
            WHERE id = $2
          `, [amount, targetId])
        }
      } else if (targetType === 'user') {
        await client.query(`
          UPDATE users
          SET wallet_balance = wallet_balance + $1
          WHERE id = $2
        `, [amount, targetId])
      } else if (targetType === 'customer') {
        await client.query(`
          UPDATE customers
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
          target_customer_id,
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
          $10,
          0,
          $10,
          'USD',
          'completed',
          $11,
          $12,
          $13,
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
        targetType === 'customer' ? targetId : null,
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
          target_customer_id,
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
          $10,
          0,
          $10,
          'USD',
          'completed',
          $11,
          $12,
          $13,
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
        targetType === 'customer' ? targetId : null,
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

    // Send SMS notifications (async, don't block response)
    const transferRef = `TRF-${transactionResult.outId}`

    // Notify source about transfer out
    if (sourcePhone) {
      sendWalletNotificationSMS(
        sourcePhone,
        'transfer_out',
        sourceName,
        amount,
        sourceNewBalance,
        { otherPartyName: targetName, transactionNumber: transferRef }
      ).then(result => {
        if (result.success) {
          console.log('[Transfer] SMS sent to source:', result.messageId)
        } else {
          console.log('[Transfer] SMS to source failed:', result.error)
        }
      }).catch(err => console.error('[Transfer] SMS to source error:', err))
    }

    // Notify target about transfer in
    if (targetPhone) {
      sendWalletNotificationSMS(
        targetPhone,
        'transfer_in',
        targetName,
        amount,
        targetNewBalance,
        { otherPartyName: sourceName, transactionNumber: transferRef }
      ).then(result => {
        if (result.success) {
          console.log('[Transfer] SMS sent to target:', result.messageId)
        } else {
          console.log('[Transfer] SMS to target failed:', result.error)
        }
      }).catch(err => console.error('[Transfer] SMS to target error:', err))
    }

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
