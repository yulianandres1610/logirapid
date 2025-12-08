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
 * PUT /api/wallet/recharge-requests/[id]
 * Approve or reject a recharge request (SUPER_ADMIN only)
 *
 * Body:
 * {
 *   action: 'approve' | 'reject',
 *   rejectionReason?: string (required if rejecting)
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de solicitud invalido'
      }, { status: 400 })
    }

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

    // Only SUPER_ADMIN can approve/reject
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede aprobar/rechazar solicitudes'
      }, { status: 403 })
    }

    const body = await request.json()
    const { action, rejectionReason } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'action debe ser "approve" o "reject"'
      }, { status: 400 })
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json({
        success: false,
        error: 'rejectionReason es requerido para rechazar'
      }, { status: 400 })
    }

    // Get the request
    const reqResult = await db.query(`
      SELECT
        wrr.*,
        c."walletBalance"::numeric as company_balance,
        c.phone as company_phone,
        c.legalname as company_name,
        u.wallet_balance as user_balance,
        u.phone as user_phone,
        CONCAT(u.firstname, ' ', u.lastname) as user_name
      FROM wallet_recharge_requests wrr
      LEFT JOIN companies c ON wrr.company_id = c.id
      LEFT JOIN users u ON wrr.user_id = u.id
      WHERE wrr.id = $1
    `, [requestId])

    if (reqResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Solicitud no encontrada'
      }, { status: 404 })
    }

    const rechargeRequest = reqResult.rows[0]

    if (rechargeRequest.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Esta solicitud ya fue ${rechargeRequest.status === 'approved' ? 'aprobada' : 'rechazada'}`
      }, { status: 400 })
    }

    if (action === 'reject') {
      // Reject the request
      await db.query(`
        UPDATE wallet_recharge_requests
        SET
          status = 'rejected',
          processed_by = $1,
          processed_by_name = $2,
          processed_at = NOW(),
          rejection_reason = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [payload.userId, payload.email, rejectionReason, requestId])

      return NextResponse.json({
        success: true,
        message: 'Solicitud rechazada',
        data: {
          requestId,
          status: 'rejected',
          rejectionReason
        }
      })
    }

    // Approve the request - process the recharge
    const amount = parseFloat(rechargeRequest.amount)
    let newBalance: number

    // Calculate new balance first
    if (rechargeRequest.wallet_type === 'company' && rechargeRequest.company_id) {
      const currentBalance = parseFloat(rechargeRequest.company_balance || '0')
      newBalance = currentBalance + amount
    } else if (rechargeRequest.wallet_type === 'user' && rechargeRequest.user_id) {
      const currentBalance = parseFloat(rechargeRequest.user_balance || '0')
      newBalance = currentBalance + amount
    } else {
      return NextResponse.json({
        success: false,
        error: 'Tipo de wallet invalido'
      }, { status: 400 })
    }

    const transactionResult = await db.transaction(async (client) => {
      // Update wallet balance
      if (rechargeRequest.wallet_type === 'company' && rechargeRequest.company_id) {
        await client.query(`
          UPDATE companies
          SET "walletBalance" = ("walletBalance"::numeric + $1)::text
          WHERE id = $2
        `, [amount, rechargeRequest.company_id])
      } else if (rechargeRequest.wallet_type === 'user' && rechargeRequest.user_id) {
        await client.query(`
          UPDATE users
          SET wallet_balance = wallet_balance + $1
          WHERE id = $2
        `, [amount, rechargeRequest.user_id])
      }

      // Create transaction record
      const txResult = await client.query(`
        INSERT INTO wallet_transactions (
          type,
          source_type,
          target_type,
          target_company_id,
          target_user_id,
          target_wallet_number,
          amount,
          fee,
          net_amount,
          currency,
          payment_method,
          payment_reference,
          status,
          requires_approval,
          approved_by,
          approved_at,
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
          0,
          $5,
          'USD',
          $6,
          $7,
          'completed',
          true,
          $8,
          NOW(),
          $9,
          $10,
          $11,
          NOW()
        ) RETURNING id
      `, [
        rechargeRequest.wallet_type,
        rechargeRequest.company_id || null,
        rechargeRequest.user_id || null,
        rechargeRequest.wallet_number,
        amount,
        rechargeRequest.payment_method,
        rechargeRequest.payment_reference,
        payload.userId,
        `Recarga aprobada - ${rechargeRequest.payment_method}`,
        rechargeRequest.requested_by,
        rechargeRequest.requested_by_name
      ])

      // Update request status
      await client.query(`
        UPDATE wallet_recharge_requests
        SET
          status = 'approved',
          processed_by = $1,
          processed_by_name = $2,
          processed_at = NOW(),
          transaction_id = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [payload.userId, payload.email, txResult.rows[0].id, requestId])

      return txResult.rows[0].id
    })

    // Send SMS notification after successful approval
    const targetPhone = rechargeRequest.wallet_type === 'company'
      ? rechargeRequest.company_phone
      : rechargeRequest.user_phone
    const targetName = rechargeRequest.wallet_type === 'company'
      ? rechargeRequest.company_name
      : rechargeRequest.user_name
    const txnRef = `RCH-${transactionResult}`

    if (targetPhone) {
      sendWalletNotificationSMS(
        targetPhone,
        'recharge',
        targetName || 'Cliente',
        amount,
        newBalance!,
        { paymentMethod: rechargeRequest.payment_method || 'aprobacion', transactionNumber: txnRef }
      ).then(result => {
        if (result.success) {
          console.log('[Recharge Approval] SMS notification sent:', result.messageId)
        } else {
          console.log('[Recharge Approval] SMS notification failed:', result.error)
        }
      }).catch(err => {
        console.error('[Recharge Approval] SMS notification error:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud aprobada y recarga procesada',
      data: {
        requestId,
        transactionId: transactionResult,
        status: 'approved',
        amount,
        newBalance: newBalance!,
        newBalanceFormatted: `$${newBalance!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    })

  } catch (error) {
    console.error('Error processing recharge request:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar solicitud'
    }, { status: 500 })
  }
}
