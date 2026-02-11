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
 * POST /api/market/fixed-assets/audits/[id]/scan
 * Scan/register an asset during audit
 *
 * Body:
 * - barcode: string (scanned barcode)
 * - assetId?: number (optional, if manually selecting)
 * - foundLocation?: string (where the asset was found)
 * - foundWarehouseId?: number (warehouse where found)
 * - observedCondition?: string ('good', 'fair', 'poor', 'damaged')
 * - notes?: string
 * - markAs?: 'found' | 'missing' (for manual marking)
 */
export async function POST(
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

    // Check audit exists and is in progress
    const auditResult = await db.query(`
      SELECT * FROM market_fixed_asset_audits WHERE id = $1
    `, [auditId])

    if (auditResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Auditoría no encontrada'
      }, { status: 404 })
    }

    const audit = auditResult.rows[0]

    if (payload.role !== 'SUPER_ADMIN' && audit.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para esta auditoría'
      }, { status: 403 })
    }

    if (audit.status !== 'in_progress') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden escanear activos en auditorías en progreso'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      barcode,
      assetId,
      foundLocation,
      foundWarehouseId,
      observedCondition,
      notes,
      markAs
    } = body

    if (!barcode && !assetId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere código de barras o ID de activo'
      }, { status: 400 })
    }

    // Find asset by barcode or ID
    let asset = null
    let scanStatus: 'found' | 'missing' | 'surplus' = 'found'

    if (assetId) {
      const assetResult = await db.query(`
        SELECT * FROM market_fixed_assets WHERE id = $1 AND company_id = $2
      `, [assetId, audit.company_id])

      if (assetResult.rows.length > 0) {
        asset = assetResult.rows[0]
      }
    } else if (barcode) {
      // Search by barcode (exact match) or asset_code
      const assetResult = await db.query(`
        SELECT * FROM market_fixed_assets
        WHERE company_id = $1
        AND (barcode = $2 OR asset_code = $2 OR REPLACE(asset_code, '-', '') = $2)
        AND status != 'disposed'
      `, [audit.company_id, barcode])

      if (assetResult.rows.length > 0) {
        asset = assetResult.rows[0]
      }
    }

    // Determine scan status
    if (markAs === 'missing' && asset) {
      scanStatus = 'missing'
    } else if (!asset) {
      // Asset not found in system - surplus/unregistered
      scanStatus = 'surplus'
    } else {
      // Check if asset is within audit scope
      let inScope = true

      if (audit.warehouse_id && asset.warehouse_id !== audit.warehouse_id) {
        // Asset from different warehouse - still mark as found but note the discrepancy
        inScope = true
      }

      if (audit.category_id && asset.category_id !== audit.category_id) {
        // Asset from different category - still mark as found but note the discrepancy
        inScope = true
      }

      scanStatus = 'found'
    }

    // Check if already scanned
    const existingLine = await db.query(`
      SELECT id FROM market_fixed_asset_audit_lines
      WHERE audit_id = $1 AND (
        (asset_id = $2 AND $2 IS NOT NULL)
        OR (scanned_barcode = $3 AND asset_id IS NULL)
      )
    `, [auditId, asset?.id || null, barcode])

    if (existingLine.rows.length > 0) {
      // Update existing line
      await db.query(`
        UPDATE market_fixed_asset_audit_lines SET
          scan_status = $1,
          found_location = COALESCE($2, found_location),
          found_warehouse_id = COALESCE($3, found_warehouse_id),
          observed_condition = COALESCE($4, observed_condition),
          scanned_by = $5,
          scanned_at = NOW(),
          notes = COALESCE($6, notes)
        WHERE id = $7
      `, [
        scanStatus,
        foundLocation,
        foundWarehouseId,
        observedCondition,
        payload.userId,
        notes,
        existingLine.rows[0].id
      ])

      // Update counters
      await updateAuditCounters(auditId)

      return NextResponse.json({
        success: true,
        message: 'Registro actualizado',
        data: {
          lineId: existingLine.rows[0].id,
          assetId: asset?.id,
          assetCode: asset?.asset_code,
          assetName: asset?.name,
          scanStatus,
          isUpdate: true
        }
      })
    }

    // Insert new line
    const insertResult = await db.query(`
      INSERT INTO market_fixed_asset_audit_lines (
        audit_id, asset_id, scanned_barcode, scan_status,
        found_location, found_warehouse_id, observed_condition,
        scanned_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      auditId,
      asset?.id || null,
      barcode || asset?.barcode,
      scanStatus,
      foundLocation || null,
      foundWarehouseId || null,
      observedCondition || null,
      payload.userId,
      notes || null
    ])

    // Update counters
    await updateAuditCounters(auditId)

    // Update asset condition if observed
    if (asset && observedCondition && observedCondition !== asset.condition) {
      await db.query(`
        UPDATE market_fixed_assets SET
          condition = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [observedCondition, asset.id])
    }

    return NextResponse.json({
      success: true,
      message: scanStatus === 'surplus'
        ? 'Activo no registrado en el sistema (surplus)'
        : scanStatus === 'missing'
        ? 'Activo marcado como faltante'
        : 'Activo escaneado exitosamente',
      data: {
        lineId: insertResult.rows[0].id,
        assetId: asset?.id || null,
        assetCode: asset?.asset_code || null,
        assetName: asset?.name || null,
        barcode: barcode || asset?.barcode,
        scanStatus,
        foundLocation,
        observedCondition,
        registeredLocation: asset?.location_code,
        locationMismatch: asset && foundLocation && foundLocation !== asset.location_code,
        conditionMismatch: asset && observedCondition && observedCondition !== asset.condition
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Audit Scan] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al escanear activo'
    }, { status: 500 })
  }
}

/**
 * Helper function to update audit counters
 */
async function updateAuditCounters(auditId: number) {
  await db.query(`
    UPDATE market_fixed_asset_audits SET
      assets_found = (
        SELECT COUNT(*) FROM market_fixed_asset_audit_lines
        WHERE audit_id = $1 AND scan_status = 'found'
      ),
      assets_missing = (
        SELECT COUNT(*) FROM market_fixed_asset_audit_lines
        WHERE audit_id = $1 AND scan_status = 'missing'
      ),
      assets_surplus = (
        SELECT COUNT(*) FROM market_fixed_asset_audit_lines
        WHERE audit_id = $1 AND scan_status = 'surplus'
      )
    WHERE id = $1
  `, [auditId])
}
