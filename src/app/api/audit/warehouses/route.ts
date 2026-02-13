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
 * GET /api/audit/warehouses
 * Returns all active warehouses for the user's company with stats for both products and fixed assets
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

    // Verify user is admin from market company
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso denegado'
      }, { status: 403 })
    }

    // Get all active warehouses for the company with stats
    const result = await db.query(`
      SELECT
        mw.id,
        mw.code,
        mw.name,
        mw.address,
        mw.city,
        mw.state,
        mw.is_central,
        mw.is_active,
        -- Product stats
        (SELECT COUNT(DISTINCT mws.product_id)
         FROM market_warehouse_stock mws
         WHERE mws.warehouse_id = mw.id AND mws.quantity_on_hand > 0) as products_with_stock,
        (SELECT COALESCE(SUM(mws.quantity_on_hand), 0)
         FROM market_warehouse_stock mws
         WHERE mws.warehouse_id = mw.id) as total_stock,
        -- Last product audit
        (SELECT ac.created_at
         FROM audit_counts ac
         WHERE ac.warehouse_id = mw.id
           AND COALESCE(ac.audit_type, 'products') = 'products'
           AND ac.status IN ('completed', 'applied')
         ORDER BY ac.created_at DESC LIMIT 1) as last_count_date,
        (SELECT ac.count_number
         FROM audit_counts ac
         WHERE ac.warehouse_id = mw.id
           AND COALESCE(ac.audit_type, 'products') = 'products'
           AND ac.status IN ('completed', 'applied')
         ORDER BY ac.created_at DESC LIMIT 1) as last_count_number,
        -- Fixed assets stats
        (SELECT COUNT(*)
         FROM market_fixed_assets mfa
         WHERE mfa.warehouse_id = mw.id AND mfa.status = 'active') as fixed_assets_count,
        (SELECT COALESCE(SUM(mfa.current_value), 0)
         FROM market_fixed_assets mfa
         WHERE mfa.warehouse_id = mw.id AND mfa.status = 'active') as fixed_assets_value,
        -- Last fixed assets audit
        (SELECT ac.created_at
         FROM audit_counts ac
         WHERE ac.warehouse_id = mw.id
           AND ac.audit_type = 'fixed_assets'
           AND ac.status IN ('completed', 'applied')
         ORDER BY ac.created_at DESC LIMIT 1) as last_fixed_asset_count_date,
        (SELECT ac.count_number
         FROM audit_counts ac
         WHERE ac.warehouse_id = mw.id
           AND ac.audit_type = 'fixed_assets'
           AND ac.status IN ('completed', 'applied')
         ORDER BY ac.created_at DESC LIMIT 1) as last_fixed_asset_count_number
      FROM market_warehouses mw
      WHERE mw.company_id = $1 AND mw.is_active = true
      ORDER BY mw.name ASC
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        warehouses: result.rows.map(w => ({
          id: w.id,
          code: w.code,
          name: w.name,
          address: w.address,
          city: w.city,
          state: w.state,
          isCentral: w.is_central,
          // Product audit info
          productsWithStock: parseInt(w.products_with_stock) || 0,
          totalStock: parseFloat(w.total_stock) || 0,
          lastCountDate: w.last_count_date,
          lastCountNumber: w.last_count_number,
          // Fixed assets audit info
          fixedAssetsCount: parseInt(w.fixed_assets_count) || 0,
          fixedAssetsValue: parseFloat(w.fixed_assets_value) || 0,
          lastFixedAssetCountDate: w.last_fixed_asset_count_date,
          lastFixedAssetCountNumber: w.last_fixed_asset_count_number
        }))
      }
    })

  } catch (error) {
    console.error('[Audit Warehouses API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener almacenes'
    }, { status: 500 })
  }
}
