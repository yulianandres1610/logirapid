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

    const supplierCode = payload.supplierCode
    const consignmentSupplierId = payload.supplierId

    // Get supplier info from consignment_suppliers using ID (from token)
    const supplierResult = await db.query(`
      SELECT id, code, name, email, phone, is_active
      FROM consignment_suppliers
      WHERE id = $1
    `, [consignmentSupplierId])

    if (supplierResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const supplier = supplierResult.rows[0]
    const actualSupplierCode = supplier.code

    // Get market_suppliers.id for orders queries (orders use market_suppliers.id, not consignment_suppliers.id)
    // Try with code from consignment_suppliers first
    let marketSupplierResult = await db.query(`
      SELECT id, supplier_code, name FROM market_suppliers
      WHERE supplier_code = $1 AND company_id = $2
    `, [actualSupplierCode, payload.companyId])

    // If not found, try to find by exact name
    if (marketSupplierResult.rows.length === 0) {
      marketSupplierResult = await db.query(`
        SELECT id, supplier_code, name FROM market_suppliers
        WHERE LOWER(name) = LOWER($1) AND company_id = $2
      `, [supplier.name, payload.companyId])
    }

    // If still not found, try partial name match (first word)
    if (marketSupplierResult.rows.length === 0) {
      const firstWord = supplier.name.split(' ')[0]
      marketSupplierResult = await db.query(`
        SELECT id, supplier_code, name FROM market_suppliers
        WHERE LOWER(name) LIKE LOWER($1) AND company_id = $2
        LIMIT 1
      `, [`${firstWord}%`, payload.companyId])
    }

    // If still not found, try to find ANY supplier in this company for debugging
    let availableSuppliers: string[] = []
    if (marketSupplierResult.rows.length === 0) {
      const allSuppliers = await db.query(`
        SELECT supplier_code, name FROM market_suppliers
        WHERE company_id = $1 AND is_active = true
        ORDER BY name
        LIMIT 10
      `, [payload.companyId])
      availableSuppliers = allSuppliers.rows.map(s => `${s.name} (${s.supplier_code})`)
    }

    // Auto-sync: If found, update the code in consignment_suppliers
    if (marketSupplierResult.rows.length > 0 && marketSupplierResult.rows[0].supplier_code !== actualSupplierCode) {
      const correctCode = marketSupplierResult.rows[0].supplier_code
      await db.query(`
        UPDATE consignment_suppliers SET code = $1 WHERE id = $2
      `, [correctCode, consignmentSupplierId])
      console.log('[Supplier Dashboard] Auto-synced code:', actualSupplierCode, '->', correctCode)
    }

    const marketSupplierId = marketSupplierResult.rows[0]?.id
    const marketSupplierName = marketSupplierResult.rows[0]?.name

    // Debug log
    console.log('[Supplier Dashboard] Debug:', {
      consignmentSupplierId,
      supplierCode,
      actualSupplierCode,
      supplierName: supplier.name,
      marketSupplierId,
      marketSupplierName,
      companyId: payload.companyId,
      availableSuppliers: availableSuppliers.length > 0 ? availableSuppliers : 'found'
    })

    // Initialize default values
    let wallet = {
      balance_available: 0,
      balance_pending: 0,
      total_earned: 0,
      total_paid: 0,
      total_returned: 0
    }

    let orderStats = {
      pending_orders: '0',
      received_orders: '0',
      active_orders: '0',
      completed_orders: '0',
      total_orders: '0',
      total_consigned: '0',
      total_sold: '0'
    }

    // Only query if we found the market supplier
    if (marketSupplierId) {
      // Get wallet info (wallet uses market_suppliers.id)
      let walletResult = await db.query(`
        SELECT
          balance_available,
          balance_pending,
          total_earned,
          total_paid,
          total_returned
        FROM consignment_supplier_wallets
        WHERE supplier_id = $1
      `, [marketSupplierId])

      // Auto-create wallet if it doesn't exist
      if (walletResult.rows.length === 0) {
        // Calculate initial balance from orders
        const ordersTotal = await db.query(`
          SELECT
            COALESCE(SUM(total_sold), 0) as total_sold,
            COALESCE(SUM(total_paid), 0) as total_paid
          FROM consignment_orders
          WHERE supplier_id = $1
        `, [marketSupplierId])

        const totalSold = parseFloat(ordersTotal.rows[0]?.total_sold) || 0
        const totalPaid = parseFloat(ordersTotal.rows[0]?.total_paid) || 0
        const balanceAvailable = totalSold - totalPaid

        // Create the wallet
        await db.query(`
          INSERT INTO consignment_supplier_wallets (
            supplier_id, company_id, balance_available, balance_pending,
            total_earned, total_paid, total_returned, created_at, updated_at
          ) VALUES ($1, $2, $3, 0, $4, $5, 0, NOW(), NOW())
        `, [marketSupplierId, payload.companyId, balanceAvailable, totalSold, totalPaid])

        console.log('[Supplier Dashboard] Auto-created wallet for supplier:', marketSupplierId, 'balance:', balanceAvailable)

        // Fetch the newly created wallet
        walletResult = await db.query(`
          SELECT balance_available, balance_pending, total_earned, total_paid, total_returned
          FROM consignment_supplier_wallets WHERE supplier_id = $1
        `, [marketSupplierId])
      }

      if (walletResult.rows[0]) {
        wallet = walletResult.rows[0]
      }

      // Get order stats (orders use market_suppliers.id)
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
      `, [marketSupplierId])

      orderStats = ordersResult.rows[0]
    } else {
      console.log('[Supplier Dashboard] WARNING: No market_suppliers entry found for code:', actualSupplierCode)
    }

    // Initialize defaults for sales, payments, transactions
    let sales30Days = 0
    let paymentStats = {
      pending_requests: '0',
      approved_requests: '0',
      amount_in_process: '0'
    }
    let recentTransactions: Array<{
      id: number
      type: string
      amount: number
      posOrderNumber: string | null
      orderNumber: string | null
      notes: string | null
      createdAt: string
    }> = []

    if (marketSupplierId) {
      // Get recent sales (last 30 days)
      const salesResult = await db.query(`
        SELECT
          COALESCE(SUM(amount), 0) as sales_30_days
        FROM consignment_wallet_transactions
        WHERE wallet_id = (SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1)
          AND transaction_type = 'sale'
          AND created_at >= NOW() - INTERVAL '30 days'
      `, [marketSupplierId])

      sales30Days = parseFloat(salesResult.rows[0]?.sales_30_days) || 0

      // Get pending payment requests
      const paymentsResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
          COALESCE(SUM(amount_requested) FILTER (WHERE status IN ('pending', 'approved')), 0) as amount_in_process
        FROM consignment_payment_requests
        WHERE supplier_id = $1
      `, [marketSupplierId])

      paymentStats = paymentsResult.rows[0]

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
      `, [marketSupplierId])

      recentTransactions = transactionsResult.rows.map(t => ({
        id: t.id,
        type: t.transaction_type,
        amount: parseFloat(t.amount),
        posOrderNumber: t.pos_order_number,
        orderNumber: t.order_number,
        notes: t.notes,
        createdAt: t.created_at
      }))
    }

    // Get sales rhythm data (last 7 days)
    let salesByDay: Array<{ date: string; amount: number; count: number }> = []
    let sales7Days = 0
    let salesYesterday = 0
    let salesToday = 0

    if (marketSupplierId) {
      const rhythmResult = await db.query(`
        SELECT
          DATE(created_at) as sale_date,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(*) as sale_count
        FROM consignment_wallet_transactions
        WHERE wallet_id = (SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1)
          AND transaction_type = 'sale'
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY sale_date DESC
      `, [marketSupplierId])

      salesByDay = rhythmResult.rows.map(r => ({
        date: r.sale_date,
        amount: parseFloat(r.total_amount) || 0,
        count: parseInt(r.sale_count) || 0
      }))

      // Calculate totals
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      for (const day of salesByDay) {
        const dayDate = new Date(day.date).toISOString().split('T')[0]
        sales7Days += day.amount
        if (dayDate === today) salesToday = day.amount
        if (dayDate === yesterday) salesYesterday = day.amount
      }
    }

    // Calculate average daily sales
    const avgDailySales = sales7Days / 7

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
          available: parseFloat(String(wallet.balance_available)) || 0,
          pending: parseFloat(String(wallet.balance_pending)) || 0,
          totalEarned: parseFloat(String(wallet.total_earned)) || 0,
          totalPaid: parseFloat(String(wallet.total_paid)) || 0,
          totalReturned: parseFloat(String(wallet.total_returned)) || 0
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
        salesRhythm: {
          today: salesToday,
          yesterday: salesYesterday,
          last7Days: sales7Days,
          avgDaily: avgDailySales,
          byDay: salesByDay
        },
        recentTransactions,
        debug: {
          marketSupplierId,
          marketSupplierName,
          consignmentSupplierId,
          consignmentName: supplier.name,
          supplierCode: actualSupplierCode,
          hasWallet: !!wallet.balance_available || wallet.balance_available === 0,
          availableSuppliers: availableSuppliers.length > 0 ? availableSuppliers : undefined
        }
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
