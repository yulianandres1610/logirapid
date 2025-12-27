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
 * GET /api/consignments/payments/requests
 * Lista solicitudes de pago para la empresa
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let statusFilter = ''
    if (status !== 'all') {
      statusFilter = `AND r.status = '${status}'`
    }

    // Get requests for suppliers belonging to this company
    const result = await db.query(`
      SELECT
        r.*,
        s.code as supplier_code,
        s.name as supplier_name,
        w.balance_available as supplier_balance
      FROM consignment_payment_requests r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      WHERE s.company_id = $1 ${statusFilter}
      ORDER BY
        CASE r.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
        r.requested_at DESC
      LIMIT $2 OFFSET $3
    `, [payload.companyId, limit, offset])

    // Get count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM consignment_payment_requests r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      WHERE s.company_id = $1 ${statusFilter}
    `, [payload.companyId])

    const total = parseInt(countResult.rows[0].total)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE r.status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE r.status = 'paid') as paid_count,
        COALESCE(SUM(r.amount_requested) FILTER (WHERE r.status = 'pending'), 0) as pending_amount,
        COALESCE(SUM(r.amount_requested) FILTER (WHERE r.status = 'approved'), 0) as approved_amount,
        COALESCE(SUM(r.amount_paid) FILTER (WHERE r.status = 'paid'), 0) as paid_amount
      FROM consignment_payment_requests r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      WHERE s.company_id = $1
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    const requests = result.rows.map(r => ({
      id: r.id,
      requestNumber: r.request_number,
      supplier: {
        id: r.supplier_id,
        code: r.supplier_code,
        name: r.supplier_name,
        balance: parseFloat(r.supplier_balance) || 0
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
    }))

    return NextResponse.json({
      success: true,
      data: {
        requests,
        stats: {
          pending: { count: parseInt(stats.pending_count), amount: parseFloat(stats.pending_amount) },
          approved: { count: parseInt(stats.approved_count), amount: parseFloat(stats.approved_amount) },
          paid: { count: parseInt(stats.paid_count), amount: parseFloat(stats.paid_amount) }
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Payment Requests GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar solicitudes'
    }, { status: 500 })
  }
}
