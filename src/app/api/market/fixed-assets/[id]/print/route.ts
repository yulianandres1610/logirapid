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
 * Generate a unique job number
 */
function generateJobNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `PRJ-${year}-${random}`
}

/**
 * POST /api/market/fixed-assets/[id]/print
 * Queue a print job for the asset label using the unified print system
 * Supports label sizes: 3x2" (76x51mm) and 2x1" (51x25mm)
 * Compatible with Zebra (ZPL) and 4barcode printers
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { id } = await params
    const assetId = parseInt(id)

    if (isNaN(assetId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de activo invalido'
      }, { status: 400 })
    }

    // Get asset with related data
    const assetResult = await db.query(`
      SELECT
        a.*,
        c.name as category_name,
        c.code as category_code,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email, 'Sin asignar') as responsible_name,
        s.name as supplier_name
      FROM market_fixed_assets a
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_employees e ON a.responsible_employee_id = e.id
      LEFT JOIN users eu ON e.user_id = eu.id
      LEFT JOIN market_suppliers s ON a.supplier_id = s.id
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
        error: 'No tiene permisos para imprimir este activo'
      }, { status: 403 })
    }

    // Get print options from request body
    const body = await request.json().catch(() => ({}))
    const {
      printServiceId,
      printerId,
      labelSize = '3x2',
      copies = 1
    } = body

    // Validate label size
    if (!['3x2', '2x1'].includes(labelSize)) {
      return NextResponse.json({
        success: false,
        error: 'Tamano de etiqueta invalido. Use "3x2" o "2x1"'
      }, { status: 400 })
    }

    // Validate copies
    const numCopies = Math.min(Math.max(1, parseInt(copies) || 1), 99)

    // Verify print service belongs to company if provided
    let resolvedServiceId = printServiceId
    let resolvedPrinterId = printerId

    if (resolvedServiceId) {
      const serviceCheck = await db.query(
        `SELECT id, status FROM print_services
         WHERE id = $1 AND company_id = $2 AND status IN ('active', 'pending')`,
        [resolvedServiceId, payload.companyId]
      )
      if (serviceCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Servicio de impresion no encontrado o no esta activo'
        }, { status: 400 })
      }
    }

    // Build location string
    const location = asset.warehouse_name
      ? `${asset.warehouse_name}${asset.location_code ? ` / ${asset.location_code}` : ''}`
      : asset.location_code || ''

    // Prepare label data
    const labelData = {
      assetCode: asset.asset_code,
      assetName: asset.name,
      barcode: asset.barcode,
      barcodeFormat: 'CODE128',
      labelSize,
      location,
      warehouseName: asset.warehouse_name || '',
      warehouseCode: asset.warehouse_code || '',
      locationCode: asset.location_code || '',
      value: parseFloat(asset.acquisition_cost) || 0,
      currentValue: parseFloat(asset.current_value) || parseFloat(asset.acquisition_cost) || 0,
      currency: asset.currency || 'USD',
      responsibleName: asset.responsible_name || '',
      categoryName: asset.category_name || '',
      categoryCode: asset.category_code || '',
      serialNumber: asset.serial_number || '',
      brand: asset.brand || '',
      model: asset.model || '',
      acquisitionDate: asset.acquisition_date,
      status: asset.status,
      condition: asset.condition,
      // Label dimensions in mm
      labelWidth: labelSize === '3x2' ? 76 : 51,
      labelHeight: labelSize === '3x2' ? 51 : 25
    }

    // Generate unique job number
    let jobNumber = generateJobNumber()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.query('SELECT id FROM print_jobs WHERE job_number = $1', [jobNumber])
      if (existing.rows.length === 0) break
      jobNumber = generateJobNumber()
      attempts++
    }

    // Create the job using the unified print_jobs table
    const result = await db.query(`
      INSERT INTO print_jobs (
        job_number,
        company_id,
        print_service_id,
        printer_id,
        document_type,
        source_type,
        source_id,
        document_data,
        copies,
        priority,
        status,
        requested_by,
        created_at
      ) VALUES ($1, $2, $3, $4, 'asset_label', 'fixed_asset', $5, $6, $7, 5, 'pending', $8, NOW())
      RETURNING id, job_number
    `, [
      jobNumber,
      payload.companyId,
      resolvedServiceId || null,
      resolvedPrinterId || null,
      assetId,
      JSON.stringify(labelData),
      numCopies,
      payload.userId
    ])

    const jobId = result.rows[0].id

    // Log job creation in print_job_history
    await db.query(`
      INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
      VALUES ($1, 'created', $2, NOW())
    `, [jobId, JSON.stringify({
      requestedBy: payload.email,
      documentType: 'asset_label',
      labelSize,
      copies: numCopies,
      assetCode: asset.asset_code
    })])

    // Log label print in asset movements history
    await db.query(`
      INSERT INTO market_fixed_asset_movements (
        asset_id,
        company_id,
        movement_type,
        reason,
        created_by,
        created_at
      ) VALUES ($1, $2, 'label_printed', $3, $4, NOW())
    `, [
      assetId,
      payload.companyId,
      `Etiqueta impresa (${labelSize}", ${numCopies} ${numCopies === 1 ? 'copia' : 'copias'}) - Job: ${jobNumber}`,
      payload.userId
    ])

    console.log(`[Fixed Asset Print] Created job ${jobNumber} for asset ${asset.asset_code}, size: ${labelSize}, copies: ${numCopies}`)

    return NextResponse.json({
      success: true,
      message: 'Trabajo de impresion creado exitosamente',
      data: {
        jobId,
        jobNumber,
        assetCode: asset.asset_code,
        labelSize,
        copies: numCopies,
        printServiceId: resolvedServiceId,
        printerId: resolvedPrinterId,
        status: 'pending'
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Print] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear trabajo de impresion'
    }, { status: 500 })
  }
}
