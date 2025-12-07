import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import {
  cancelTerminalCheckout,
  getPlatformCredentials,
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
 * POST /api/wallet/recharge/terminal/[checkoutId]/cancel
 * Cancel a pending terminal checkout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  try {
    const { checkoutId } = await params

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

    // Find transaction by checkout ID
    const txResult = await db.query(`
      SELECT
        wt.id,
        wt.transaction_number,
        wt.status,
        wt.terminal_id,
        wt.metadata,
        pt.company_id as terminal_company_id
      FROM wallet_transactions wt
      LEFT JOIN payment_terminals pt ON wt.terminal_id = pt.id
      WHERE wt.metadata->>'checkoutId' = $1
    `, [checkoutId])

    if (txResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Transaccion no encontrada'
      }, { status: 404 })
    }

    const tx = txResult.rows[0]

    // Check if transaction can be cancelled
    if (tx.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'No se puede cancelar una transaccion completada'
      }, { status: 400 })
    }

    if (tx.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'Esta transaccion ya fue cancelada'
      }, { status: 400 })
    }

    // Get Square credentials
    let credentials: SquareCredentials | null = null

    if (tx.terminal_company_id === null) {
      credentials = getPlatformCredentials()
    } else {
      const settingsResult = await db.query(`
        SELECT square_access_token, square_location_id, square_environment
        FROM company_payment_settings
        WHERE company_id = $1
      `, [tx.terminal_company_id])

      const settings = settingsResult.rows[0]
      if (settings) {
        credentials = {
          accessToken: settings.square_access_token,
          locationId: settings.square_location_id,
          environment: settings.square_environment || 'sandbox'
        }
      }
    }

    if (!credentials) {
      return NextResponse.json({
        success: false,
        error: 'No se pudieron obtener credenciales de Square'
      }, { status: 400 })
    }

    // Cancel the checkout in Square
    const cancelResult = await cancelTerminalCheckout(credentials, checkoutId)

    // Update transaction status regardless of Square result
    // (it might already be cancelled on Square's side)
    await db.query(`
      UPDATE wallet_transactions
      SET
        status = 'cancelled',
        metadata = metadata || $1
      WHERE id = $2
    `, [JSON.stringify({
      cancelledAt: new Date().toISOString(),
      cancelledBy: payload.email,
      squareCancelResult: cancelResult.success ? 'success' : cancelResult.error
    }), tx.id])

    console.log('[Terminal Cancel] Cancelled transaction:', tx.transaction_number)

    return NextResponse.json({
      success: true,
      message: 'Pago cancelado exitosamente',
      data: {
        transactionId: tx.id,
        transactionNumber: tx.transaction_number,
        status: 'cancelled'
      }
    })

  } catch (error) {
    console.error('Error cancelling terminal checkout:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar pago'
    }, { status: 500 })
  }
}
