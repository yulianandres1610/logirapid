import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface SupplierJWTPayload {
  supplierId: number
  supplierCode: string
  companyId: number
  type: string
}

async function getSupplierPayload(): Promise<SupplierJWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('supplier-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const payload = jwt.verify(token, secret) as SupplierJWTPayload
    if (payload.type !== 'supplier') return null
    return payload
  } catch {
    return null
  }
}

/**
 * GET /api/supplier/dashboard
 * Dashboard del proveedor con estadisticas y saldo
 */
export async function GET() {
  try {
    const payload = await getSupplierPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const supplierId = payload.supplierId

    // Get supplier info
    const supplierResult = await db.query(`
      SELECT id, code, name, email, phone, is_active
      FROM consignment_suppliers
      WHERE id = $1
    `, [supplierId])

    if (supplierResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const supplier = supplierResult.rows[0]

    // Get wallet info
    const walletResult = await db.query(`
      SELECT
        balance_available,
        balance_pending,
        total_earned,
        total_paid,
        total_returned
      FROM consignment_supplier_wallets
      WHERE supplier_id = $1
    `, [supplierId])

    const wallet = walletResult.rows[0] || {
      balance_available: 0,
      balance_pending: 0,
      total_earned: 0,
      total_paid: 0,
      total_returned: 0
    }

    // Get order stats
    const ordersResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders,
        COUNT(*) FILTER (WHERE status IN ('selling', 'paid')) as active_orders,
        COUNT(*) FILTER (WHERE status = 'liquidated') as completed_orders,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_cost), 0) as total_consigned,
        COALESCE(SUM(total_sold), 0) as total_sold
      FROM consignment_orders
      WHERE supplier_id = $1
    `, [supplierId])

    const orderStats = ordersResult.rows[0]

    // Get recent sales (last 30 days)
    const salesResult = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) as sales_30_days
      FROM consignment_wallet_transactions
      WHERE wallet_id = (SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1)
        AND transaction_type = 'sale'
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [supplierId])

    const sales30Days = parseFloat(salesResult.rows[0]?.sales_30_days) || 0

    // Get pending payment requests
    const paymentsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
        COALESCE(SUM(amount_requested) FILTER (WHERE status IN ('pending', 'approved')), 0) as amount_in_process
      FROM consignment_payment_requests
      WHERE supplier_id = $1
    `, [supplierId])

    const paymentStats = paymentsResult.rows[0]

    // Get recent transactions (last 10)
    const transactionsResult = await db.query(`
      SELECT
        t.id,
        t.transaction_type,
        t.amount,
        t.pos_order_number,
        t.notes,
        t.created_at,
        o.order_number
      FROM consignment_wallet_transactions t
      LEFT JOIN consignment_orders o ON o.id = t.order_id
      WHERE t.wallet_id = (SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1)
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [supplierId])

    const recentTransactions = transactionsResult.rows.map(t => ({
      id: t.id,
      type: t.transaction_type,
      amount: parseFloat(t.amount),
      posOrderNumber: t.pos_order_number,
      orderNumber: t.order_number,
      notes: t.notes,
      createdAt: t.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone
        },
        wallet: {
          available: parseFloat(wallet.balance_available),
          pending: parseFloat(wallet.balance_pending),
          totalEarned: parseFloat(wallet.total_earned),
          totalPaid: parseFloat(wallet.total_paid),
          totalReturned: parseFloat(wallet.total_returned)
        },
        orders: {
          pending: parseInt(orderStats.pending_orders),
          received: parseInt(orderStats.received_orders),
          active: parseInt(orderStats.active_orders),
          completed: parseInt(orderStats.completed_orders),
          total: parseInt(orderStats.total_orders),
          totalConsigned: parseFloat(orderStats.total_consigned),
          totalSold: parseFloat(orderStats.total_sold)
        },
        payments: {
          pendingRequests: parseInt(paymentStats.pending_requests),
          approvedRequests: parseInt(paymentStats.approved_requests),
          amountInProcess: parseFloat(paymentStats.amount_in_process)
        },
        sales30Days,
        recentTransactions
      }
    })

  } catch (error) {
    console.error('[Supplier Dashboard] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar dashboard'
    }, { status: 500 })
  }
}
