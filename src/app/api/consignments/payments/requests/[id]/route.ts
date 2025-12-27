import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * GET /api/consignments/payments/requests/[id]
 * Obtener detalle de una solicitud
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    const result = await db.query(`
      SELECT
        r.*,
        s.code as supplier_code,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        w.balance_available,
        w.balance_pending,
        w.total_earned,
        w.total_paid
      FROM consignment_payment_requests r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      WHERE r.id = $1 AND s.company_id = $2
    `, [requestId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Solicitud no encontrada'
      }, { status: 404 })
    }

    const r = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        requestNumber: r.request_number,
        supplier: {
          id: r.supplier_id,
          code: r.supplier_code,
          name: r.supplier_name,
          email: r.supplier_email,
          phone: r.supplier_phone,
          wallet: {
            available: parseFloat(r.balance_available) || 0,
            pending: parseFloat(r.balance_pending) || 0,
            totalEarned: parseFloat(r.total_earned) || 0,
            totalPaid: parseFloat(r.total_paid) || 0
          }
        },
        amountRequested: parseFloat(r.amount_requested),
        amountPaid: parseFloat(r.amount_paid) || 0,
        status: r.status,
        paymentMethod: r.payment_method,
        paymentReference: r.payment_reference,
        notes: r.notes,
        requestedAt: r.requested_at,
        approvedAt: r.approved_at,
        paidAt: r.paid_at
      }
    })

  } catch (error) {
    console.error('[Payment Request GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar solicitud'
    }, { status: 500 })
  }
}

/**
 * PUT /api/consignments/payments/requests/[id]
 * Actualizar estado de solicitud (aprobar, rechazar, pagar)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)
    const body = await request.json()
    const { action, paymentMethod, paymentReference, notes } = body

    // Verify request exists and belongs to company
    const checkResult = await db.query(`
      SELECT r.*, s.company_id
      FROM consignment_payment_requests r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      WHERE r.id = $1 AND s.company_id = $2
    `, [requestId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Solicitud no encontrada'
      }, { status: 404 })
    }

    const currentRequest = checkResult.rows[0]

    // Handle different actions
    switch (action) {
      case 'approve': {
        if (currentRequest.status !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden aprobar solicitudes pendientes'
          }, { status: 400 })
        }

        await db.query(`
          UPDATE consignment_payment_requests
          SET status = 'approved', approved_by = $1, approved_at = NOW()
          WHERE id = $2
        `, [payload.userId, requestId])

        return NextResponse.json({
          success: true,
          message: 'Solicitud aprobada exitosamente'
        })
      }

      case 'reject': {
        if (!['pending', 'approved'].includes(currentRequest.status)) {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden rechazar solicitudes pendientes o aprobadas'
          }, { status: 400 })
        }

        const amountToReturn = parseFloat(currentRequest.amount_requested)

        // Return amount to available balance
        await db.query(`
          UPDATE consignment_supplier_wallets
          SET
            balance_available = balance_available + $1,
            balance_pending = balance_pending - $1,
            updated_at = NOW()
          WHERE supplier_id = $2
        `, [amountToReturn, currentRequest.supplier_id])

        await db.query(`
          UPDATE consignment_payment_requests
          SET status = 'rejected', notes = COALESCE($1, notes)
          WHERE id = $2
        `, [notes, requestId])

        return NextResponse.json({
          success: true,
          message: 'Solicitud rechazada y monto devuelto al saldo disponible'
        })
      }

      case 'pay': {
        if (currentRequest.status !== 'approved') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden pagar solicitudes aprobadas'
          }, { status: 400 })
        }

        if (!paymentMethod) {
          return NextResponse.json({
            success: false,
            error: 'Debe especificar el metodo de pago'
          }, { status: 400 })
        }

        const amountToPay = parseFloat(currentRequest.amount_requested)

        // Update wallet - decrease pending, increase total paid
        await db.query(`
          UPDATE consignment_supplier_wallets
          SET
            balance_pending = balance_pending - $1,
            total_paid = total_paid + $1,
            updated_at = NOW()
          WHERE supplier_id = $2
        `, [amountToPay, currentRequest.supplier_id])

        // Update request
        await db.query(`
          UPDATE consignment_payment_requests
          SET
            status = 'paid',
            amount_paid = $1,
            payment_method = $2,
            payment_reference = $3,
            paid_by = $4,
            paid_at = NOW()
          WHERE id = $5
        `, [amountToPay, paymentMethod, paymentReference || null, payload.userId, requestId])

        // Create wallet transaction
        const walletResult = await db.query(
          'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
          [currentRequest.supplier_id]
        )

        if (walletResult.rows.length > 0) {
          await db.query(`
            INSERT INTO consignment_wallet_transactions (
              wallet_id, transaction_type, amount, notes, created_by
            ) VALUES ($1, 'payment', $2, $3, $4)
          `, [
            walletResult.rows[0].id,
            amountToPay,
            `Pago ${currentRequest.request_number} via ${paymentMethod}${paymentReference ? ` - Ref: ${paymentReference}` : ''}`,
            payload.userId
          ])
        }

        return NextResponse.json({
          success: true,
          message: 'Pago registrado exitosamente'
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Accion no valida'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('[Payment Request PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al procesar solicitud'
    }, { status: 500 })
  }
}
