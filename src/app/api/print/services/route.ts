import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * Generate a unique service code
 */
function generateServiceCode(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `PRS-${year}-${random}`
}

/**
 * Generate secure API credentials
 */
function generateApiCredentials(): { apiKey: string; apiSecret: string; apiSecretHash: string } {
  const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`
  const apiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`
  const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex')

  return { apiKey, apiSecret, apiSecretHash }
}

/**
 * GET /api/print/services
 * List print services for the company
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

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')

    let query = `
      SELECT
        ps.id,
        ps.service_code,
        ps.service_name,
        ps.warehouse_id,
        mw.name as warehouse_name,
        ps.status,
        ps.last_seen_at,
        ps.last_ip_address,
        ps.version,
        ps.platform,
        ps.hostname,
        ps.created_at,
        (SELECT COUNT(*) FROM print_service_printers WHERE print_service_id = ps.id) as printer_count,
        (SELECT COUNT(*) FROM print_service_printers WHERE print_service_id = ps.id AND is_online = true) as online_printer_count
      FROM print_services ps
      LEFT JOIN market_warehouses mw ON ps.warehouse_id = mw.id
      WHERE ps.company_id = $1
    `
    const params: (number | string)[] = [payload.companyId]
    let paramIndex = 2

    if (warehouseId) {
      query += ` AND ps.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    if (status) {
      query += ` AND ps.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ' ORDER BY ps.created_at DESC'

    const result = await db.query(query, params)

    // Fetch printers for all services
    const serviceIds = result.rows.map(row => row.id)
    let printersMap: Record<number, Array<{
      id: number
      printerName: string
      printerId: string
      printerType: string
      isOnline: boolean
      isDefault: boolean
      supportedDocumentTypes: string[]
    }>> = {}

    if (serviceIds.length > 0) {
      const printersResult = await db.query(`
        SELECT
          id,
          print_service_id,
          printer_name,
          printer_id,
          printer_type,
          is_online,
          is_default,
          supported_document_types
        FROM print_service_printers
        WHERE print_service_id = ANY($1)
        ORDER BY is_default DESC, printer_name ASC
      `, [serviceIds])

      // Group printers by service ID
      for (const printer of printersResult.rows) {
        const serviceId = printer.print_service_id
        if (!printersMap[serviceId]) {
          printersMap[serviceId] = []
        }

        // Parse supported_document_types (could be TEXT[] or JSONB)
        let supportedTypes: string[] = []
        if (printer.supported_document_types) {
          if (Array.isArray(printer.supported_document_types)) {
            supportedTypes = printer.supported_document_types
          } else if (typeof printer.supported_document_types === 'string') {
            try {
              supportedTypes = JSON.parse(printer.supported_document_types)
            } catch {
              supportedTypes = []
            }
          }
        }
        // Default to all types if not set
        if (supportedTypes.length === 0) {
          supportedTypes = ['pos_receipt', 'product_label', 'invoice', 'purchase_invoice', 'sales_report', 'inventory_count_report', 'cash_register_report', 'shipping_label']
        }

        printersMap[serviceId].push({
          id: printer.id,
          printerName: printer.printer_name,
          printerId: printer.printer_id,
          printerType: printer.printer_type,
          isOnline: printer.is_online,
          isDefault: printer.is_default,
          supportedDocumentTypes: supportedTypes
        })
      }
    }

    // Check if services are offline (no heartbeat in 2 minutes)
    const services = result.rows.map(row => {
      const lastSeen = row.last_seen_at ? new Date(row.last_seen_at) : null
      const isOffline = lastSeen && (Date.now() - lastSeen.getTime()) > 2 * 60 * 1000

      return {
        id: row.id,
        serviceCode: row.service_code,
        serviceName: row.service_name,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        status: isOffline && row.status === 'active' ? 'offline' : row.status,
        lastSeenAt: row.last_seen_at,
        lastIpAddress: row.last_ip_address,
        version: row.version,
        platform: row.platform,
        hostname: row.hostname,
        printerCount: parseInt(row.printer_count) || 0,
        onlinePrinterCount: parseInt(row.online_printer_count) || 0,
        printers: printersMap[row.id] || [],
        createdAt: row.created_at
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        services,
        total: services.length
      }
    })

  } catch (error) {
    console.error('[Print Services API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicios de impresión'
    }, { status: 500 })
  }
}

/**
 * POST /api/print/services
 * Create a new print service
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

    // Only ADMIN and SUPER_ADMIN can create print services
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para crear servicios de impresión'
      }, { status: 403 })
    }

    const body = await request.json()
    const { serviceName, warehouseId } = body

    if (!serviceName) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del servicio es requerido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company if provided
    if (warehouseId) {
      const warehouseCheck = await db.query(
        'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
        [warehouseId, payload.companyId]
      )
      if (warehouseCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Almacén no encontrado o no pertenece a la empresa'
        }, { status: 400 })
      }
    }

    // Generate unique service code
    let serviceCode = generateServiceCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.query('SELECT id FROM print_services WHERE service_code = $1', [serviceCode])
      if (existing.rows.length === 0) break
      serviceCode = generateServiceCode()
      attempts++
    }

    // Generate API credentials
    const { apiKey, apiSecret, apiSecretHash } = generateApiCredentials()

    // Create the service
    const result = await db.query(`
      INSERT INTO print_services (
        company_id,
        warehouse_id,
        service_code,
        service_name,
        api_key,
        api_secret_hash,
        status,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())
      RETURNING id
    `, [
      payload.companyId,
      warehouseId || null,
      serviceCode,
      serviceName,
      apiKey,
      apiSecretHash,
      payload.userId
    ])

    const serviceId = result.rows[0].id

    console.log(`[Print Services] Created service ${serviceCode} for company ${payload.companyId}`)

    return NextResponse.json({
      success: true,
      data: {
        id: serviceId,
        serviceCode,
        apiKey,
        apiSecret // Only returned once at creation!
      },
      message: 'Servicio de impresión creado. Guarde las credenciales API de forma segura, no se mostrarán de nuevo.'
    })

  } catch (error) {
    console.error('[Print Services API] Error creating service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear servicio de impresión'
    }, { status: 500 })
  }
}
