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
 * POST /api/wallet/recharge
 * Process a wallet recharge
 *
 * Body:
 * {
 *   targetWalletNumber: string,
 *   targetType: 'company' | 'user',
 *   amount: number,
 *   paymentMethod: 'card_manual' | 'card_terminal' | 'cash' | 'wire' | 'zelle',
 *   paymentReference?: string,
 *   terminalId?: number,
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

    const body = await request.json()
    const {
      targetWalletNumber,
      targetType,
      amount,
      paymentMethod,
      paymentReference,
      terminalId,
      description
    } = body

    // Validate required fields
    if (!targetWalletNumber || !targetType || !amount || !paymentMethod) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: targetWalletNumber, targetType, amount, paymentMethod'
      }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    const validMethods = ['card_manual', 'card_terminal', 'cash', 'wire', 'zelle', 'credit']
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json({
        success: false,
        error: `Metodo de pago invalido. Validos: ${validMethods.join(', ')}`
      }, { status: 400 })
    }

    // Check if method requires approval (credit does not require approval - only SUPER_ADMIN can use it)
    const requiresApproval = ['cash', 'wire', 'zelle'].includes(paymentMethod)

    // Only SUPER_ADMIN can give credit
    if (paymentMethod === 'credit' && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede otorgar crédito'
      }, { status: 403 })
    }

    // Only SUPER_ADMIN can approve immediately for cash/wire/zelle
    // Others must create a request that SUPER_ADMIN will approve
    const canProcessImmediately = !requiresApproval || payload.role === 'SUPER_ADMIN'

    // Find target wallet
    let targetId: number | null = null
    let targetName: string = ''
    let currentBalance: number = 0

    if (targetType === 'company') {
      const companyResult = await db.query(`
        SELECT id, legalname, walletbalance as balance
        FROM companies
        WHERE walletnumber = $1
      `, [targetWalletNumber])

      if (companyResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada con ese numero de wallet'
        }, { status: 404 })
      }

      targetId = companyResult.rows[0].id
      targetName = companyResult.rows[0].legalname
      currentBalance = parseFloat(companyResult.rows[0].balance || '0')

      // Check access
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== targetId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a esta empresa'
        }, { status: 403 })
      }
    } else if (targetType === 'user') {
      const userResult = await db.query(`
        SELECT u.id, CONCAT(u.firstname, ' ', u.lastname) as name, u.wallet_balance as balance
        FROM users u
        WHERE u.wallet_number = $1
      `, [targetWalletNumber])

      if (userResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado con ese numero de wallet'
        }, { status: 404 })
      }

      targetId = userResult.rows[0].id
      targetName = userResult.rows[0].name
      currentBalance = parseFloat(userResult.rows[0].balance || '0')
    } else if (targetType === 'customer') {
      const customerResult = await db.query(`
        SELECT id, CONCAT(firstname, ' ', lastname) as name, wallet_balance as balance, company_id
        FROM customers
        WHERE wallet_number = $1
      `, [targetWalletNumber])

      if (customerResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Cliente no encontrado con ese numero de wallet'
        }, { status: 404 })
      }

      targetId = customerResult.rows[0].id
      targetName = customerResult.rows[0].name
      currentBalance = parseFloat(customerResult.rows[0].balance || '0')

      // Check access for non-SUPER_ADMIN
      if (payload.role !== 'SUPER_ADMIN' && customerResult.rows[0].company_id !== payload.companyId) {
        return NextResponse.json({
          success: false,
          error: 'No tiene acceso a este cliente'
        }, { status: 403 })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'targetType debe ser "company", "user" o "customer"'
      }, { status: 400 })
    }

    const netAmount = amount // No fee for now

    if (canProcessImmediately) {
      // Process immediately - update balance and create transaction
      const result = await db.transaction(async (client) => {
        // Update target balance
        if (targetType === 'company') {
          await client.query(`
            UPDATE companies
            SET walletbalance = walletbalance + $1
            WHERE id = $2
          `, [netAmount, targetId])
        } else if (targetType === 'user') {
          await client.query(`
            UPDATE users
            SET wallet_balance = wallet_balance + $1
            WHERE id = $2
          `, [netAmount, targetId])
        } else if (targetType === 'customer') {
          await client.query(`
            UPDATE customers
            SET wallet_balance = wallet_balance + $1
            WHERE id = $2
          `, [netAmount, targetId])
        }

        // Create transaction record
        const txResult = await client.query(`
          INSERT INTO wallet_transactions (
            type,
            source_type,
            target_type,
            target_company_id,
            target_user_id,
            target_customer_id,
            target_wallet_number,
            amount,
            fee,
            net_amount,
            currency,
            payment_method,
            payment_reference,
            terminal_id,
            status,
            requires_approval,
            description,
            created_by,
            created_by_name,
            completed_at
          ) VALUES (
            'recharge',
            'external',
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            0,
            $6,
            'USD',
            $7,
            $8,
            $9,
            'completed',
            false,
            $10,
            $11,
            $12,
            NOW()
          ) RETURNING id, transaction_number
        `, [
          targetType,
          targetType === 'company' ? targetId : null,
          targetType === 'user' ? targetId : null,
          targetType === 'customer' ? targetId : null,
          targetWalletNumber,
          amount,
          paymentMethod,
          paymentReference || null,
          terminalId || null,
          description || (paymentMethod === 'credit' ? 'Crédito LogiRapid' : `Recarga via ${paymentMethod}`),
          payload.userId,
          payload.email
        ])

        return { id: txResult.rows[0].id, transactionNumber: txResult.rows[0].transaction_number }
      })

      const newBalance = currentBalance + netAmount

      return NextResponse.json({
        success: true,
        message: 'Recarga procesada exitosamente',
        data: {
          transactionNumber: result.transactionNumber,
          targetWalletNumber,
          targetName,
          amount,
          netAmount,
          paymentMethod,
          previousBalance: currentBalance,
          newBalance,
          newBalanceFormatted: `$${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          status: 'completed'
        }
      })

    } else {
      // Create a pending request for SUPER_ADMIN approval

      const reqResult = await db.query(`
        INSERT INTO wallet_recharge_requests (
          company_id,
          user_id,
          customer_id,
          wallet_number,
          wallet_type,
          amount,
          currency,
          payment_method,
          payment_reference,
          status,
          requested_by,
          requested_by_name,
          requested_by_email
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'USD',
          $7,
          $8,
          'pending',
          $9,
          $10,
          $11
        ) RETURNING id
      `, [
        targetType === 'company' ? targetId : null,
        targetType === 'user' ? targetId : null,
        targetType === 'customer' ? targetId : null,
        targetWalletNumber,
        targetType,
        amount,
        paymentMethod,
        paymentReference || null,
        payload.userId,
        payload.email,
        payload.email
      ])

      return NextResponse.json({
        success: true,
        message: 'Solicitud de recarga creada. Pendiente de aprobacion por SUPER_ADMIN.',
        data: {
          requestId: reqResult.rows[0].id,
          targetWalletNumber,
          targetName,
          amount,
          paymentMethod,
          status: 'pending'
        }
      })
    }

  } catch (error) {
    console.error('Error processing recharge:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar recarga'
    }, { status: 500 })
  }
}
