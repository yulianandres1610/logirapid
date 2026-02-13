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
  companyType: string
}

/**
 * GET /api/audit/fixed-assets
 * Returns fixed assets for counting in a specific warehouse
 * Query params: warehouseId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')

    if (!warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId es requerido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2 AND is_active = true',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Almacén no encontrado' }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]

    // Get all active fixed assets in this warehouse
    const assetsResult = await db.query(`
      SELECT
        fa.id,
        fa.asset_code,
        fa.barcode,
        fa.name,
        fa.description,
        fa.status,
        fa.condition,
        fa.acquisition_cost,
        fa.current_value,
        fa.warehouse_id,
        fa.location_code,
        fa.last_audit_date,
        fa.image_url,
        fa.brand,
        fa.model,
        fa.serial_number,
        mw.name as warehouse_name,
        fac.name as category_name,
        fac.id as category_id,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email, 'Sin asignar') as responsible_name,
        me.id as responsible_employee_id
      FROM market_fixed_assets fa
      LEFT JOIN market_warehouses mw ON fa.warehouse_id = mw.id
      LEFT JOIN market_fixed_asset_categories fac ON fa.category_id = fac.id
      LEFT JOIN market_employees me ON fa.responsible_employee_id = me.id
      LEFT JOIN users eu ON me.user_id = eu.id
      WHERE fa.company_id = $1
        AND fa.warehouse_id = $2
        AND fa.status = 'active'
      ORDER BY fa.asset_code ASC
    `, [payload.companyId, warehouseId])

    // Get warehouse stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_assets,
        COALESCE(SUM(current_value), 0) as total_value,
        COUNT(DISTINCT category_id) as categories
      FROM market_fixed_assets
      WHERE company_id = $1
        AND warehouse_id = $2
        AND status = 'active'
    `, [payload.companyId, warehouseId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name
        },
        stats: {
          totalAssets: parseInt(stats.total_assets) || 0,
          totalValue: parseFloat(stats.total_value) || 0,
          categories: parseInt(stats.categories) || 0
        },
        assets: assetsResult.rows.map(a => ({
          id: a.id,
          assetCode: a.asset_code,
          barcode: a.barcode,
          name: a.name,
          description: a.description,
          status: a.status,
          condition: a.condition,
          acquisitionCost: parseFloat(a.acquisition_cost) || 0,
          currentValue: parseFloat(a.current_value) || 0,
          warehouseId: a.warehouse_id,
          warehouseName: a.warehouse_name,
          locationCode: a.location_code,
          categoryId: a.category_id,
          categoryName: a.category_name,
          responsibleEmployeeId: a.responsible_employee_id,
          responsibleName: a.responsible_name,
          lastAuditDate: a.last_audit_date,
          imageUrl: a.image_url,
          brand: a.brand,
          model: a.model,
          serialNumber: a.serial_number
        }))
      }
    })

  } catch (error) {
    console.error('[Audit Fixed Assets API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener activos fijos'
    }, { status: 500 })
  }
}

/**
 * POST /api/audit/fixed-assets
 * Search for a fixed asset by barcode or code (for scanning)
 * Body: { search: string, companyId?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const { search } = body as { search: string }

    if (!search || search.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Término de búsqueda requerido'
      }, { status: 400 })
    }

    const searchTerm = search.trim()

    // Search by exact barcode or asset_code first
    const exactResult = await db.query(`
      SELECT
        fa.id,
        fa.asset_code,
        fa.barcode,
        fa.name,
        fa.description,
        fa.status,
        fa.condition,
        fa.acquisition_cost,
        fa.current_value,
        fa.warehouse_id,
        fa.location_code,
        fa.image_url,
        fa.brand,
        fa.model,
        mw.name as warehouse_name,
        fac.name as category_name,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email, 'Sin asignar') as responsible_name
      FROM market_fixed_assets fa
      LEFT JOIN market_warehouses mw ON fa.warehouse_id = mw.id
      LEFT JOIN market_fixed_asset_categories fac ON fa.category_id = fac.id
      LEFT JOIN market_employees me ON fa.responsible_employee_id = me.id
      LEFT JOIN users eu ON me.user_id = eu.id
      WHERE fa.company_id = $1
        AND (fa.barcode = $2 OR fa.asset_code = $2)
      LIMIT 1
    `, [payload.companyId, searchTerm])

    if (exactResult.rows.length > 0) {
      const a = exactResult.rows[0]
      return NextResponse.json({
        success: true,
        data: {
          found: true,
          asset: {
            id: a.id,
            assetCode: a.asset_code,
            barcode: a.barcode,
            name: a.name,
            description: a.description,
            status: a.status,
            condition: a.condition,
            acquisitionCost: parseFloat(a.acquisition_cost) || 0,
            currentValue: parseFloat(a.current_value) || 0,
            warehouseId: a.warehouse_id,
            warehouseName: a.warehouse_name,
            locationCode: a.location_code,
            categoryName: a.category_name,
            responsibleName: a.responsible_name,
            imageUrl: a.image_url,
            brand: a.brand,
            model: a.model
          }
        }
      })
    }

    // If no exact match, search by partial match (name, code, barcode)
    const partialResult = await db.query(`
      SELECT
        fa.id,
        fa.asset_code,
        fa.barcode,
        fa.name,
        fa.status,
        fa.condition,
        fa.current_value,
        fa.warehouse_id,
        mw.name as warehouse_name,
        fac.name as category_name
      FROM market_fixed_assets fa
      LEFT JOIN market_warehouses mw ON fa.warehouse_id = mw.id
      LEFT JOIN market_fixed_asset_categories fac ON fa.category_id = fac.id
      WHERE fa.company_id = $1
        AND (
          fa.barcode ILIKE $2
          OR fa.asset_code ILIKE $2
          OR fa.name ILIKE $2
        )
      ORDER BY
        CASE
          WHEN fa.barcode = $3 THEN 0
          WHEN fa.asset_code = $3 THEN 1
          ELSE 2
        END,
        fa.name ASC
      LIMIT 10
    `, [payload.companyId, `%${searchTerm}%`, searchTerm])

    return NextResponse.json({
      success: true,
      data: {
        found: false,
        suggestions: partialResult.rows.map(a => ({
          id: a.id,
          assetCode: a.asset_code,
          barcode: a.barcode,
          name: a.name,
          status: a.status,
          condition: a.condition,
          currentValue: parseFloat(a.current_value) || 0,
          warehouseId: a.warehouse_id,
          warehouseName: a.warehouse_name,
          categoryName: a.category_name
        }))
      }
    })

  } catch (error) {
    console.error('[Audit Fixed Assets API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar activo fijo'
    }, { status: 500 })
  }
}
