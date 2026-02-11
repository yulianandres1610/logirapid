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
 * GET /api/market/fixed-assets/audits/[id]
 * Get audit details with all scanned items and pending assets
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
    const auditId = parseInt(id)

    if (isNaN(auditId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de auditoría inválido'
      }, { status: 400 })
    }

    // Get audit with related data
    const auditResult = await db.query(`
      SELECT
        a.*,
        w.name as warehouse_name,
        c.name as category_name,
        cu.firstname || ' ' || cu.lastname as created_by_name,
        cou.firstname || ' ' || cou.lastname as completed_by_name,
        apu.firstname || ' ' || apu.lastname as approved_by_name
      FROM market_fixed_asset_audits a
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN users cu ON a.created_by = cu.id
      LEFT JOIN users cou ON a.completed_by = cou.id
      LEFT JOIN users apu ON a.approved_by = apu.id
      WHERE a.id = $1
    `, [auditId])

    if (auditResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Auditoría no encontrada'
      }, { status: 404 })
    }

    const audit = auditResult.rows[0]

    // Check permissions
    if (payload.role !== 'SUPER_ADMIN' && audit.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para ver esta auditoría'
      }, { status: 403 })
    }

    // Get scanned lines
    const linesResult = await db.query(`
      SELECT
        l.*,
        fa.asset_code,
        fa.name as asset_name,
        fa.barcode as registered_barcode,
        fa.location_code as registered_location,
        fa.warehouse_id as registered_warehouse_id,
        rw.name as registered_warehouse_name,
        fw.name as found_warehouse_name,
        u.firstname || ' ' || u.lastname as scanned_by_name
      FROM market_fixed_asset_audit_lines l
      LEFT JOIN market_fixed_assets fa ON l.asset_id = fa.id
      LEFT JOIN market_warehouses rw ON fa.warehouse_id = rw.id
      LEFT JOIN market_warehouses fw ON l.found_warehouse_id = fw.id
      LEFT JOIN users u ON l.scanned_by = u.id
      WHERE l.audit_id = $1
      ORDER BY l.scanned_at DESC
    `, [auditId])

    // Get scanned asset IDs
    const scannedAssetIds = linesResult.rows
      .filter(l => l.asset_id)
      .map(l => l.asset_id)

    // Get pending assets (not yet scanned)
    let pendingConditions = [
      'company_id = $1',
      "status != 'disposed'"
    ]
    const pendingParams: (number | string | number[])[] = [audit.company_id]

    if (audit.warehouse_id) {
      pendingConditions.push(`warehouse_id = $${pendingParams.length + 1}`)
      pendingParams.push(audit.warehouse_id)
    }

    if (audit.category_id) {
      pendingConditions.push(`category_id = $${pendingParams.length + 1}`)
      pendingParams.push(audit.category_id)
    }

    if (scannedAssetIds.length > 0) {
      pendingConditions.push(`id != ALL($${pendingParams.length + 1}::int[])`)
      pendingParams.push(scannedAssetIds)
    }

    const pendingResult = await db.query(`
      SELECT
        a.id, a.asset_code, a.barcode, a.name,
        a.warehouse_id, a.location_code, a.status, a.condition,
        w.name as warehouse_name,
        e.first_name || ' ' || e.last_name as responsible_name
      FROM market_fixed_assets a
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      WHERE ${pendingConditions.join(' AND ')}
      ORDER BY a.asset_code
    `, pendingParams)

    return NextResponse.json({
      success: true,
      data: {
        audit: {
          id: audit.id,
          companyId: audit.company_id,
          auditNumber: audit.audit_number,
          auditDate: audit.audit_date,
          warehouseId: audit.warehouse_id,
          warehouseName: audit.warehouse_name,
          categoryId: audit.category_id,
          categoryName: audit.category_name,
          totalAssets: audit.total_assets,
          assetsFound: audit.assets_found,
          assetsMissing: audit.assets_missing,
          assetsSurplus: audit.assets_surplus,
          status: audit.status,
          createdBy: audit.created_by,
          createdByName: audit.created_by_name,
          completedBy: audit.completed_by,
          completedByName: audit.completed_by_name,
          approvedBy: audit.approved_by,
          approvedByName: audit.approved_by_name,
          createdAt: audit.created_at,
          completedAt: audit.completed_at,
          approvedAt: audit.approved_at,
          notes: audit.notes
        },
        scannedItems: linesResult.rows.map(l => ({
          id: l.id,
          assetId: l.asset_id,
          assetCode: l.asset_code,
          assetName: l.asset_name,
          scannedBarcode: l.scanned_barcode,
          registeredBarcode: l.registered_barcode,
          scanStatus: l.scan_status,
          registeredLocation: l.registered_location,
          registeredWarehouseId: l.registered_warehouse_id,
          registeredWarehouseName: l.registered_warehouse_name,
          foundLocation: l.found_location,
          foundWarehouseId: l.found_warehouse_id,
          foundWarehouseName: l.found_warehouse_name,
          observedCondition: l.observed_condition,
          scannedBy: l.scanned_by,
          scannedByName: l.scanned_by_name,
          scannedAt: l.scanned_at,
          notes: l.notes
        })),
        pendingAssets: pendingResult.rows.map(a => ({
          id: a.id,
          assetCode: a.asset_code,
          barcode: a.barcode,
          name: a.name,
          warehouseId: a.warehouse_id,
          warehouseName: a.warehouse_name,
          locationCode: a.location_code,
          status: a.status,
          condition: a.condition,
          responsibleName: a.responsible_name
        })),
        summary: {
          totalExpected: audit.total_assets,
          found: audit.assets_found,
          missing: audit.total_assets - audit.assets_found - audit.assets_missing,
          markedMissing: audit.assets_missing,
          surplus: audit.assets_surplus,
          pending: pendingResult.rows.length
        }
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Audit GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener auditoría'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/fixed-assets/audits/[id]
 * Update audit status (complete, approve, etc.)
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
    const auditId = parseInt(id)

    if (isNaN(auditId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de auditoría inválido'
      }, { status: 400 })
    }

    // Check audit exists and permissions
    const existingResult = await db.query(`
      SELECT * FROM market_fixed_asset_audits WHERE id = $1
    `, [auditId])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Auditoría no encontrada'
      }, { status: 404 })
    }

    const existing = existingResult.rows[0]

    if (payload.role !== 'SUPER_ADMIN' && existing.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para modificar esta auditoría'
      }, { status: 403 })
    }

    const body = await request.json()
    const { action, notes } = body

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Acción requerida'
      }, { status: 400 })
    }

    switch (action) {
      case 'complete': {
        if (existing.status !== 'in_progress') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden completar auditorías en progreso'
          }, { status: 400 })
        }

        // Calculate final counts
        const countsResult = await db.query(`
          SELECT
            COUNT(CASE WHEN scan_status = 'found' THEN 1 END) as found,
            COUNT(CASE WHEN scan_status = 'missing' THEN 1 END) as missing,
            COUNT(CASE WHEN scan_status = 'surplus' THEN 1 END) as surplus
          FROM market_fixed_asset_audit_lines
          WHERE audit_id = $1
        `, [auditId])

        const counts = countsResult.rows[0]

        // Mark remaining as missing
        // Get scanned asset IDs
        const scannedResult = await db.query(`
          SELECT asset_id FROM market_fixed_asset_audit_lines
          WHERE audit_id = $1 AND asset_id IS NOT NULL
        `, [auditId])

        const scannedIds = scannedResult.rows.map(r => r.asset_id)

        // Build conditions for unscanned assets
        let unscannedConditions = [
          'company_id = $1',
          "status != 'disposed'"
        ]
        const unscannedParams: (number | number[])[] = [existing.company_id]

        if (existing.warehouse_id) {
          unscannedConditions.push(`warehouse_id = $${unscannedParams.length + 1}`)
          unscannedParams.push(existing.warehouse_id)
        }

        if (existing.category_id) {
          unscannedConditions.push(`category_id = $${unscannedParams.length + 1}`)
          unscannedParams.push(existing.category_id)
        }

        if (scannedIds.length > 0) {
          unscannedConditions.push(`id != ALL($${unscannedParams.length + 1}::int[])`)
          unscannedParams.push(scannedIds)
        }

        // Get unscanned assets
        const unscannedResult = await db.query(`
          SELECT id, barcode FROM market_fixed_assets
          WHERE ${unscannedConditions.join(' AND ')}
        `, unscannedParams)

        // Add missing lines for unscanned assets
        for (const asset of unscannedResult.rows) {
          await db.query(`
            INSERT INTO market_fixed_asset_audit_lines (
              audit_id, asset_id, scanned_barcode, scan_status,
              scanned_by, notes
            ) VALUES ($1, $2, $3, 'missing', $4, 'No escaneado durante la auditoría')
          `, [auditId, asset.id, asset.barcode, payload.userId])
        }

        const totalMissing = parseInt(counts.missing) + unscannedResult.rows.length

        // Update audit
        await db.query(`
          UPDATE market_fixed_asset_audits SET
            status = 'completed',
            assets_found = $1,
            assets_missing = $2,
            assets_surplus = $3,
            completed_by = $4,
            completed_at = NOW(),
            notes = COALESCE($5, notes)
          WHERE id = $6
        `, [
          parseInt(counts.found),
          totalMissing,
          parseInt(counts.surplus),
          payload.userId,
          notes,
          auditId
        ])

        // Update last_audit_date on assets that were found
        await db.query(`
          UPDATE market_fixed_assets SET
            last_audit_date = $1,
            last_audit_by = $2
          WHERE id IN (
            SELECT asset_id FROM market_fixed_asset_audit_lines
            WHERE audit_id = $3 AND scan_status = 'found' AND asset_id IS NOT NULL
          )
        `, [existing.audit_date, payload.userId, auditId])

        return NextResponse.json({
          success: true,
          message: 'Auditoría completada exitosamente',
          data: {
            status: 'completed',
            assetsFound: parseInt(counts.found),
            assetsMissing: totalMissing,
            assetsSurplus: parseInt(counts.surplus)
          }
        })
      }

      case 'approve': {
        if (existing.status !== 'completed') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden aprobar auditorías completadas'
          }, { status: 400 })
        }

        // Only admins can approve
        if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
          return NextResponse.json({
            success: false,
            error: 'Solo administradores pueden aprobar auditorías'
          }, { status: 403 })
        }

        await db.query(`
          UPDATE market_fixed_asset_audits SET
            status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            notes = COALESCE($2, notes)
          WHERE id = $3
        `, [payload.userId, notes, auditId])

        // Mark missing assets as 'lost'
        await db.query(`
          UPDATE market_fixed_assets SET
            status = 'lost',
            updated_at = NOW()
          WHERE id IN (
            SELECT asset_id FROM market_fixed_asset_audit_lines
            WHERE audit_id = $1 AND scan_status = 'missing' AND asset_id IS NOT NULL
          )
        `, [auditId])

        // Create movement records for lost assets
        const lostAssets = await db.query(`
          SELECT asset_id FROM market_fixed_asset_audit_lines
          WHERE audit_id = $1 AND scan_status = 'missing' AND asset_id IS NOT NULL
        `, [auditId])

        for (const asset of lostAssets.rows) {
          await db.query(`
            INSERT INTO market_fixed_asset_movements (
              asset_id, company_id, movement_type,
              from_status, to_status,
              reason, created_by
            ) VALUES ($1, $2, 'status_change', 'active', 'lost', $3, $4)
          `, [
            asset.asset_id,
            existing.company_id,
            `Marcado como perdido tras auditoría ${existing.audit_number}`,
            payload.userId
          ])
        }

        return NextResponse.json({
          success: true,
          message: 'Auditoría aprobada exitosamente',
          data: {
            status: 'approved',
            lostAssetsCount: lostAssets.rows.length
          }
        })
      }

      case 'cancel': {
        if (existing.status === 'approved') {
          return NextResponse.json({
            success: false,
            error: 'No se pueden cancelar auditorías aprobadas'
          }, { status: 400 })
        }

        // Delete audit lines
        await db.query(`
          DELETE FROM market_fixed_asset_audit_lines WHERE audit_id = $1
        `, [auditId])

        // Delete audit
        await db.query(`
          DELETE FROM market_fixed_asset_audits WHERE id = $1
        `, [auditId])

        return NextResponse.json({
          success: true,
          message: 'Auditoría cancelada exitosamente'
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida'
        }, { status: 400 })
    }

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Audit PUT] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al actualizar auditoría'
    }, { status: 500 })
  }
}
