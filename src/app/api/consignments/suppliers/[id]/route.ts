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
        COALESCE((SELECT COUNT(*) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_orders,
        COALESCE((SELECT SUM(total_cost) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_consigned,
        COALESCE((SELECT SUM(total_sold) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_sold,
        COALESCE((SELECT SUM(total_paid) FROM consignment_orders WHERE supplier_id = s.id), 0) as total_paid
      FROM market_suppliers s
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
      code: s.supplier_code,
      supplierCode: s.supplier_code,
      name: s.name,
      legalName: s.legal_name,
      taxId: s.tax_id,
      contactName: s.contact_person,
      email: s.email,
      phone: s.phone,
      mobile: s.mobile,
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
      updatedAt: s.updated_at,
      stats: {
        totalOrders: parseInt(s.total_orders) || 0,
        totalConsigned: parseFloat(s.total_consigned) || 0,
        totalSold: parseFloat(s.total_sold) || 0,
        totalPaid: parseFloat(s.total_paid) || 0,
        balanceAvailable: (parseFloat(s.total_sold) || 0) - (parseFloat(s.total_paid) || 0)
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
    const { code, name, legalName, taxId, contactName, email, phone, address, isActive } = body

    // MARKET_COMERCIAL no puede editar proveedores
    if (payload.role === 'MARKET_COMERCIAL') {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para editar proveedores'
      }, { status: 403 })
    }

    // Verificar que el proveedor existe y pertenece a la empresa
    const existing = await db.query(
      'SELECT id, company_id FROM market_suppliers WHERE id = $1 AND company_id = $2',
      [supplierId, payload.companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Si cambia el código, verificar que sea único en la empresa
    if (code) {
      const codeCheck = await db.query(
        'SELECT id FROM market_suppliers WHERE supplier_code = $1 AND company_id = $2 AND id != $3',
        [code, payload.companyId, supplierId]
      )
      if (codeCheck.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'El código de proveedor ya está en uso'
        }, { status: 400 })
      }
    }

    // Actualizar proveedor
    await db.query(`
      UPDATE market_suppliers SET
        supplier_code = COALESCE($1, supplier_code),
        name = COALESCE($2, name),
        legal_name = $3,
        tax_id = $4,
        contact_person = $5,
        email = $6,
        phone = $7,
        address = $8,
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10 AND company_id = $11
    `, [
      code || null,
      name,
      legalName || null,
      taxId || null,
      contactName || null,
      email || null,
      phone || null,
      address || null,
      isActive,
      supplierId,
      payload.companyId
    ])

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

    // MARKET_COMERCIAL no puede eliminar proveedores
    if (payload.role === 'MARKET_COMERCIAL') {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar proveedores'
      }, { status: 403 })
    }

    const { id } = await params
    const supplierId = parseInt(id)

    // Verificar que el proveedor existe
    const existing = await db.query(
      'SELECT id FROM market_suppliers WHERE id = $1 AND company_id = $2',
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

    // Eliminar wallet si existe
    try {
      await db.query('DELETE FROM consignment_supplier_wallets WHERE supplier_id = $1', [supplierId])
    } catch {
      // wallet might not exist
    }

    // Eliminar proveedor
    await db.query('DELETE FROM market_suppliers WHERE id = $1 AND company_id = $2', [supplierId, payload.companyId])

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
