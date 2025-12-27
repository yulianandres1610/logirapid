import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  supplierId?: number
  supplierCode?: string
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

async function getSupplierId(payload: JWTPayload): Promise<number | null> {
  if (payload.supplierId) return payload.supplierId

  const result = await db.query(`
    SELECT id FROM consignment_suppliers
    WHERE user_id = $1 AND is_active = true
    LIMIT 1
  `, [payload.userId])

  return result.rows[0]?.id || null
}

/**
 * GET /api/supplier/payments/request
 * Lista solicitudes de pago del proveedor
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const supplierId = await getSupplierId(payload)
    if (!supplierId) {
      return NextResponse.json({
        success: false,
        error: 'No es un proveedor de consignacion'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let statusFilter = ''
    if (status && status !== 'all') {
      statusFilter = `AND status = '${status}'`
    }

    const result = await db.query(`
      SELECT *
      FROM consignment_payment_requests
      WHERE supplier_id = $1 ${statusFilter}
      ORDER BY requested_at DESC
    `, [supplierId])

    const requests = result.rows.map(r => ({
      id: r.id,
      requestNumber: r.request_number,
      amountRequested: parseFloat(r.amount_requested),
      amountPaid: parseFloat(r.amount_paid) || 0,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentReference: r.payment_reference,
      notes: r.notes,
      requestedAt: r.requested_at,
      approvedAt: r.approved_at,
      paidAt: r.paid_at
    }))

    return NextResponse.json({
      success: true,
      data: { requests }
    })

  } catch (error) {
    console.error('[Supplier Payment Requests GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar solicitudes'
    }, { status: 500 })
  }
}

/**
 * POST /api/supplier/payments/request
 * Crear solicitud de pago/cobro
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const supplierId = await getSupplierId(payload)
    if (!supplierId) {
      return NextResponse.json({
        success: false,
        error: 'No es un proveedor de consignacion'
      }, { status: 403 })
    }

    const { amount, notes } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Monto invalido'
      }, { status: 400 })
    }

    // Check available balance
    const walletResult = await db.query(`
      SELECT balance_available
      FROM consignment_supplier_wallets
      WHERE supplier_id = $1
    `, [supplierId])

    if (walletResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Wallet no encontrado'
      }, { status: 404 })
    }

    const availableBalance = parseFloat(walletResult.rows[0].balance_available)

    if (amount > availableBalance) {
      return NextResponse.json({
        success: false,
        error: `Monto excede el saldo disponible ($${availableBalance.toFixed(2)})`
      }, { status: 400 })
    }

    // Check for pending requests
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_payment_requests
      WHERE supplier_id = $1 AND status IN ('pending', 'approved')
    `, [supplierId])

    if (parseInt(pendingResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya tiene una solicitud de pago pendiente'
      }, { status: 400 })
    }

    // Get company_id from supplier
    const supplierResult = await db.query(`
      SELECT company_id FROM consignment_suppliers WHERE id = $1
    `, [supplierId])
    const companyId = supplierResult.rows[0].company_id

    // Generate request number
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_payment_requests
      WHERE EXTRACT(YEAR FROM requested_at) = $1
    `, [year])
    const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(4, '0')
    const requestNumber = `PAY-${year}-${seq}`

    // Create request
    const insertResult = await db.query(`
      INSERT INTO consignment_payment_requests (
        request_number, supplier_id, company_id, amount_requested, status, notes
      ) VALUES ($1, $2, $3, $4, 'pending', $5)
      RETURNING id, request_number, amount_requested, status, requested_at
    `, [requestNumber, supplierId, companyId, amount, notes || null])

    const newRequest = insertResult.rows[0]

    // Update wallet - move amount from available to pending
    await db.query(`
      UPDATE consignment_supplier_wallets
      SET
        balance_available = balance_available - $1,
        balance_pending = balance_pending + $1,
        updated_at = NOW()
      WHERE supplier_id = $2
    `, [amount, supplierId])

    return NextResponse.json({
      success: true,
      message: 'Solicitud de pago creada exitosamente',
      data: {
        id: newRequest.id,
        requestNumber: newRequest.request_number,
        amountRequested: parseFloat(newRequest.amount_requested),
        status: newRequest.status,
        requestedAt: newRequest.requested_at
      }
    })

  } catch (error) {
    console.error('[Supplier Payment Request POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear solicitud'
    }, { status: 500 })
  }
}
