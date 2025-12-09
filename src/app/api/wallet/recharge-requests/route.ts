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
 * GET /api/wallet/recharge-requests
 * Get pending recharge requests (SUPER_ADMIN only)
 *
 * Query params:
 * - status: 'pending' | 'approved' | 'rejected' | 'all'
 * - page: page number
 * - limit: items per page
 */
export async function GET(request: NextRequest) {
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

    // SUPER_ADMIN can view all requests, ADMIN/MANAGER can view their own company's requests
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver solicitudes de recarga'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const offset = (page - 1) * limit

    let query = `
      SELECT
        wrr.id,
        wrr.company_id,
        wrr.user_id,
        wrr.wallet_number,
        wrr.wallet_type,
        wrr.amount,
        wrr.currency,
        wrr.payment_method,
        wrr.payment_reference,
        wrr.payment_proof_url,
        wrr.status,
        wrr.processed_by,
        wrr.processed_by_name,
        wrr.processed_at,
        wrr.rejection_reason,
        wrr.requested_by_name,
        wrr.requested_by_email,
        wrr.created_at,
        c.legalname as company_name,
        CONCAT(u.firstname, ' ', u.lastname) as user_name
      FROM wallet_recharge_requests wrr
      LEFT JOIN companies c ON wrr.company_id = c.id
      LEFT JOIN users u ON wrr.user_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // ADMIN/MANAGER can only see their own company's requests
    if (payload.role !== 'SUPER_ADMIN') {
      query += ` AND wrr.company_id = $${paramIndex}`
      params.push(payload.companyId)
      paramIndex++
    }

    // Filter by status
    if (status !== 'all') {
      query += ` AND wrr.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]+FROM wallet_recharge_requests wrr/,
      'SELECT COUNT(*) as total FROM wallet_recharge_requests wrr'
    ).replace(/LEFT JOIN[\s\S]+WHERE/, 'WHERE')

    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY wrr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const methodLabels: { [key: string]: string } = {
      'card_manual': 'Tarjeta Manual',
      'card_stripe': 'Tarjeta',
      'card_terminal': 'Terminal',
      'cash': 'Efectivo',
      'wire': 'Transferencia Bancaria',
      'zelle': 'Zelle'
    }

    const requests = result.rows.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      walletNumber: row.wallet_number,
      walletType: row.wallet_type,
      walletName: row.wallet_type === 'company' ? row.company_name : row.user_name,
      amount: parseFloat(row.amount),
      amountFormatted: `$${parseFloat(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentMethodLabel: methodLabels[row.payment_method] || row.payment_method,
      paymentReference: row.payment_reference,
      paymentProofUrl: row.payment_proof_url,
      status: row.status,
      processedBy: row.processed_by_name,
      processedAt: row.processed_at,
      rejectionReason: row.rejection_reason,
      requestedBy: row.requested_by_name,
      requestedByEmail: row.requested_by_email,
      createdAt: row.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + requests.length < total
        }
      }
    })

  } catch (error) {
    console.error('Error fetching recharge requests:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener solicitudes'
    }, { status: 500 })
  }
}

/**
 * POST /api/wallet/recharge-requests
 * Create a new recharge request (for ADMIN users)
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
    const { amount, paymentMethod, paymentReference, paymentProofUrl } = body

    if (!amount || !paymentMethod) {
      return NextResponse.json({
        success: false,
        error: 'amount y paymentMethod son requeridos'
      }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get company wallet info
    const companyResult = await db.query(`
      SELECT id, legalname, walletnumber
      FROM companies
      WHERE id = $1
    `, [payload.companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // Create request
    const result = await db.query(`
      INSERT INTO wallet_recharge_requests (
        company_id,
        wallet_number,
        wallet_type,
        amount,
        currency,
        payment_method,
        payment_reference,
        payment_proof_url,
        status,
        requested_by,
        requested_by_name,
        requested_by_email
      ) VALUES (
        $1, $2, 'company', $3, 'USD', $4, $5, $6, 'pending', $7, $8, $9
      ) RETURNING id
    `, [
      payload.companyId,
      company.walletnumber,
      amount,
      paymentMethod,
      paymentReference || null,
      paymentProofUrl || null,
      payload.userId,
      payload.email,
      payload.email
    ])

    return NextResponse.json({
      success: true,
      message: 'Solicitud de recarga creada. Pendiente de aprobacion.',
      data: {
        requestId: result.rows[0].id,
        companyName: company.legalname,
        walletNumber: company.walletnumber,
        amount,
        paymentMethod,
        status: 'pending'
      }
    })

  } catch (error) {
    console.error('Error creating recharge request:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear solicitud'
    }, { status: 500 })
  }
}
