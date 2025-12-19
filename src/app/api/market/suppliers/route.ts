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
 * GET /api/market/suppliers
 * List all suppliers for a market company
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    console.log('[Market Suppliers] Fetching suppliers for company:', companyId)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const active = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        s.*,
        (SELECT COUNT(*) FROM market_purchases WHERE supplier_id = s.id) as purchase_count,
        (SELECT SUM(total_amount) FROM market_purchases WHERE supplier_id = s.id AND status != 'cancelled') as total_spent,
        (SELECT MAX(purchase_date) FROM market_purchases WHERE supplier_id = s.id) as last_purchase_date
      FROM market_suppliers s
      WHERE s.company_id = $1
    `

    const queryParams: (string | number | boolean)[] = [companyId]
    let paramIndex = 2

    // Search filter
    if (search) {
      query += ` AND (
        LOWER(s.name) LIKE $${paramIndex}
        OR LOWER(s.supplier_code) LIKE $${paramIndex}
        OR LOWER(s.phone) LIKE $${paramIndex}
        OR LOWER(s.email) LIKE $${paramIndex}
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Active filter
    if (active !== null && active !== undefined) {
      query += ` AND s.is_active = $${paramIndex}`
      queryParams.push(active === 'true')
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) as total FROM')
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination and order
    query += ` ORDER BY s.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)
    console.log('[Market Suppliers] Found', result.rows.length, 'suppliers')

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive
      FROM market_suppliers
      WHERE company_id = $1
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        suppliers: result.rows.map(row => ({
          id: row.id,
          supplierCode: row.supplier_code,
          name: row.name,
          legalName: row.legal_name,
          taxId: row.tax_id,
          contactPerson: row.contact_person,
          email: row.email,
          phone: row.phone,
          mobile: row.mobile,
          address: row.address,
          city: row.city,
          state: row.state,
          country: row.country,
          postalCode: row.postal_code,
          paymentTerms: row.payment_terms,
          creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : null,
          currency: row.currency,
          categories: row.categories || [],
          isActive: row.is_active,
          rating: row.rating,
          notes: row.notes,
          purchaseCount: parseInt(row.purchase_count) || 0,
          totalSpent: parseFloat(row.total_spent) || 0,
          lastPurchaseDate: row.last_purchase_date,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        stats: {
          total: parseInt(statsResult.rows[0]?.total) || 0,
          active: parseInt(statsResult.rows[0]?.active) || 0,
          inactive: parseInt(statsResult.rows[0]?.inactive) || 0
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
    console.error('[Market Suppliers API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      name,
      legalName,
      taxId,
      contactPerson,
      email,
      phone,
      mobile,
      address,
      city,
      state,
      country = 'Cuba',
      postalCode,
      paymentTerms,
      creditLimit,
      currency = 'USD',
      categories = [],
      notes
    } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del proveedor es requerido'
      }, { status: 400 })
    }

    // Generate supplier code
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count
      FROM market_suppliers
      WHERE company_id = $1 AND supplier_code LIKE $2
    `, [companyId, `SUP-${year}-%`])

    const count = parseInt(countResult.rows[0]?.count) || 0
    const supplierCode = `SUP-${year}-${(count + 1).toString().padStart(4, '0')}`

    const result = await db.query(`
      INSERT INTO market_suppliers (
        company_id, supplier_code, name, legal_name, tax_id,
        contact_person, email, phone, mobile,
        address, city, state, country, postal_code,
        payment_terms, credit_limit, currency,
        categories, notes, is_active, rating,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, true, 3,
        $20, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, supplierCode, name, legalName || null, taxId || null,
      contactPerson || null, email || null, phone || null, mobile || null,
      address || null, city || null, state || null, country, postalCode || null,
      paymentTerms || null, creditLimit || null, currency,
      categories.length > 0 ? categories : null, notes || null,
      userId
    ])

    const supplierId = result.rows[0].id

    console.log('[Market Suppliers] Created supplier:', supplierId, 'code:', supplierCode)

    return NextResponse.json({
      success: true,
      data: {
        id: supplierId,
        supplierCode
      },
      message: 'Proveedor creado exitosamente'
    })

  } catch (error) {
    console.error('[Market Suppliers API] Error creating supplier:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear proveedor'
    }, { status: 500 })
  }
}
