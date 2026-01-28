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
 * GET /api/market/wholesale/customers/[id]
 * Get a single wholesale customer with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const customerId = parseInt(id)

    const result = await db.query(`
      SELECT
        c.*,
        pl.name as pricelist_name,
        pl.currency as pricelist_currency,
        u.email as created_by_email
      FROM market_wholesale_customers c
      LEFT JOIN market_pricelists pl ON pl.id = c.pricelist_id
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1 AND c.company_id = $2
    `, [customerId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get recent invoices
    const invoicesResult = await db.query(`
      SELECT id, invoice_number, status, payment_status, total_amount, created_at
      FROM market_invoices
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [customerId])

    // Get sales summary
    const salesResult = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'partial', 'overdue') THEN amount_due ELSE 0 END), 0) as total_pending
      FROM market_invoices
      WHERE customer_id = $1
    `, [customerId])

    const customer = {
      id: row.id,
      code: row.code,
      businessName: row.business_name,
      legalName: row.legal_name,
      taxId: row.tax_id,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      pricelistId: row.pricelist_id,
      pricelistName: row.pricelist_name,
      pricelistCurrency: row.pricelist_currency,
      creditLimit: parseFloat(row.credit_limit) || 0,
      creditDays: row.credit_days || 0,
      currentBalance: parseFloat(row.current_balance) || 0,
      status: row.status,
      notes: row.notes,
      createdBy: row.created_by_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      recentInvoices: invoicesResult.rows.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        status: inv.status,
        paymentStatus: inv.payment_status,
        totalAmount: parseFloat(inv.total_amount) || 0,
        createdAt: inv.created_at
      })),
      salesSummary: {
        totalInvoices: parseInt(salesResult.rows[0]?.total_invoices) || 0,
        totalSales: parseFloat(salesResult.rows[0]?.total_sales) || 0,
        totalPending: parseFloat(salesResult.rows[0]?.total_pending) || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: customer
    })

  } catch (error) {
    console.error('[Wholesale Customer GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cliente'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/wholesale/customers/[id]
 * Update a wholesale customer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const customerId = parseInt(id)
    const body = await request.json()

    const {
      businessName,
      legalName,
      taxId,
      contactName,
      email,
      phone,
      address,
      city,
      state,
      country,
      pricelistId,
      creditLimit,
      creditDays,
      status,
      notes
    } = body

    // Verify customer belongs to company
    const checkResult = await db.query(
      'SELECT id FROM market_wholesale_customers WHERE id = $1 AND company_id = $2',
      [customerId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    // Update customer
    await db.query(`
      UPDATE market_wholesale_customers SET
        business_name = COALESCE($1, business_name),
        legal_name = $2,
        tax_id = $3,
        contact_name = $4,
        email = $5,
        phone = $6,
        address = $7,
        city = $8,
        state = $9,
        country = $10,
        pricelist_id = $11,
        credit_limit = COALESCE($12, credit_limit),
        credit_days = COALESCE($13, credit_days),
        status = COALESCE($14, status),
        notes = $15,
        updated_at = NOW()
      WHERE id = $16
    `, [
      businessName,
      legalName || null,
      taxId || null,
      contactName || null,
      email || null,
      phone || null,
      address || null,
      city || null,
      state || null,
      country || 'Cuba',
      pricelistId || null,
      creditLimit,
      creditDays,
      status,
      notes || null,
      customerId
    ])

    return NextResponse.json({
      success: true,
      message: 'Cliente actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Wholesale Customer PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar cliente'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/wholesale/customers/[id]
 * Deactivate a wholesale customer (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const customerId = parseInt(id)

    // Verify customer belongs to company
    const checkResult = await db.query(
      'SELECT id FROM market_wholesale_customers WHERE id = $1 AND company_id = $2',
      [customerId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    // Check for pending invoices
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM market_invoices
      WHERE customer_id = $1 AND payment_status IN ('pending', 'partial')
    `, [customerId])

    if (parseInt(pendingResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede desactivar un cliente con facturas pendientes de pago'
      }, { status: 400 })
    }

    // Soft delete (set status to inactive)
    await db.query(
      'UPDATE market_wholesale_customers SET status = $1, updated_at = NOW() WHERE id = $2',
      ['inactive', customerId]
    )

    return NextResponse.json({
      success: true,
      message: 'Cliente desactivado exitosamente'
    })

  } catch (error) {
    console.error('[Wholesale Customer DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desactivar cliente'
    }, { status: 500 })
  }
}
