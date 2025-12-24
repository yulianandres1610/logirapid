import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/wallet/transactions
 * Get wallet transactions history
 *
 * Query params:
 * - walletId: Specific wallet ID
 * - partnerId: Filter by partner company
 * - type: Filter by transaction type (sale, return, payment_request, payment_completed)
 * - limit: Number of transactions (default 50)
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
    const walletId = searchParams.get('walletId')
    const partnerId = searchParams.get('partnerId')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query with filters
    let whereConditions = [`(cw.provider_company_id = $1 OR cw.receiver_company_id = $1)`]
    let params: (string | number)[] = [currentCompanyId]
    let paramIndex = 2

    if (walletId) {
      whereConditions.push(`cwt.wallet_id = $${paramIndex}`)
      params.push(walletId)
      paramIndex++
    }

    if (partnerId) {
      whereConditions.push(`(cw.provider_company_id = $${paramIndex} OR cw.receiver_company_id = $${paramIndex})`)
      params.push(partnerId)
      paramIndex++
    }

    if (type) {
      whereConditions.push(`cwt.transaction_type = $${paramIndex}`)
      params.push(type)
      paramIndex++
    }

    // Get transactions
    const transactionsQuery = `
      SELECT
        cwt.*,
        cw.provider_company_id,
        cw.receiver_company_id,
        prov.name as provider_name,
        recv.name as receiver_name,
        co.order_number,
        u.name as created_by_name
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      LEFT JOIN companies prov ON prov.id = cw.provider_company_id
      LEFT JOIN companies recv ON recv.id = cw.receiver_company_id
      LEFT JOIN consignment_orders co ON co.id = cwt.consignment_order_id
      LEFT JOIN users u ON u.id = cwt.created_by
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY cwt.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const transactions = await db.query(transactionsQuery, params)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE ${whereConditions.join(' AND ')}
    `
    const countResult = await db.query(countQuery, params.slice(0, -2))
    const total = parseInt(countResult.rows[0]?.total || '0')

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.rows.map(t => ({
          id: t.id,
          walletId: t.wallet_id,
          type: t.transaction_type,
          amount: parseFloat(t.amount) || 0,
          balanceAfter: parseFloat(t.balance_after) || 0,
          provider: {
            id: t.provider_company_id,
            name: t.provider_name
          },
          receiver: {
            id: t.receiver_company_id,
            name: t.receiver_name
          },
          orderNumber: t.order_number,
          notes: t.notes,
          createdBy: t.created_by_name,
          createdAt: t.created_at
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('[Wallet Transactions] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener transacciones'
    }, { status: 500 })
  }
}
