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
 * GET /api/wallet/cashout/history
 *
 * Get cashout (withdrawal) history
 *
 * Query params:
 * - entityType: 'company' | 'user' | 'all' (default: 'all')
 * - entityId: number (optional, filters by specific entity)
 * - status: 'pending' | 'processing' | 'paid' | 'failed' | 'all' (default: 'all')
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - page: page number (default: 1)
 * - limit: items per page (default: 25, max: 100)
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') || 'all'
    const entityId = searchParams.get('entityId')
    const status = searchParams.get('status') || 'all'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const offset = (page - 1) * limit

    // Build query
    let query = `
      SELECT
        wp.id,
        wp.entity_type,
        wp.company_id,
        wp.user_id,
        wp.wallet_number,
        wp.amount,
        wp.fee,
        wp.net_amount,
        wp.currency,
        wp.stripe_account_id,
        wp.stripe_transfer_id,
        wp.stripe_payout_id,
        wp.status,
        wp.failure_code,
        wp.failure_message,
        wp.bank_name,
        wp.bank_last4,
        wp.requested_by,
        wp.requested_by_name,
        wp.created_at,
        wp.processed_at,
        wp.paid_at,
        wp.transaction_id,
        c.legalname as company_name,
        CONCAT(u.firstname, ' ', u.lastname) as user_name,
        wt.transaction_number
      FROM wallet_payouts wp
      LEFT JOIN companies c ON wp.company_id = c.id
      LEFT JOIN users u ON wp.user_id = u.id
      LEFT JOIN wallet_transactions wt ON wp.transaction_id = wt.id
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    // Apply entity type filter
    if (entityType !== 'all') {
      query += ` AND wp.entity_type = $${paramIndex}`
      params.push(entityType)
      paramIndex++
    }

    // Apply entity ID filter
    if (entityId) {
      if (entityType === 'company' || entityType === 'all') {
        query += ` AND (wp.company_id = $${paramIndex} OR wp.user_id = $${paramIndex})`
      } else if (entityType === 'user') {
        query += ` AND wp.user_id = $${paramIndex}`
      }
      params.push(parseInt(entityId))
      paramIndex++
    }

    // Apply permission filters (non-SUPER_ADMIN can only see their own)
    if (payload.role !== 'SUPER_ADMIN') {
      if (payload.role === 'DRIVER') {
        // Drivers can only see their own payouts
        query += ` AND wp.user_id = $${paramIndex}`
        params.push(payload.userId)
        paramIndex++
      } else {
        // Other roles can see their company's payouts
        query += ` AND wp.company_id = $${paramIndex}`
        params.push(payload.companyId)
        paramIndex++
      }
    }

    // Apply status filter
    if (status !== 'all') {
      query += ` AND wp.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Apply date range filters
    if (dateFrom) {
      query += ` AND wp.created_at >= $${paramIndex}`
      params.push(new Date(dateFrom))
      paramIndex++
    }

    if (dateTo) {
      query += ` AND wp.created_at <= $${paramIndex}`
      params.push(new Date(dateTo))
      paramIndex++
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]+FROM wallet_payouts wp/,
      'SELECT COUNT(*) as total FROM wallet_payouts wp'
    )
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY wp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    // Execute query
    const result = await db.query(query, params)

    // Status labels
    const statusLabels: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'paid': 'Pagado',
      'failed': 'Fallido'
    }

    // Format payouts
    const payouts = result.rows.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_type === 'company' ? row.company_id : row.user_id,
      entityName: row.entity_type === 'company' ? row.company_name : row.user_name,
      walletNumber: row.wallet_number,
      amount: parseFloat(row.amount),
      amountFormatted: `$${parseFloat(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      fee: parseFloat(row.fee || '0'),
      netAmount: parseFloat(row.net_amount),
      currency: row.currency,
      status: row.status,
      statusLabel: statusLabels[row.status] || row.status,
      stripeTransferId: row.stripe_transfer_id,
      stripePayoutId: row.stripe_payout_id,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      bankName: row.bank_name,
      bankLast4: row.bank_last4,
      requestedBy: row.requested_by_name,
      transactionNumber: row.transaction_number,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      paidAt: row.paid_at
    }))

    // Calculate summary stats
    const summaryQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed
      FROM wallet_payouts wp
      WHERE 1=1
      ${payload.role !== 'SUPER_ADMIN' ? (
        payload.role === 'DRIVER'
          ? ` AND wp.user_id = ${payload.userId}`
          : ` AND wp.company_id = ${payload.companyId}`
      ) : ''}
    `
    const summaryResult = await db.query(summaryQuery)
    const summary = summaryResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        payouts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + payouts.length < total
        },
        summary: {
          totalCount: parseInt(summary?.total_count || '0'),
          totalPaid: parseFloat(summary?.total_paid || '0'),
          totalPending: parseFloat(summary?.total_pending || '0'),
          totalFailed: parseFloat(summary?.total_failed || '0')
        }
      }
    })

  } catch (error) {
    console.error('Error fetching cashout history:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial de retiros'
    }, { status: 500 })
  }
}
