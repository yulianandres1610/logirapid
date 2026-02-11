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
 * GET /api/market/fixed-assets/[id]
 * Get a single fixed asset with its movement history
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
    const assetId = parseInt(id)

    if (isNaN(assetId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de activo inválido'
      }, { status: 400 })
    }

    // Get asset with all related data
    const assetResult = await db.query(`
      SELECT
        a.*,
        c.name as category_name,
        c.code as category_code,
        w.name as warehouse_name,
        e.first_name || ' ' || e.last_name as responsible_name,
        e.position as responsible_position,
        s.name as supplier_name,
        u.firstname || ' ' || u.lastname as created_by_name,
        au.firstname || ' ' || au.lastname as last_audit_by_name
      FROM market_fixed_assets a
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      LEFT JOIN market_suppliers s ON a.supplier_id = s.id
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN users au ON a.last_audit_by = au.id
      WHERE a.id = $1
    `, [assetId])

    if (assetResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activo no encontrado'
      }, { status: 404 })
    }

    const asset = assetResult.rows[0]

    // Check permissions
    if (payload.role !== 'SUPER_ADMIN' && asset.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para ver este activo'
      }, { status: 403 })
    }

    // Get movement history
    const movementsResult = await db.query(`
      SELECT
        m.*,
        fw.name as from_warehouse_name,
        tw.name as to_warehouse_name,
        fe.first_name || ' ' || fe.last_name as from_responsible_name,
        te.first_name || ' ' || te.last_name as to_responsible_name,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM market_fixed_asset_movements m
      LEFT JOIN market_warehouses fw ON m.from_warehouse_id = fw.id
      LEFT JOIN market_warehouses tw ON m.to_warehouse_id = tw.id
      LEFT JOIN market_employees fe ON m.from_responsible_id = fe.id
      LEFT JOIN market_employees te ON m.to_responsible_id = te.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.asset_id = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [assetId])

    // Get audit history
    const auditsResult = await db.query(`
      SELECT
        al.id,
        al.scan_status,
        al.found_location,
        al.observed_condition,
        al.scanned_at,
        al.notes,
        a.audit_number,
        a.audit_date,
        u.firstname || ' ' || u.lastname as scanned_by_name
      FROM market_fixed_asset_audit_lines al
      JOIN market_fixed_asset_audits a ON al.audit_id = a.id
      LEFT JOIN users u ON al.scanned_by = u.id
      WHERE al.asset_id = $1
      ORDER BY al.scanned_at DESC
      LIMIT 20
    `, [assetId])

    return NextResponse.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          companyId: asset.company_id,
          assetCode: asset.asset_code,
          barcode: asset.barcode,
          name: asset.name,
          description: asset.description,
          categoryId: asset.category_id,
          categoryName: asset.category_name,
          categoryCode: asset.category_code,
          assetType: asset.asset_type,
          warehouseId: asset.warehouse_id,
          warehouseName: asset.warehouse_name,
          locationCode: asset.location_code,
          responsibleEmployeeId: asset.responsible_employee_id,
          responsibleName: asset.responsible_name,
          responsiblePosition: asset.responsible_position,
          responsibleUserId: asset.responsible_user_id,
          acquisitionDate: asset.acquisition_date,
          acquisitionCost: parseFloat(asset.acquisition_cost) || 0,
          currency: asset.currency,
          currentValue: parseFloat(asset.current_value) || 0,
          supplierId: asset.supplier_id,
          supplierName: asset.supplier_name,
          invoiceNumber: asset.invoice_number,
          serialNumber: asset.serial_number,
          brand: asset.brand,
          model: asset.model,
          status: asset.status,
          condition: asset.condition,
          lastAuditDate: asset.last_audit_date,
          lastAuditByName: asset.last_audit_by_name,
          notes: asset.notes,
          imageUrl: asset.image_url,
          createdBy: asset.created_by,
          createdByName: asset.created_by_name,
          createdAt: asset.created_at,
          updatedAt: asset.updated_at
        },
        movements: movementsResult.rows.map(m => ({
          id: m.id,
          movementType: m.movement_type,
          fromWarehouseId: m.from_warehouse_id,
          fromWarehouseName: m.from_warehouse_name,
          toWarehouseId: m.to_warehouse_id,
          toWarehouseName: m.to_warehouse_name,
          fromLocation: m.from_location,
          toLocation: m.to_location,
          fromResponsibleId: m.from_responsible_id,
          fromResponsibleName: m.from_responsible_name,
          toResponsibleId: m.to_responsible_id,
          toResponsibleName: m.to_responsible_name,
          fromStatus: m.from_status,
          toStatus: m.to_status,
          reason: m.reason,
          createdByName: m.created_by_name,
          createdAt: m.created_at
        })),
        audits: auditsResult.rows.map(a => ({
          id: a.id,
          auditNumber: a.audit_number,
          auditDate: a.audit_date,
          scanStatus: a.scan_status,
          foundLocation: a.found_location,
          observedCondition: a.observed_condition,
          scannedAt: a.scanned_at,
          scannedByName: a.scanned_by_name,
          notes: a.notes
        }))
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener activo'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/fixed-assets/[id]
 * Update a fixed asset
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
    const assetId = parseInt(id)

    if (isNaN(assetId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de activo inválido'
      }, { status: 400 })
    }

    // Check asset exists and permissions
    const existingResult = await db.query(`
      SELECT * FROM market_fixed_assets WHERE id = $1
    `, [assetId])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activo no encontrado'
      }, { status: 404 })
    }

    const existing = existingResult.rows[0]

    if (payload.role !== 'SUPER_ADMIN' && existing.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para editar este activo'
      }, { status: 403 })
    }

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
      currency,
      currentValue,
      supplierId,
      invoiceNumber,
      serialNumber,
      brand,
      model,
      status,
      condition,
      notes,
      imageUrl,
      movementReason
    } = body

    // Check for changes that require movement records
    const hasWarehouseChange = warehouseId !== undefined && warehouseId !== existing.warehouse_id
    const hasLocationChange = locationCode !== undefined && locationCode !== existing.location_code
    const hasResponsibleChange = responsibleEmployeeId !== undefined && responsibleEmployeeId !== existing.responsible_employee_id
    const hasStatusChange = status !== undefined && status !== existing.status

    // Update asset
    await db.query(`
      UPDATE market_fixed_assets SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        asset_type = COALESCE($4, asset_type),
        warehouse_id = COALESCE($5, warehouse_id),
        location_code = COALESCE($6, location_code),
        responsible_employee_id = COALESCE($7, responsible_employee_id),
        acquisition_date = COALESCE($8, acquisition_date),
        acquisition_cost = COALESCE($9, acquisition_cost),
        currency = COALESCE($10, currency),
        current_value = COALESCE($11, current_value),
        supplier_id = COALESCE($12, supplier_id),
        invoice_number = COALESCE($13, invoice_number),
        serial_number = COALESCE($14, serial_number),
        brand = COALESCE($15, brand),
        model = COALESCE($16, model),
        status = COALESCE($17, status),
        condition = COALESCE($18, condition),
        notes = COALESCE($19, notes),
        image_url = COALESCE($20, image_url),
        updated_at = NOW()
      WHERE id = $21
    `, [
      name,
      description,
      categoryId,
      assetType,
      warehouseId,
      locationCode,
      responsibleEmployeeId,
      acquisitionDate,
      acquisitionCost,
      currency,
      currentValue,
      supplierId,
      invoiceNumber,
      serialNumber,
      brand,
      model,
      status,
      condition,
      notes,
      imageUrl,
      assetId
    ])

    // Create movement records for significant changes
    if (hasWarehouseChange || hasLocationChange) {
      await db.query(`
        INSERT INTO market_fixed_asset_movements (
          asset_id, company_id, movement_type,
          from_warehouse_id, to_warehouse_id,
          from_location, to_location,
          reason, created_by
        ) VALUES ($1, $2, 'transfer', $3, $4, $5, $6, $7, $8)
      `, [
        assetId,
        existing.company_id,
        existing.warehouse_id,
        warehouseId || existing.warehouse_id,
        existing.location_code,
        locationCode || existing.location_code,
        movementReason || 'Transferencia de ubicación',
        payload.userId
      ])
    }

    if (hasResponsibleChange) {
      await db.query(`
        INSERT INTO market_fixed_asset_movements (
          asset_id, company_id, movement_type,
          from_responsible_id, to_responsible_id,
          reason, created_by
        ) VALUES ($1, $2, 'assignment', $3, $4, $5, $6)
      `, [
        assetId,
        existing.company_id,
        existing.responsible_employee_id,
        responsibleEmployeeId,
        movementReason || 'Cambio de responsable',
        payload.userId
      ])
    }

    if (hasStatusChange) {
      await db.query(`
        INSERT INTO market_fixed_asset_movements (
          asset_id, company_id, movement_type,
          from_status, to_status,
          reason, created_by
        ) VALUES ($1, $2, 'status_change', $3, $4, $5, $6)
      `, [
        assetId,
        existing.company_id,
        existing.status,
        status,
        movementReason || 'Cambio de estado',
        payload.userId
      ])
    }

    // Fetch updated asset
    const updatedResult = await db.query(`
      SELECT
        a.*,
        c.name as category_name,
        w.name as warehouse_name,
        e.first_name || ' ' || e.last_name as responsible_name
      FROM market_fixed_assets a
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      WHERE a.id = $1
    `, [assetId])

    const updated = updatedResult.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Activo actualizado exitosamente',
      data: {
        id: updated.id,
        assetCode: updated.asset_code,
        barcode: updated.barcode,
        name: updated.name,
        description: updated.description,
        categoryId: updated.category_id,
        categoryName: updated.category_name,
        assetType: updated.asset_type,
        warehouseId: updated.warehouse_id,
        warehouseName: updated.warehouse_name,
        locationCode: updated.location_code,
        responsibleEmployeeId: updated.responsible_employee_id,
        responsibleName: updated.responsible_name,
        status: updated.status,
        condition: updated.condition,
        updatedAt: updated.updated_at
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset PUT] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al actualizar activo'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/fixed-assets/[id]
 * Delete a fixed asset (soft delete by changing status to 'disposed')
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

    // Only admins can delete
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar activos'
      }, { status: 403 })
    }

    const { id } = await params
    const assetId = parseInt(id)

    if (isNaN(assetId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de activo inválido'
      }, { status: 400 })
    }

    // Check asset exists
    const existingResult = await db.query(`
      SELECT * FROM market_fixed_assets WHERE id = $1
    `, [assetId])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activo no encontrado'
      }, { status: 404 })
    }

    const existing = existingResult.rows[0]

    if (payload.role !== 'SUPER_ADMIN' && existing.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar este activo'
      }, { status: 403 })
    }

    // Get reason from request body
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || 'Activo dado de baja'

    // Soft delete - mark as disposed
    await db.query(`
      UPDATE market_fixed_assets
      SET status = 'disposed', updated_at = NOW()
      WHERE id = $1
    `, [assetId])

    // Record movement
    await db.query(`
      INSERT INTO market_fixed_asset_movements (
        asset_id, company_id, movement_type,
        from_status, to_status,
        reason, created_by
      ) VALUES ($1, $2, 'disposal', $3, 'disposed', $4, $5)
    `, [
      assetId,
      existing.company_id,
      existing.status,
      reason,
      payload.userId
    ])

    return NextResponse.json({
      success: true,
      message: 'Activo dado de baja exitosamente'
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset DELETE] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al eliminar activo'
    }, { status: 500 })
  }
}
