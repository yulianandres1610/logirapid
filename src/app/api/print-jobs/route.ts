import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/print-jobs
 *
 * Create a print job from the web app.
 * Body: { documentType, documentData, copies?, warehouseId?, posTerminalId? }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: parse JWT from cookie
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      documentType,
      documentData,
      copies = 1,
      warehouseId = null,
      posTerminalId = null,
    } = body

    if (!documentType || !documentData) {
      return NextResponse.json(
        { success: false, error: 'documentType y documentData son requeridos' },
        { status: 400 }
      )
    }

    // Resolve the best matching print service
    // Priority: 1) exact POS terminal match, 2) exact warehouse match, 3) any service with no location, 4) any active service
    const serviceResult = await db.query(
      `SELECT id, selected_printer, printer_type FROM print_services
       WHERE company_id = $1 AND status = 'active'
       ORDER BY
         CASE
           WHEN pos_terminal_id IS NOT NULL AND pos_terminal_id = $3 THEN 1
           WHEN warehouse_id IS NOT NULL AND warehouse_id = $2 THEN 2
           WHEN warehouse_id IS NULL AND pos_terminal_id IS NULL THEN 3
           ELSE 4
         END,
         last_seen_at DESC NULLS LAST
       LIMIT 1`,
      [companyId, warehouseId, posTerminalId]
    )

    if (serviceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay servicio de impresión activo. Crea uno en Configuración > Impresión.' },
        { status: 404 }
      )
    }

    const service = serviceResult.rows[0]

    // Insert the print job
    const insertResult = await db.query(
      `INSERT INTO print_jobs (service_id, company_id, document_type, document_data, copies, requested_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, created_at`,
      [
        service.id,
        companyId,
        documentType,
        JSON.stringify(documentData),
        copies,
        userId,
      ]
    )

    const job = insertResult.rows[0]
    const jobId = String(job.id)

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        jobNumber: 'PJ-' + jobId.slice(0, 8),
        createdAt: job.created_at,
      },
    })
  } catch (error) {
    console.error('[Print Jobs] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear trabajo de impresión: ' + String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/print-jobs?page=1&limit=10&status=pending&documentType=pos_receipt
 *
 * List print jobs for the authenticated user's company.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: parse JWT from cookie
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const companyId = payload.companyId

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
    const status = searchParams.get('status')
    const documentType = searchParams.get('documentType')
    const offset = (page - 1) * limit

    // Build query with filters
    let whereClause = 'WHERE pj.company_id = $1'
    const params: any[] = [companyId]
    let paramIdx = 2

    if (status) {
      whereClause += ` AND pj.status = $${paramIdx}`
      params.push(status)
      paramIdx++
    }

    if (documentType) {
      whereClause += ` AND pj.document_type = $${paramIdx}`
      params.push(documentType)
      paramIdx++
    }

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM print_jobs pj ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Fetch page
    const jobsResult = await db.query(
      `SELECT pj.id, pj.service_id, pj.document_type, pj.copies, pj.status,
              pj.error_message, pj.requested_by, pj.created_at, pj.updated_at,
              ps.name as service_name
       FROM print_jobs pj
       LEFT JOIN print_services ps ON ps.id = pj.service_id
       ${whereClause}
       ORDER BY pj.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      success: true,
      data: jobsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Print Jobs] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al listar trabajos de impresión: ' + String(error) },
      { status: 500 }
    )
  }
}
