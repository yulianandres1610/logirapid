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

// Run migration to add print service column to warehouses
async function ensurePrintServiceColumn() {
  try {
    await db.query(`
      ALTER TABLE market_warehouses
      ADD COLUMN IF NOT EXISTS default_print_service_id INTEGER REFERENCES print_services(id)
    `)
  } catch (error) {
    // Column might already exist or print_services table doesn't exist yet
    console.log('[Warehouse Migration] Print service column check:', error)
  }
}

// Initialize migration
ensurePrintServiceColumn()

/**
 * GET /api/market/warehouses/[id]
 * Get a specific warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        mw.*,
        ps.name as print_service_name,
        ps.code as print_service_code,
        ps.url as print_service_url,
        (SELECT COUNT(*) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as products_count,
        (SELECT COALESCE(SUM(mws.quantity_on_hand), 0) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as total_stock
      FROM market_warehouses mw
      LEFT JOIN print_services ps ON ps.id = mw.default_print_service_id
      WHERE mw.id = $1 AND mw.company_id = $2
    `, [warehouseId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        code: row.code,
        name: row.name,
        isCentral: row.is_central,
        warehouseType: row.warehouse_type,
        address: row.address,
        city: row.city,
        state: row.state,
        municipality: row.municipality,
        country: row.country,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        managerName: row.manager_name,
        phone: row.phone,
        email: row.email,
        isActive: row.is_active,
        allowNegativeStock: row.allow_negative_stock,
        productsCount: parseInt(row.products_count) || 0,
        totalStock: parseInt(row.total_stock) || 0,
        defaultPrintServiceId: row.default_print_service_id,
        printServiceName: row.print_service_name,
        printServiceCode: row.print_service_code,
        printServiceUrl: row.print_service_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })

  } catch (error) {
    console.error('[Market Warehouse API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener almacén'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/warehouses/[id]
 * Update a warehouse
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Check warehouse exists and belongs to company
    const existing = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      code,
      isCentral,
      warehouseType,
      address,
      city,
      state,
      municipality,
      country,
      latitude,
      longitude,
      managerName,
      phone,
      email,
      isActive,
      allowNegativeStock,
      defaultPrintServiceId
    } = body

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json({
        success: false,
        error: 'Nombre y código son requeridos'
      }, { status: 400 })
    }

    // Check code uniqueness (excluding current warehouse)
    const duplicateCode = await db.query(
      'SELECT id FROM market_warehouses WHERE company_id = $1 AND code = $2 AND id != $3',
      [payload.companyId, code, warehouseId]
    )

    if (duplicateCode.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe otro almacén con ese código'
      }, { status: 400 })
    }

    // If setting as central, unset other central warehouses
    if (isCentral) {
      await db.query(
        'UPDATE market_warehouses SET is_central = false WHERE company_id = $1 AND is_central = true AND id != $2',
        [payload.companyId, warehouseId]
      )
    }

    await db.query(`
      UPDATE market_warehouses SET
        name = $1,
        code = $2,
        is_central = $3,
        warehouse_type = $4,
        address = $5,
        city = $6,
        state = $7,
        municipality = $8,
        country = $9,
        latitude = $10,
        longitude = $11,
        manager_name = $12,
        phone = $13,
        email = $14,
        is_active = $15,
        allow_negative_stock = $16,
        default_print_service_id = $17,
        updated_at = NOW()
      WHERE id = $18 AND company_id = $19
    `, [
      name,
      code,
      isCentral ?? false,
      warehouseType ?? 'storage',
      address || null,
      city || null,
      state || null,
      municipality || null,
      country || 'Cuba',
      latitude || null,
      longitude || null,
      managerName || null,
      phone || null,
      email || null,
      isActive ?? true,
      allowNegativeStock ?? false,
      defaultPrintServiceId || null,
      warehouseId,
      payload.companyId
    ])

    return NextResponse.json({
      success: true,
      message: 'Almacén actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Market Warehouse API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar almacén'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/warehouses/[id]
 * Delete a warehouse
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Only ADMIN or SUPER_ADMIN can delete
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar almacenes'
      }, { status: 403 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Check warehouse exists and belongs to company
    const existing = await db.query(
      'SELECT id, is_central FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Check if it's the central warehouse
    if (existing.rows[0].is_central) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el almacén central. Primero designe otro almacén como central.'
      }, { status: 400 })
    }

    // Check if warehouse has stock
    const stockCheck = await db.query(
      'SELECT COALESCE(SUM(quantity_on_hand), 0) as total_stock FROM market_warehouse_stock WHERE warehouse_id = $1',
      [warehouseId]
    )

    if (parseInt(stockCheck.rows[0].total_stock) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar un almacén con stock. Primero transfiera o elimine el inventario.'
      }, { status: 400 })
    }

    // Delete warehouse stock records first
    await db.query('DELETE FROM market_warehouse_stock WHERE warehouse_id = $1', [warehouseId])

    // Delete the warehouse
    await db.query('DELETE FROM market_warehouses WHERE id = $1', [warehouseId])

    return NextResponse.json({
      success: true,
      message: 'Almacén eliminado exitosamente'
    })

  } catch (error) {
    console.error('[Market Warehouse API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar almacén'
    }, { status: 500 })
  }
}
