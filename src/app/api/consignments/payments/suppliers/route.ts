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
 * GET /api/consignments/payments/suppliers
 * Lista proveedores con saldo disponible para pago
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const onlyWithBalance = searchParams.get('onlyWithBalance') === 'true'

    let balanceFilter = ''
    if (onlyWithBalance) {
      balanceFilter = 'AND COALESCE(w.balance_available, 0) > 0'
    }

    // Get suppliers with their wallet info and pending requests
    // Using market_suppliers as the main table (unified suppliers)
    const result = await db.query(`
      SELECT
        s.id,
        s.supplier_code as code,
        s.name,
        s.email,
        s.phone,
        COALESCE(w.balance_available, 0) as balance_available,
        COALESCE(w.balance_pending, 0) as balance_pending,
        COALESCE(w.total_earned, 0) as total_earned,
        COALESCE(w.total_paid, 0) as total_paid,
        (
          SELECT COUNT(*)
          FROM consignment_payment_requests r
          WHERE r.supplier_id = s.id AND r.status IN ('pending', 'approved')
        ) as pending_requests,
        (
          SELECT COALESCE(SUM(r.amount_requested), 0)
          FROM consignment_payment_requests r
          WHERE r.supplier_id = s.id AND r.status IN ('pending', 'approved')
        ) as pending_amount,
        COALESCE((SELECT SUM(total_sold) FROM consignment_orders WHERE supplier_id = s.id), 0) as orders_total_sold,
        COALESCE((SELECT SUM(total_paid) FROM consignment_orders WHERE supplier_id = s.id), 0) as orders_total_paid
      FROM market_suppliers s
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      WHERE s.company_id = $1 AND s.is_active = true ${balanceFilter}
      ORDER BY COALESCE(w.balance_available, 0) DESC, s.name ASC
    `, [payload.companyId])

    // Map and calculate - if no wallet exists, calculate from orders
    const suppliers = result.rows.map(s => {
      const walletBalance = parseFloat(s.balance_available) || 0
      const walletEarned = parseFloat(s.total_earned) || 0
      const walletPaid = parseFloat(s.total_paid) || 0

      // If wallet exists, use wallet data. Otherwise calculate from orders.
      const ordersSold = parseFloat(s.orders_total_sold) || 0
      const ordersPaid = parseFloat(s.orders_total_paid) || 0

      // Use wallet balance if available, otherwise calculate from orders
      const balanceAvailable = walletBalance > 0 ? walletBalance : (ordersSold - ordersPaid)
      const totalEarned = walletEarned > 0 ? walletEarned : ordersSold
      const totalPaid = walletPaid > 0 ? walletPaid : ordersPaid

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        email: s.email,
        phone: s.phone,
        balanceAvailable,
        balancePending: parseFloat(s.balance_pending) || 0,
        totalEarned,
        totalPaid,
        pendingRequests: parseInt(s.pending_requests) || 0,
        pendingAmount: parseFloat(s.pending_amount) || 0
      }
    })

    // Calculate totals
    const totalAvailable = suppliers.reduce((sum, s) => sum + s.balanceAvailable, 0)
    const totalPending = suppliers.reduce((sum, s) => sum + s.balancePending, 0)
    const totalPaid = suppliers.reduce((sum, s) => sum + s.totalPaid, 0)

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        summary: {
          totalSuppliers: suppliers.length,
          suppliersWithBalance: suppliers.filter(s => s.balanceAvailable > 0).length,
          totalAvailable,
          totalPending,
          totalPaid
        }
      }
    })

  } catch (error) {
    console.error('[Payment Suppliers GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar proveedores'
    }, { status: 500 })
  }
}
