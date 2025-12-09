import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createRechargePaymentIntent, STRIPE_FEE_PERCENTAGE } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/wallet/recharge/stripe
 *
 * Create a Stripe PaymentIntent for wallet recharge
 *
 * Body: {
 *   targetType: 'company' | 'user' | 'customer'
 *   targetId: number
 *   amount: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
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

    // Check permissions - SUPER_ADMIN, ADMIN, or MANAGER can recharge
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para realizar recargas'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { targetType, targetId, amount } = body

    // Validate required fields
    if (!targetType || !targetId || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: targetType, targetId, amount'
      }, { status: 400 })
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Minimum amount $1
    if (amount < 1) {
      return NextResponse.json({
        success: false,
        error: 'El monto mínimo es $1.00'
      }, { status: 400 })
    }

    // Get target wallet info
    let walletNumber: string = ''
    let targetName: string = ''

    if (targetType === 'company') {
      const result = await db.query(`
        SELECT
          COALESCE("walletNumber", walletnumber) as wallet_number,
          legalname as name
        FROM companies
        WHERE id = $1
      `, [targetId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      walletNumber = result.rows[0].wallet_number
      targetName = result.rows[0].name
    } else if (targetType === 'user') {
      const result = await db.query(`
        SELECT
          wallet_number,
          CONCAT(firstname, ' ', lastname) as name
        FROM users
        WHERE id = $1
      `, [targetId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      walletNumber = result.rows[0].wallet_number
      targetName = result.rows[0].name
    } else if (targetType === 'customer') {
      const result = await db.query(`
        SELECT
          wallet_number,
          CONCAT(firstname, ' ', lastname) as name
        FROM customers
        WHERE id = $1
      `, [targetId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Cliente no encontrado'
        }, { status: 404 })
      }

      walletNumber = result.rows[0].wallet_number
      targetName = result.rows[0].name
    } else {
      return NextResponse.json({
        success: false,
        error: 'Tipo de destino inválido. Debe ser: company, user, o customer'
      }, { status: 400 })
    }

    if (!walletNumber) {
      return NextResponse.json({
        success: false,
        error: 'El destino no tiene un wallet configurado'
      }, { status: 400 })
    }

    // Create PaymentIntent with Stripe
    const paymentResult = await createRechargePaymentIntent({
      amount,
      walletNumber,
      targetType,
      targetId,
      targetName,
      description: `Recarga de wallet ${walletNumber} - ${targetName}`,
      metadata: {
        operatorId: payload.userId.toString(),
        operatorEmail: payload.email,
        operatorRole: payload.role,
        companyId: payload.companyId.toString()
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentResult.clientSecret,
        paymentIntentId: paymentResult.paymentIntentId,
        amount: paymentResult.amount,
        fee: paymentResult.fee,
        feePercentage: STRIPE_FEE_PERCENTAGE,
        totalCharged: paymentResult.totalCharged,
        walletNumber,
        targetName,
        targetType,
        targetId
      }
    })

  } catch (error) {
    console.error('Error creating Stripe PaymentIntent:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear intento de pago'
    }, { status: 500 })
  }
}
