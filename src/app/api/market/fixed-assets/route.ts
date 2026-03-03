import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import * as storageAdapter from '@/lib/storage-adapter'

const BUCKET_NAME = 'company-private-documents'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/fixed-assets
 * List fixed assets with filters and pagination
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - search: string (search by name, asset_code, serial_number)
 * - categoryId: number
 * - warehouseId: number
 * - responsibleId: number
 * - status: string ('active', 'in_repair', 'disposed', 'lost')
 * - assetType: string ('hardware', 'furniture', 'equipment', 'vehicle', 'other')
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const warehouseId = searchParams.get('warehouseId')
    const responsibleId = searchParams.get('responsibleId')
    const status = searchParams.get('status')
    const assetType = searchParams.get('assetType')

    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIndex = 1

    // Company filter
    if (payload.role !== 'SUPER_ADMIN') {
      conditions.push(`a.company_id = $${paramIndex}`)
      params.push(payload.companyId)
      paramIndex++
    }

    // Search filter
    if (search) {
      conditions.push(`(
        a.name ILIKE $${paramIndex} OR
        a.asset_code ILIKE $${paramIndex} OR
        a.serial_number ILIKE $${paramIndex} OR
        a.barcode ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    // Category filter
    if (categoryId) {
      conditions.push(`a.category_id = $${paramIndex}`)
      params.push(parseInt(categoryId))
      paramIndex++
    }

    // Warehouse filter
    if (warehouseId) {
      conditions.push(`a.warehouse_id = $${paramIndex}`)
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    // Responsible filter
    if (responsibleId) {
      conditions.push(`a.responsible_employee_id = $${paramIndex}`)
      params.push(parseInt(responsibleId))
      paramIndex++
    }

    // Status filter
    if (status) {
      conditions.push(`a.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    // Asset type filter
    if (assetType) {
      conditions.push(`a.asset_type = $${paramIndex}`)
      params.push(assetType)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_fixed_assets a
      ${whereClause}
    `, params)

    const total = parseInt(countResult.rows[0].total)

    // Get stats (totals by status and total value)
    const statsConditions = payload.role !== 'SUPER_ADMIN'
      ? 'WHERE company_id = $1'
      : ''
    const statsParams = payload.role !== 'SUPER_ADMIN' ? [payload.companyId] : []

    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'in_repair') as in_repair_count,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
        COUNT(*) FILTER (WHERE status = 'disposed') as disposed_count,
        COALESCE(SUM(CASE WHEN status != 'disposed' THEN current_value ELSE 0 END), 0) as total_value
      FROM market_fixed_assets
      ${statsConditions}
    `, statsParams)

    // Get assets with joins
    const assetsResult = await db.query(`
      SELECT
        a.*,
        c.name as category_name,
        c.code as category_code,
        w.name as warehouse_name,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email) as responsible_name,
        s.name as supplier_name,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM market_fixed_assets a
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      LEFT JOIN users eu ON e.user_id = eu.id
      LEFT JOIN market_suppliers s ON a.supplier_id = s.id
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    // Generate signed URLs for images in parallel
    const storageConfigured = storageAdapter.isConfigured()
    const assets = await Promise.all(assetsResult.rows.map(async (row) => {
      let imageSignedUrl: string | null = null
      if (storageConfigured && row.image_url) {
        try {
          imageSignedUrl = await storageAdapter.createSignedUrl(BUCKET_NAME, row.image_url, 3600)
        } catch {
          // Ignore - image just won't show
        }
      }
      return {
        id: row.id,
        companyId: row.company_id,
        assetCode: row.asset_code,
        barcode: row.barcode,
        name: row.name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryCode: row.category_code,
        assetType: row.asset_type,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        locationCode: row.location_code,
        responsibleEmployeeId: row.responsible_employee_id,
        responsibleName: row.responsible_name,
        acquisitionDate: row.acquisition_date,
        acquisitionCost: parseFloat(row.acquisition_cost) || 0,
        currency: row.currency,
        currentValue: parseFloat(row.current_value) || 0,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        invoiceNumber: row.invoice_number,
        serialNumber: row.serial_number,
        brand: row.brand,
        model: row.model,
        status: row.status,
        condition: row.condition,
        lastAuditDate: row.last_audit_date,
        notes: row.notes,
        imageUrl: imageSignedUrl || row.image_url,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        assets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          active: parseInt(statsResult.rows[0].active_count) || 0,
          inRepair: parseInt(statsResult.rows[0].in_repair_count) || 0,
          lost: parseInt(statsResult.rows[0].lost_count) || 0,
          disposed: parseInt(statsResult.rows[0].disposed_count) || 0,
          totalValue: parseFloat(statsResult.rows[0].total_value) || 0
        }
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Assets GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener activos fijos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/fixed-assets
 * Create a new fixed asset
 */
export async function POST(request: NextRequest) {
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

    // Migration: add invoice_image_url column if not exists
    try {
      await db.query(`ALTER TABLE market_fixed_assets ADD COLUMN IF NOT EXISTS invoice_image_url TEXT`)
    } catch { /* column may already exist */ }

    const body = await request.json()
    const {
      name,
      description,
      categoryId,
      assetType,
      warehouseId,
      locationCode,
      responsibleEmployeeId,
      acquisitionDate,
      acquisitionCost,
      currency = 'USD',
      currentValue,
      supplierId,
      invoiceNumber,
      serialNumber,
      brand,
      model,
      status = 'active',
      condition = 'good',
      notes,
      imageUrl,
      invoiceImageUrl
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del activo es requerido'
      }, { status: 400 })
    }

    // Generate asset code
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(asset_code FROM 'ASSET-[0-9]{4}-([0-9]+)') AS INTEGER)
      ), 0) + 1 as next_seq
      FROM market_fixed_assets
      WHERE company_id = $1
      AND asset_code LIKE $2
    `, [payload.companyId, `ASSET-${year}-%`])

    const nextSeq = seqResult.rows[0].next_seq || 1
    const assetCode = `ASSET-${year}-${String(nextSeq).padStart(4, '0')}`

    // Generate barcode (asset code without dashes for scanner compatibility)
    const barcode = assetCode.replace(/-/g, '')

    // Insert asset
    const insertResult = await db.query(`
      INSERT INTO market_fixed_assets (
        company_id, asset_code, barcode, name, description,
        category_id, asset_type, warehouse_id, location_code,
        responsible_employee_id, acquisition_date, acquisition_cost,
        currency, current_value, supplier_id, invoice_number,
        serial_number, brand, model, status, condition,
        notes, image_url, invoice_image_url, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25
      )
      RETURNING id
    `, [
      payload.companyId,
      assetCode,
      barcode,
      name,
      description || null,
      categoryId || null,
      assetType || null,
      warehouseId || null,
      locationCode || null,
      responsibleEmployeeId || null,
      acquisitionDate || null,
      acquisitionCost || null,
      currency,
      currentValue || acquisitionCost || null,
      supplierId || null,
      invoiceNumber || null,
      serialNumber || null,
      brand || null,
      model || null,
      status,
      condition,
      notes || null,
      imageUrl || null,
      invoiceImageUrl || null,
      payload.userId
    ])

    const assetId = insertResult.rows[0].id

    // Create initial movement record (creation)
    await db.query(`
      INSERT INTO market_fixed_asset_movements (
        asset_id, company_id, movement_type,
        to_warehouse_id, to_location, to_responsible_id, to_status,
        reason, created_by
      ) VALUES (
        $1, $2, 'creation',
        $3, $4, $5, $6,
        'Registro inicial del activo', $7
      )
    `, [
      assetId,
      payload.companyId,
      warehouseId || null,
      locationCode || null,
      responsibleEmployeeId || null,
      status,
      payload.userId
    ])

    // Fetch complete asset data
    const assetResult = await db.query(`
      SELECT
        a.*,
        c.name as category_name,
        w.name as warehouse_name,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email) as responsible_name
      FROM market_fixed_assets a
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      LEFT JOIN users eu ON e.user_id = eu.id
      WHERE a.id = $1
    `, [assetId])

    const asset = assetResult.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Activo creado exitosamente',
      data: {
        id: asset.id,
        assetCode: asset.asset_code,
        barcode: asset.barcode,
        name: asset.name,
        description: asset.description,
        categoryId: asset.category_id,
        categoryName: asset.category_name,
        assetType: asset.asset_type,
        warehouseId: asset.warehouse_id,
        warehouseName: asset.warehouse_name,
        locationCode: asset.location_code,
        responsibleEmployeeId: asset.responsible_employee_id,
        responsibleName: asset.responsible_name,
        acquisitionDate: asset.acquisition_date,
        acquisitionCost: parseFloat(asset.acquisition_cost) || 0,
        currency: asset.currency,
        currentValue: parseFloat(asset.current_value) || 0,
        status: asset.status,
        condition: asset.condition,
        createdAt: asset.created_at
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Assets POST] Error:', err)

    // Check for unique constraint violations
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un activo con ese código o código de barras'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear activo fijo'
    }, { status: 500 })
  }
}
