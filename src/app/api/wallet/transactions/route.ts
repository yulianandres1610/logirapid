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
 * GET /api/wallet/transactions
 * Get wallet transaction history
 *
 * Query params:
 * - type: 'recharge' | 'transfer_out' | 'transfer_in' | 'debit' | 'all'
 * - status: 'pending' | 'completed' | 'rejected' | 'all'
 * - walletNumber: filter by specific wallet
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - page: page number (default: 1)
 * - limit: items per page (default: 25)
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status') || 'all'
    const walletNumber = searchParams.get('walletNumber')
    const search = searchParams.get('search')?.trim()
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const offset = (page - 1) * limit

    let query = `
      SELECT
        wt.id,
        wt.transaction_number,
        wt.type,
        wt.source_type,
        wt.source_company_id,
        wt.source_user_id,
        wt.source_wallet_number,
        wt.target_type,
        wt.target_company_id,
        wt.target_user_id,
        wt.target_customer_id,
        wt.target_wallet_number,
        wt.amount,
        wt.fee,
        wt.net_amount,
        wt.currency,
        wt.payment_method,
        wt.payment_reference,
        wt.status,
        wt.requires_approval,
        wt.description,
        wt.created_by_name,
        wt.created_at,
        wt.completed_at,
        sc.legalname as source_company_name,
        tc.legalname as target_company_name,
        CONCAT(su.firstname, ' ', su.lastname) as source_user_name,
        CONCAT(tu.firstname, ' ', tu.lastname) as target_user_name,
        CONCAT(tcust.firstname, ' ', tcust.lastname) as target_customer_name
      FROM wallet_transactions wt
      LEFT JOIN companies sc ON wt.source_company_id = sc.id
      LEFT JOIN companies tc ON wt.target_company_id = tc.id
      LEFT JOIN users su ON wt.source_user_id = su.id
      LEFT JOIN users tu ON wt.target_user_id = tu.id
      LEFT JOIN customers tcust ON wt.target_customer_id = tcust.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // SUPER_ADMIN sees all, others see only their company's transactions
    if (payload.role !== 'SUPER_ADMIN') {
      query += ` AND (
        wt.source_company_id = $${paramIndex}
        OR wt.target_company_id = $${paramIndex}
      )`
      params.push(payload.companyId)
      paramIndex++
    }

    // Filter by type
    if (type !== 'all') {
      query += ` AND wt.type = $${paramIndex}`
      params.push(type)
      paramIndex++
    }

    // Filter by status
    if (status !== 'all') {
      query += ` AND wt.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Filter by wallet number
    if (walletNumber) {
      query += ` AND (
        wt.source_wallet_number = $${paramIndex}
        OR wt.target_wallet_number = $${paramIndex}
      )`
      params.push(walletNumber)
      paramIndex++
    }

    // Filter by date range
    if (dateFrom) {
      query += ` AND wt.created_at >= $${paramIndex}`
      params.push(new Date(dateFrom))
      paramIndex++
    }

    if (dateTo) {
      query += ` AND wt.created_at <= $${paramIndex}`
      params.push(new Date(dateTo))
      paramIndex++
    }

    // Search filter - searches across multiple fields
    if (search && search.length >= 2) {
      query += ` AND (
        wt.source_wallet_number ILIKE $${paramIndex}
        OR wt.target_wallet_number ILIKE $${paramIndex}
        OR wt.description ILIKE $${paramIndex}
        OR wt.payment_reference ILIKE $${paramIndex}
        OR sc.legalname ILIKE $${paramIndex}
        OR tc.legalname ILIKE $${paramIndex}
        OR CONCAT(su.firstname, ' ', su.lastname) ILIKE $${paramIndex}
        OR CONCAT(tu.firstname, ' ', tu.lastname) ILIKE $${paramIndex}
        OR CAST(wt.id AS TEXT) ILIKE $${paramIndex}
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Get total count - keep JOINs if search is used since it searches across joined tables
    let countQuery = query.replace(
      /SELECT[\s\S]+FROM wallet_transactions wt/,
      'SELECT COUNT(*) as total FROM wallet_transactions wt'
    )
    if (!search) {
      countQuery = countQuery.replace(/LEFT JOIN[\s\S]+WHERE/, 'WHERE')
    }

    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY wt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const typeLabels: { [key: string]: string } = {
      'recharge': 'Recarga',
      'transfer_out': 'Transferencia (Salida)',
      'transfer_in': 'Transferencia (Entrada)',
      'debit': 'Debito',
      'refund': 'Reembolso'
    }

    const methodLabels: { [key: string]: string } = {
      'card_manual': 'Tarjeta Manual',
      'card_terminal': 'Terminal',
      'cash': 'Efectivo',
      'wire': 'Transferencia Bancaria',
      'zelle': 'Zelle',
      'credit': 'Crédito LogiRapid'
    }

    const transactions = result.rows.map((row: any) => {
      // Determine source and target names
      let sourceName = ''
      let targetName = ''

      if (row.source_type === 'company') {
        sourceName = row.source_company_name || 'Empresa'
      } else if (row.source_type === 'user') {
        sourceName = row.source_user_name || 'Usuario'
      } else if (row.source_type === 'external') {
        sourceName = methodLabels[row.payment_method] || 'Externo'
      } else if (row.source_type === 'platform') {
        sourceName = 'Plataforma'
      }

      if (row.target_type === 'company') {
        targetName = row.target_company_name || 'Empresa'
      } else if (row.target_type === 'user') {
        targetName = row.target_user_name || 'Usuario'
      } else if (row.target_type === 'customer') {
        targetName = row.target_customer_name || 'Cliente'
      }

      return {
        id: row.id,
        transactionNumber: row.transaction_number,
        type: row.type,
        typeLabel: typeLabels[row.type] || row.type,
        sourceType: row.source_type,
        sourceName,
        sourceWalletNumber: row.source_wallet_number,
        targetType: row.target_type,
        targetName,
        targetWalletNumber: row.target_wallet_number,
        amount: parseFloat(row.amount),
        amountFormatted: `$${parseFloat(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        fee: parseFloat(row.fee || '0'),
        netAmount: parseFloat(row.net_amount),
        currency: row.currency,
        paymentMethod: row.payment_method,
        paymentMethodLabel: methodLabels[row.payment_method] || row.payment_method,
        paymentReference: row.payment_reference,
        status: row.status,
        requiresApproval: row.requires_approval,
        description: row.description,
        createdBy: row.created_by_name,
        createdAt: row.created_at,
        completedAt: row.completed_at
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + transactions.length < total
        }
      }
    })

  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener transacciones'
    }, { status: 500 })
  }
}
