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
 * Lista proveedores de consignacion
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

    let query = `
      SELECT
        s.*,
        u.id as linked_user_id,
        u.firstname as linked_user_firstname,
        u.lastname as linked_user_lastname,
        u.email as linked_user_email,
        (SELECT COUNT(*) FROM consignment_orders WHERE supplier_id = s.id) as total_orders,
        (SELECT COALESCE(SUM(total_cost), 0) FROM consignment_orders WHERE supplier_id = s.id) as total_consigned,
        w.balance_available,
        w.total_earned,
        w.total_paid
      FROM consignment_suppliers s
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]

    if (search) {
      query += ` AND (s.name ILIKE $2 OR s.code ILIKE $2 OR s.email ILIKE $2 OR s.phone ILIKE $2)`
      params.push(`%${search}%`)
    }

    // Count total
    const countResult = await db.query(
      query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM'),
      params
    )
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated results
    query += ` ORDER BY s.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const suppliers = result.rows.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      legalName: s.legal_name,
      taxId: s.tax_id,
      contactName: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      username: s.username,
      userId: s.user_id,
      linkedUser: s.linked_user_id ? {
        id: s.linked_user_id,
        name: `${s.linked_user_firstname || ''} ${s.linked_user_lastname || ''}`.trim(),
        email: s.linked_user_email
      } : null,
      isActive: s.is_active,
      createdAt: s.created_at,
      stats: {
        totalOrders: parseInt(s.total_orders) || 0,
        totalConsigned: parseFloat(s.total_consigned) || 0,
        balanceAvailable: parseFloat(s.balance_available) || 0,
        totalEarned: parseFloat(s.total_earned) || 0,
        totalPaid: parseFloat(s.total_paid) || 0
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
    console.error('[Suppliers GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}

/**
 * POST /api/consignments/suppliers
 * Crear proveedor de consignacion
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { code, name, legalName, taxId, contactName, email, phone, address, username, password, userId } = body

    // Validaciones
    if (!code || !name) {
      return NextResponse.json({
        success: false,
        error: 'Código y nombre son requeridos'
      }, { status: 400 })
    }

    if (code.length > 10) {
      return NextResponse.json({
        success: false,
        error: 'El código debe tener máximo 10 caracteres'
      }, { status: 400 })
    }

    // Verificar código único
    const existingCode = await db.query(
      'SELECT id FROM consignment_suppliers WHERE company_id = $1 AND code = $2',
      [payload.companyId, code.toUpperCase()]
    )
    if (existingCode.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un proveedor con este código'
      }, { status: 400 })
    }

    // Si tiene username, verificar que sea único
    if (username) {
      const existingUsername = await db.query(
        'SELECT id FROM consignment_suppliers WHERE username = $1',
        [username]
      )
      if (existingUsername.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'El nombre de usuario ya está en uso'
        }, { status: 400 })
      }
    }

    // Si tiene userId, verificar que el usuario existe y no está vinculado a otro proveedor
    if (userId) {
      const userCheck = await db.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      )
      if (userCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 400 })
      }

      const linkedCheck = await db.query(
        'SELECT id FROM consignment_suppliers WHERE user_id = $1',
        [userId]
      )
      if (linkedCheck.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Este usuario ya está vinculado a otro proveedor'
        }, { status: 400 })
      }
    }

    // Hash password si se proporciona
    let passwordHash = null
    if (password) {
      passwordHash = await bcrypt.hash(password, 10)
    }

    // Crear proveedor
    const result = await db.query(`
      INSERT INTO consignment_suppliers (
        company_id, code, name, legal_name, tax_id, contact_name,
        email, phone, address, username, password_hash, user_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      RETURNING id
    `, [
      payload.companyId,
      code.toUpperCase(),
      name,
      legalName || null,
      taxId || null,
      contactName || null,
      email || null,
      phone || null,
      address || null,
      username || null,
      passwordHash,
      userId || null
    ])

    const supplierId = result.rows[0].id

    // Crear wallet para el proveedor
    await db.query(`
      INSERT INTO consignment_supplier_wallets (supplier_id)
      VALUES ($1)
    `, [supplierId])

    return NextResponse.json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: { id: supplierId, code: code.toUpperCase() }
    })

  } catch (error) {
    console.error('[Suppliers POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear proveedor'
    }, { status: 500 })
  }
}
