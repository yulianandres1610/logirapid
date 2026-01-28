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
 * GET /api/market/wholesale/customers
 * List wholesale customers for the company
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'active'
    const pricelistId = searchParams.get('pricelistId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build WHERE clause
    let whereClause = 'WHERE c.company_id = $1'
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      whereClause += ` AND c.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (search) {
      whereClause += ` AND (c.business_name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex} OR c.contact_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (pricelistId) {
      whereClause += ` AND c.pricelist_id = $${paramIndex}`
      params.push(parseInt(pricelistId))
      paramIndex++
    }

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM market_wholesale_customers c ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get customers with pricelist info
    const query = `
      SELECT
        c.*,
        pl.name as pricelist_name,
        (SELECT COUNT(*) FROM market_invoices i WHERE i.customer_id = c.id) as total_invoices,
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM market_invoices i WHERE i.customer_id = c.id AND i.status != 'cancelled') as total_sales
      FROM market_wholesale_customers c
      LEFT JOIN market_pricelists pl ON pl.id = c.pricelist_id
      ${whereClause}
      ORDER BY c.business_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

    const customers = result.rows.map(row => ({
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
      creditLimit: parseFloat(row.credit_limit) || 0,
      creditDays: row.credit_days || 0,
      currentBalance: parseFloat(row.current_balance) || 0,
      status: row.status,
      notes: row.notes,
      totalInvoices: parseInt(row.total_invoices) || 0,
      totalSales: parseFloat(row.total_sales) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    // Calculate stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE credit_limit > 0) as with_credit,
        COALESCE(SUM(current_balance), 0) as total_balance
      FROM market_wholesale_customers
      WHERE company_id = $1
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        customers,
        stats: {
          total: parseInt(stats.total) || 0,
          active: parseInt(stats.active) || 0,
          withCredit: parseInt(stats.with_credit) || 0,
          totalBalance: parseFloat(stats.total_balance) || 0
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
    console.error('[Wholesale Customers GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener clientes mayoristas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wholesale/customers
 * Create a new wholesale customer
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

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
      notes
    } = body

    if (!businessName) {
      return NextResponse.json({
        success: false,
        error: 'El nombre comercial es requerido'
      }, { status: 400 })
    }

    // Generate customer code: CUST-001, CUST-002, etc.
    const codeResult = await db.query(`
      SELECT code FROM market_wholesale_customers
      WHERE company_id = $1
      ORDER BY id DESC
      LIMIT 1
    `, [payload.companyId])

    let nextNumber = 1
    if (codeResult.rows.length > 0) {
      const lastCode = codeResult.rows[0].code
      const match = lastCode.match(/CUST-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const customerCode = `CUST-${String(nextNumber).padStart(3, '0')}`

    // Insert customer
    const result = await db.query(`
      INSERT INTO market_wholesale_customers (
        company_id, code, business_name, legal_name, tax_id,
        contact_name, email, phone, address, city, state, country,
        pricelist_id, credit_limit, credit_days, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      payload.companyId,
      customerCode,
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
      creditLimit || 0,
      creditDays || 0,
      notes || null,
      payload.userId
    ])

    const customer = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Cliente mayorista creado exitosamente',
      data: {
        id: customer.id,
        code: customer.code,
        businessName: customer.business_name
      }
    })

  } catch (error) {
    console.error('[Wholesale Customers POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear cliente mayorista'
    }, { status: 500 })
  }
}
