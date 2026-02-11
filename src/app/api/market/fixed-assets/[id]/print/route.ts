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
 * POST /api/market/fixed-assets/[id]/print
 * Queue a print job for the asset label (2x1" with Code128 barcode)
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
    const assetId = parseInt(id)

    if (isNaN(assetId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de activo inválido'
      }, { status: 400 })
    }

    // Get asset with related data
    const assetResult = await db.query(`
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
      printerName,
      copies = 1,
      serviceCode
    } = body

    if (!serviceCode) {
      return NextResponse.json({
        success: false,
        error: 'serviceCode es requerido para imprimir'
      }, { status: 400 })
    }

    // Generate job number
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const day = String(new Date().getDate()).padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    const jobNumber = `ASSET-${year}${month}${day}-${random}`

    // Prepare label data
    const labelData = {
      assetCode: asset.asset_code,
      assetName: asset.name,
      barcode: asset.barcode,
      location: asset.warehouse_name
        ? `${asset.warehouse_name}${asset.location_code ? ` / ${asset.location_code}` : ''}`
        : asset.location_code || '',
      value: parseFloat(asset.acquisition_cost) || 0,
      currency: asset.currency || 'USD',
      responsibleName: asset.responsible_name || '',
      categoryName: asset.category_name || '',
      serialNumber: asset.serial_number || ''
    }

    // Create print job
    const jobResult = await db.query(`
      INSERT INTO market_print_jobs (
        company_id, service_code, job_number, document_type,
        document_data, printer_name, copies, priority, status,
        created_by, created_at
      ) VALUES ($1, $2, $3, 'asset_label', $4, $5, $6, 5, 'pending', $7, NOW())
      RETURNING id, job_number
    `, [
      payload.companyId,
      serviceCode,
      jobNumber,
      JSON.stringify(labelData),
      printerName || null,
      copies,
      payload.userId
    ])

    return NextResponse.json({
      success: true,
      message: 'Trabajo de impresión creado exitosamente',
      data: {
        jobId: jobResult.rows[0].id,
        jobNumber: jobResult.rows[0].job_number,
        assetCode: asset.asset_code,
        copies
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Print] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear trabajo de impresión'
    }, { status: 500 })
  }
}
