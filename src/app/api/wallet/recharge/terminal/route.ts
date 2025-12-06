import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import {
  createSquareOrder,
  createTerminalCheckout,
  getPlatformCredentials,
  calculateTerminalFee,
  dollarsToCents,
  SquareCredentials
} from '@/lib/square'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/wallet/recharge/terminal
 * Create a terminal checkout for wallet recharge
 *
 * Body:
 * {
 *   targetWalletNumber: string,
 *   targetType: 'company' | 'user' | 'customer',
 *   amount: number,        // Monto base en dolares
 *   terminalId: number,    // ID del terminal en nuestra BD
 *   description?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     checkoutId: string,
 *     transactionId: number,
 *     transactionNumber: string,
 *     amount: number,
 *     fee: number,
 *     totalAmount: number,
 *     status: 'processing',
 *     deviceId: string,
 *     terminalName: string
 *   }
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
      terminalId,
      description
    } = body

    // Validate required fields
    if (!targetWalletNumber || !targetType || !amount || !terminalId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: targetWalletNumber, targetType, amount, terminalId'
      }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Calculate fee (3%)
    const feeCalc = calculateTerminalFee(amount)

    // Get terminal info
    const terminalResult = await db.query(`
      SELECT
        id,
        company_id as "companyId",
        name,
        provider,
        device_id as "deviceId",
        status,
        location_name as "locationName"
      FROM payment_terminals
      WHERE id = $1
    `, [terminalId])

    const terminal = terminalResult.rows[0]

    if (!terminal) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    if (terminal.provider !== 'square') {
      return NextResponse.json({
        success: false,
        error: 'Este terminal no es de Square'
      }, { status: 400 })
    }

    if (terminal.status !== 'paired') {
      return NextResponse.json({
        success: false,
        error: 'El terminal no esta emparejado. Por favor, empareje el terminal primero.'
      }, { status: 400 })
    }

    if (!terminal.deviceId) {
      return NextResponse.json({
        success: false,
        error: 'El terminal no tiene un device_id. Por favor, re-empareje el terminal.'
      }, { status: 400 })
    }

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

    // Get Square credentials
    let credentials: SquareCredentials | null = null

    if (terminal.companyId === null) {
      // Platform terminal - use platform credentials
      credentials = getPlatformCredentials()
      if (!credentials) {
        return NextResponse.json({
          success: false,
          error: 'Square de plataforma no esta configurado'
        }, { status: 400 })
      }
    } else {
      // Company terminal - get company credentials
      const settingsResult = await db.query(`
        SELECT
          square_access_token,
          square_location_id,
          square_environment,
          square_configured
        FROM company_payment_settings
        WHERE company_id = $1
      `, [terminal.companyId])

      const settings = settingsResult.rows[0]

      if (!settings || !settings.square_configured) {
        return NextResponse.json({
          success: false,
          error: 'Square no esta configurado para la empresa del terminal'
        }, { status: 400 })
      }

      credentials = {
        accessToken: settings.square_access_token,
        locationId: settings.square_location_id,
        environment: settings.square_environment || 'sandbox'
      }
    }

    // Create wallet transaction with status 'processing'
    const txResult = await db.query(`
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
        terminal_id,
        status,
        requires_approval,
        description,
        created_by,
        created_by_name,
        metadata
      ) VALUES (
        'recharge',
        'external',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $6,
        'USD',
        'card_terminal',
        $8,
        'processing',
        false,
        $9,
        $10,
        $11,
        $12
      ) RETURNING id, transaction_number
    `, [
      targetType,
      targetType === 'company' ? targetId : null,
      targetType === 'user' ? targetId : null,
      targetType === 'customer' ? targetId : null,
      targetWalletNumber,
      amount,
      feeCalc.fee,
      terminalId,
      description || `Recarga via Terminal - ${terminal.name}`,
      payload.userId,
      payload.email,
      JSON.stringify({
        terminalName: terminal.name,
        locationName: terminal.locationName,
        targetName,
        previousBalance: currentBalance
      })
    ])

    const transactionId = txResult.rows[0].id
    const transactionNumber = txResult.rows[0].transaction_number

    console.log('[Terminal Checkout] Created transaction:', transactionNumber)

    // Determine if this is a platform terminal (no app_fee allowed)
    const isPlatformTerminal = terminal.companyId === null

    // Create Square Order
    const orderResult = await createSquareOrder(credentials, {
      transactionNumber,
      amount: dollarsToCents(amount),
      appFee: dollarsToCents(feeCalc.fee),
      description: `Wallet Recharge - ${transactionNumber}`,
      isPlatformTerminal
    })

    if (!orderResult.success || !orderResult.orderId) {
      // Update transaction as failed
      await db.query(`
        UPDATE wallet_transactions
        SET status = 'failed', metadata = metadata || $1
        WHERE id = $2
      `, [JSON.stringify({ error: orderResult.error }), transactionId])

      return NextResponse.json({
        success: false,
        error: orderResult.error || 'Error al crear orden en Square'
      }, { status: 400 })
    }

    console.log('[Terminal Checkout] Created Square order:', orderResult.orderId)

    // Create Terminal Checkout
    const checkoutResult = await createTerminalCheckout(credentials, {
      orderId: orderResult.orderId,
      deviceId: terminal.deviceId,
      amount: dollarsToCents(amount),
      appFee: dollarsToCents(feeCalc.fee),
      collectSignature: true,
      skipReceipt: false,
      note: `Recarga Wallet - ${transactionNumber}`,
      isPlatformTerminal
    })

    if (!checkoutResult.success || !checkoutResult.checkoutId) {
      // Update transaction as failed
      await db.query(`
        UPDATE wallet_transactions
        SET status = 'failed', metadata = metadata || $1
        WHERE id = $2
      `, [JSON.stringify({ error: checkoutResult.error, orderId: orderResult.orderId }), transactionId])

      return NextResponse.json({
        success: false,
        error: checkoutResult.error || 'Error al crear checkout en terminal'
      }, { status: 400 })
    }

    console.log('[Terminal Checkout] Created terminal checkout:', checkoutResult.checkoutId)

    // Update transaction with checkout info
    await db.query(`
      UPDATE wallet_transactions
      SET metadata = metadata || $1
      WHERE id = $2
    `, [JSON.stringify({
      checkoutId: checkoutResult.checkoutId,
      orderId: orderResult.orderId,
      deviceId: terminal.deviceId
    }), transactionId])

    return NextResponse.json({
      success: true,
      message: 'Checkout enviado al terminal. Esperando pago...',
      data: {
        checkoutId: checkoutResult.checkoutId,
        transactionId,
        transactionNumber,
        amount,
        fee: feeCalc.fee,
        totalAmount: feeCalc.total,
        status: 'processing',
        deviceId: terminal.deviceId,
        terminalName: terminal.name,
        terminalLocation: terminal.locationName,
        targetName,
        targetWalletNumber,
        previousBalance: currentBalance,
        newBalanceAfterApproval: currentBalance + amount
      }
    })

  } catch (error) {
    console.error('Error creating terminal checkout:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar recarga por terminal'
    }, { status: 500 })
  }
}
