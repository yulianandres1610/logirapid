import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
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
 * GET /api/consignments/suppliers
 * Lista proveedores - UNIFICADO con market_suppliers
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

    // Build WHERE clause - using market_suppliers (unified table)
    let whereClause = 'WHERE s.company_id = $1 AND s.is_active = true'
    const countParams: (string | number)[] = [payload.companyId]

    if (search) {
      whereClause += ` AND (s.name ILIKE $2 OR s.supplier_code ILIKE $2 OR s.email ILIKE $2 OR s.phone ILIKE $2)`
      countParams.push(`%${search}%`)
    }

    // Count total first (simple query)
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM market_suppliers s ${whereClause}`,
      countParams
    )
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Build main query with all fields from market_suppliers
    // Also get stats from consignment_orders if they exist
    const query = `
      SELECT
        s.*,
        COALESCE((SELECT COUNT(*) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_orders,
        COALESCE((SELECT SUM(total_cost) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_consigned,
        COALESCE((SELECT SUM(total_sold) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_sold,
        COALESCE((SELECT SUM(total_paid) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_paid
      FROM market_suppliers s
      ${whereClause}
      ORDER BY s.name ASC
      LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}
    `
    const params = [...countParams, limit, offset]

    const result = await db.query(query, params)

    const suppliers = result.rows.map(s => ({
      id: s.id,
      code: s.supplier_code,
      supplierCode: s.supplier_code,
      name: s.name,
      legalName: s.legal_name,
      taxId: s.tax_id,
      contactName: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city,
      state: s.state,
      country: s.country,
      postalCode: s.postal_code,
      paymentTerms: s.payment_terms,
      creditLimit: parseFloat(s.credit_limit) || 0,
      notes: s.notes,
      rating: s.rating || 3,
      isActive: s.is_active,
      createdAt: s.created_at,
      stats: {
        totalOrders: parseInt(s.total_orders) || 0,
        totalConsigned: parseFloat(s.total_consigned) || 0,
        totalSold: parseFloat(s.total_sold) || 0,
        totalPaid: parseFloat(s.total_paid) || 0,
        balanceAvailable: (parseFloat(s.total_sold) || 0) - (parseFloat(s.total_paid) || 0)
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Consignment Suppliers GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}

/**
 * POST /api/consignments/suppliers
 * Crear proveedor - UNIFICADO con market_suppliers
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, legalName, taxId, contactName, email, phone, address, city, state, country, postalCode, paymentTerms, creditLimit, notes } = body

    // Validaciones
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
    `, [payload.companyId, `SUP-${year}-%`])

    const count = parseInt(countResult.rows[0]?.count) || 0
    const supplierCode = `SUP-${year}-${(count + 1).toString().padStart(4, '0')}`

    // Crear proveedor en market_suppliers
    const result = await db.query(`
      INSERT INTO market_suppliers (
        company_id, supplier_code, name, legal_name, tax_id, contact_name,
        email, phone, address, city, state, country, postal_code,
        payment_terms, credit_limit, notes, rating, is_active,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 3, true, $17, NOW(), NOW())
      RETURNING *
    `, [
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
    ])

    const supplier = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        id: supplier.id,
        code: supplier.supplier_code,
        supplierCode: supplier.supplier_code,
        name: supplier.name
      }
    })

  } catch (error) {
    console.error('[Consignment Suppliers POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear proveedor'
    }, { status: 500 })
  }
}
