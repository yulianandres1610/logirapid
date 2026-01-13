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

// CORS headers for API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
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
 * GET /api/consignments/suppliers/[id]
 * Obtener proveedor por ID
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
    const supplierId = parseInt(id)

    const result = await db.query(`
      SELECT
        s.*,
        u.id as linked_user_id,
        u.firstname as linked_user_firstname,
        u.lastname as linked_user_lastname,
        u.email as linked_user_email,
        (SELECT COUNT(*) FROM consignment_orders WHERE supplier_id = s.id) as total_orders,
        (SELECT COALESCE(SUM(total_cost), 0) FROM consignment_orders WHERE supplier_id = s.id) as total_consigned,
        (SELECT COALESCE(SUM(total_sold), 0) FROM consignment_orders WHERE supplier_id = s.id) as total_sold,
        w.balance_available,
        w.balance_pending,
        w.total_earned,
        w.total_paid,
        w.total_returned
      FROM consignment_suppliers s
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.company_id = $2
    `, [supplierId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const s = result.rows[0]
    const supplier = {
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
      hasPassword: !!s.password_hash,
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      stats: {
        totalOrders: parseInt(s.total_orders) || 0,
        totalConsigned: parseFloat(s.total_consigned) || 0,
        totalSold: parseFloat(s.total_sold) || 0,
        balanceAvailable: parseFloat(s.balance_available) || 0,
        balancePending: parseFloat(s.balance_pending) || 0,
        totalEarned: parseFloat(s.total_earned) || 0,
        totalPaid: parseFloat(s.total_paid) || 0,
        totalReturned: parseFloat(s.total_returned) || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: supplier
    })

  } catch (error) {
    console.error('[Supplier GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedor'
    }, { status: 500 })
  }
}

/**
 * PUT /api/consignments/suppliers/[id]
 * Actualizar proveedor
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
    const supplierId = parseInt(id)
    const body = await request.json()
    const { name, legalName, taxId, contactName, email, phone, address, username, password, isActive, userId } = body

    console.log('[Supplier PUT] Attempting update for supplier:', supplierId, 'user companyId:', payload.companyId, 'role:', payload.role)

    // Verificar que el proveedor existe y pertenece a la empresa (SUPER_ADMIN puede editar cualquiera)
    let existing
    if (payload.role === 'SUPER_ADMIN') {
      existing = await db.query(
        'SELECT id, username, company_id FROM consignment_suppliers WHERE id = $1',
        [supplierId]
      )
    } else {
      existing = await db.query(
        'SELECT id, username, company_id FROM consignment_suppliers WHERE id = $1 AND company_id = $2',
        [supplierId, payload.companyId]
      )
    }

    if (existing.rows.length === 0) {
      console.log('[Supplier PUT] Supplier not found. ID:', supplierId, 'Company:', payload.companyId)
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Use supplier's actual company_id for the update
    const supplierCompanyId = existing.rows[0].company_id

    // Si cambia el username, verificar que sea único
    if (username && username !== existing.rows[0].username) {
      const usernameCheck = await db.query(
        'SELECT id FROM consignment_suppliers WHERE username = $1 AND id != $2',
        [username, supplierId]
      )
      if (usernameCheck.rows.length > 0) {
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
        'SELECT id FROM consignment_suppliers WHERE user_id = $1 AND id != $2',
        [userId, supplierId]
      )
      if (linkedCheck.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Este usuario ya está vinculado a otro proveedor'
        }, { status: 400 })
      }
    }

    // Preparar actualización
    let query = `
      UPDATE consignment_suppliers SET
        name = COALESCE($1, name),
        legal_name = $2,
        tax_id = $3,
        contact_name = $4,
        email = $5,
        phone = $6,
        address = $7,
        username = $8,
        is_active = COALESCE($9, is_active),
        user_id = $10,
        updated_at = NOW()
    `
    const params_arr: (string | number | boolean | null)[] = [
      name,
      legalName || null,
      taxId || null,
      contactName || null,
      email || null,
      phone || null,
      address || null,
      username || null,
      isActive,
      userId || null
    ]

    // Si hay nueva contraseña, incluirla
    // Use supplierCompanyId for the WHERE clause (allows SUPER_ADMIN to update any supplier)
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      query += `, password_hash = $11 WHERE id = $12 AND company_id = $13`
      params_arr.push(passwordHash, supplierId, supplierCompanyId)
    } else {
      query += ` WHERE id = $11 AND company_id = $12`
      params_arr.push(supplierId, supplierCompanyId)
    }

    await db.query(query, params_arr)

    return NextResponse.json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Supplier PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar proveedor'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/consignments/suppliers/[id]
 * Eliminar proveedor (solo si no tiene ordenes)
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
    const supplierId = parseInt(id)

    // Verificar que el proveedor existe
    const existing = await db.query(
      'SELECT id FROM consignment_suppliers WHERE id = $1 AND company_id = $2',
      [supplierId, payload.companyId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Verificar que no tiene ordenes
    const ordersCheck = await db.query(
      'SELECT COUNT(*) as count FROM consignment_orders WHERE supplier_id = $1',
      [supplierId]
    )
    if (parseInt(ordersCheck.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el proveedor porque tiene ordenes asociadas'
      }, { status: 400 })
    }

    // Eliminar wallet primero
    await db.query('DELETE FROM consignment_supplier_wallets WHERE supplier_id = $1', [supplierId])

    // Eliminar proveedor
    await db.query('DELETE FROM consignment_suppliers WHERE id = $1', [supplierId])

    return NextResponse.json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    })

  } catch (error) {
    console.error('[Supplier DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar proveedor'
    }, { status: 500 })
  }
}
