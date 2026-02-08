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
 * POST /api/consignments/payments/direct
 * Crear un pago directo a un proveedor (sin solicitud previa)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId, amount, paymentMethod, paymentReference, notes } = body

    // Validate required fields
    if (!supplierId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un proveedor'
      }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a cero'
      }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar el método de pago'
      }, { status: 400 })
    }

    // Verify supplier exists and belongs to company
    const supplierResult = await db.query(`
      SELECT s.id, s.name, s.code, w.balance_available, w.id as wallet_id
      FROM consignment_suppliers s
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      WHERE s.id = $1 AND s.company_id = $2
    `, [supplierId, payload.companyId])

    if (supplierResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const supplier = supplierResult.rows[0]
    const balanceAvailable = parseFloat(supplier.balance_available) || 0

    // Validate amount doesn't exceed available balance
    if (amount > balanceAvailable) {
      return NextResponse.json({
        success: false,
        error: `El monto ($${amount.toFixed(2)}) excede el saldo disponible ($${balanceAvailable.toFixed(2)})`
      }, { status: 400 })
    }

    // Generate payment number: PAY-YYYY-XXXX
    const year = new Date().getFullYear()
    const numberResult = await db.query(`
      SELECT request_number FROM consignment_payment_requests
      WHERE request_number LIKE $1
      ORDER BY id DESC
      LIMIT 1
    `, [`PAY-${year}-%`])

    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const lastNumber = numberResult.rows[0].request_number
      const match = lastNumber.match(/PAY-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const requestNumber = `PAY-${year}-${String(nextNumber).padStart(4, '0')}`

    // Create payment request with status='paid' directly
    const insertResult = await db.query(`
      INSERT INTO consignment_payment_requests (
        request_number,
        supplier_id,
        company_id,
        amount_requested,
        amount_paid,
        status,
        payment_method,
        payment_reference,
        notes,
        requested_at,
        approved_by,
        approved_at,
        paid_by,
        paid_at
      ) VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, $8, NOW(), $9, NOW(), $9, NOW())
      RETURNING id
    `, [
      requestNumber,
      supplierId,
      payload.companyId,
      amount,
      amount,
      paymentMethod,
      paymentReference || null,
      notes || `Pago directo emitido por administrador`,
      payload.userId
    ])

    const paymentId = insertResult.rows[0].id

    // Update wallet - decrease available, increase total paid
    await db.query(`
      UPDATE consignment_supplier_wallets
      SET
        balance_available = balance_available - $1,
        total_paid = total_paid + $1,
        updated_at = NOW()
      WHERE supplier_id = $2
    `, [amount, supplierId])

    // Create wallet transaction
    if (supplier.wallet_id) {
      await db.query(`
        INSERT INTO consignment_wallet_transactions (
          wallet_id, transaction_type, amount, notes, created_by
        ) VALUES ($1, 'payment', $2, $3, $4)
      `, [
        supplier.wallet_id,
        amount,
        `Pago directo ${requestNumber} via ${paymentMethod}${paymentReference ? ` - Ref: ${paymentReference}` : ''}`,
        payload.userId
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Pago emitido exitosamente',
      data: {
        id: paymentId,
        requestNumber,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          code: supplier.code
        },
        amount,
        paymentMethod,
        paymentReference
      }
    })

  } catch (error) {
    console.error('[Direct Payment POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al procesar el pago'
    }, { status: 500 })
  }
}
