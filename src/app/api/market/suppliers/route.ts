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
 * GET /api/market/suppliers
 * Lista proveedores del marketplace (tabla market_suppliers)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build WHERE clause
    let whereClause = 'WHERE company_id = $1 AND is_active = true'
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (search) {
      whereClause += ' AND (name ILIKE $' + paramIndex + ' OR supplier_code ILIKE $' + paramIndex + ' OR email ILIKE $' + paramIndex + ' OR phone ILIKE $' + paramIndex + ')'
      params.push('%' + search + '%')
      paramIndex++
    }

    // Count total
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM market_suppliers ' + whereClause,
      params
    )
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get suppliers - using only columns that exist in the table
    const query = 'SELECT id, supplier_code, name, legal_name, tax_id, contact_person, email, phone, address, city, state, country, postal_code, payment_terms, credit_limit, is_active, created_at, updated_at FROM market_suppliers ' + whereClause + ' ORDER BY name ASC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1)
    params.push(limit, offset)

    const result = await db.query(query, params)

    const suppliers = result.rows.map(s => ({
      id: s.id,
      supplierCode: s.supplier_code,
      name: s.name,
      legalName: s.legal_name,
      taxId: s.tax_id,
      contactName: s.contact_person,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city,
      state: s.state,
      country: s.country,
      postalCode: s.postal_code,
      paymentTerms: s.payment_terms,
      creditLimit: parseFloat(s.credit_limit) || 0,
      notes: null,
      rating: 3,
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        stats: {
          totalSuppliers: total,
          highRated: 0,
          avgRating: 0
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
    console.error('[Market Suppliers GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/suppliers
 * Crear nuevo proveedor de marketplace
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, legalName, taxId, contactName, email, phone, address, city, state, country, postalCode, paymentTerms, creditLimit, notes } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del proveedor es requerido'
      }, { status: 400 })
    }

    // Generate supplier code
    const year = new Date().getFullYear()
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM market_suppliers WHERE company_id = $1 AND supplier_code LIKE $2',
      [payload.companyId, 'SUP-' + year + '-%']
    )

    const count = parseInt(countResult.rows[0]?.count) || 0
    const supplierCode = 'SUP-' + year + '-' + (count + 1).toString().padStart(4, '0')

    // Insert supplier
    const result = await db.query(
      'INSERT INTO market_suppliers (company_id, supplier_code, name, legal_name, tax_id, contact_name, email, phone, address, city, state, country, postal_code, payment_terms, credit_limit, notes, rating, is_active, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 3, true, $17, NOW(), NOW()) RETURNING *',
      [
        payload.companyId,
        supplierCode,
        name,
        legalName || null,
        taxId || null,
        contactName || null,
        email || null,
        phone || null,
        address || null,
        city || null,
        state || null,
        country || null,
        postalCode || null,
        paymentTerms || null,
        creditLimit || 0,
        notes || null,
        payload.userId
      ]
    )

    const supplier = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        id: supplier.id,
        supplierCode: supplier.supplier_code,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone
      }
    })

  } catch (error) {
    console.error('[Market Suppliers POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear proveedor'
    }, { status: 500 })
  }
}
