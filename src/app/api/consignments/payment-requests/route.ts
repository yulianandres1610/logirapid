import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/payment-requests
 * Get payment requests (as provider or receiver)
 *
 * Query params:
 * - role: 'provider' (I requested) | 'receiver' (I need to pay)
 * - status: 'pending' | 'partial' | 'completed' | 'cancelled'
 * - limit: Number of requests (default 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'provider'
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let whereConditions: string[] = []
    let params: (string | number)[] = []
    let paramIndex = 1

    if (role === 'provider') {
      whereConditions.push(`pr.provider_company_id = $${paramIndex}`)
    } else {
      whereConditions.push(`pr.receiver_company_id = $${paramIndex}`)
    }
    params.push(currentCompanyId)
    paramIndex++

    if (status) {
      whereConditions.push(`pr.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    const query = `
      SELECT
        pr.*,
        prov.name as provider_name,
        prov.phone as provider_phone,
        prov.logo_url as provider_logo,
        recv.name as receiver_name,
        recv.phone as receiver_phone,
        recv.logo_url as receiver_logo,
        req_user.name as requested_by_name,
        pay_user.name as paid_by_name,
        cw.balance as current_wallet_balance
      FROM consignment_payment_requests pr
      LEFT JOIN companies prov ON prov.id = pr.provider_company_id
      LEFT JOIN companies recv ON recv.id = pr.receiver_company_id
      LEFT JOIN users req_user ON req_user.id = pr.requested_by
      LEFT JOIN users pay_user ON pay_user.id = pr.paid_by
      LEFT JOIN consignment_wallets cw ON cw.id = pr.wallet_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY pr.requested_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const requests = await db.query(query, params)

    // Get counts by status
    const countQuery = `
      SELECT status, COUNT(*) as count
      FROM consignment_payment_requests
      WHERE ${role === 'provider' ? 'provider_company_id' : 'receiver_company_id'} = $1
      GROUP BY status
    `
    const countResult = await db.query(countQuery, [currentCompanyId])
    const statusCounts: Record<string, number> = {}
    for (const row of countResult.rows) {
      statusCounts[row.status] = parseInt(row.count)
    }

    // Get total pending amount
    const pendingQuery = `
      SELECT COALESCE(SUM(amount_requested - amount_paid), 0) as pending_total
      FROM consignment_payment_requests
      WHERE ${role === 'provider' ? 'provider_company_id' : 'receiver_company_id'} = $1
        AND status IN ('pending', 'partial')
    `
    const pendingResult = await db.query(pendingQuery, [currentCompanyId])
    const pendingTotal = parseFloat(pendingResult.rows[0]?.pending_total || '0')

    return NextResponse.json({
      success: true,
      data: {
        requests: requests.rows.map(pr => ({
          id: pr.id,
          requestNumber: pr.request_number,
          walletId: pr.wallet_id,
          provider: {
            id: pr.provider_company_id,
            name: pr.provider_name,
            phone: pr.provider_phone,
            logoUrl: pr.provider_logo
          },
          receiver: {
            id: pr.receiver_company_id,
            name: pr.receiver_name,
            phone: pr.receiver_phone,
            logoUrl: pr.receiver_logo
          },
          amountRequested: parseFloat(pr.amount_requested) || 0,
          amountPaid: parseFloat(pr.amount_paid) || 0,
          amountPending: (parseFloat(pr.amount_requested) || 0) - (parseFloat(pr.amount_paid) || 0),
          status: pr.status,
          paymentMethod: pr.payment_method,
          paymentReference: pr.payment_reference,
          currentWalletBalance: parseFloat(pr.current_wallet_balance) || 0,
          requestedBy: pr.requested_by_name,
          paidBy: pr.paid_by_name,
          requestedAt: pr.requested_at,
          paidAt: pr.paid_at,
          notes: pr.notes
        })),
        summary: {
          pendingCount: statusCounts['pending'] || 0,
          partialCount: statusCounts['partial'] || 0,
          completedCount: statusCounts['completed'] || 0,
          pendingTotal,
          statusCounts
        },
        pagination: {
          limit,
          offset,
          hasMore: requests.rows.length === limit
        }
      }
    })

  } catch (error) {
    console.error('[Payment Requests] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener solicitudes de pago'
    }, { status: 500 })
  }
}
