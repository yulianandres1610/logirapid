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
 * POST /api/market/production/orders/[id]/print
 * Generate print job for production documents (materials delivery or reception)
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

    const companyId = payload.companyId
    const userId = payload.userId
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { documentType, printServiceId, printerId } = body

    // Validate document type
    if (!['materials', 'reception'].includes(documentType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de documento inválido. Usar: "materials" o "reception"'
      }, { status: 400 })
    }

    // Get order details with all related information
    const orderResult = await db.query(`
      SELECT
        po.*,
        c.legalname as company_name,
        c.logo as company_logo,
        sp.name as source_product_name,
        sp.sku as source_product_sku,
        sp.barcode as source_product_barcode,
        sv.variant_name as source_variant_name,
        tp.name as target_product_name,
        tp.sku as target_product_sku,
        tp.barcode as target_product_barcode,
        tv.variant_name as target_variant_name,
        sw.name as source_warehouse_name,
        sw.code as source_warehouse_code,
        tw.name as target_warehouse_name,
        tw.code as target_warehouse_code,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as created_by_name
      FROM market_production_orders po
      LEFT JOIN companies c ON po.company_id = c.id
      LEFT JOIN market_products sp ON po.source_product_id = sp.id
      LEFT JOIN market_product_variants sv ON po.source_variant_id = sv.id
      LEFT JOIN market_products tp ON po.target_product_id = tp.id
      LEFT JOIN market_product_variants tv ON po.target_variant_id = tv.id
      LEFT JOIN market_warehouses sw ON po.source_warehouse_id = sw.id
      LEFT JOIN market_warehouses tw ON po.target_warehouse_id = tw.id
      LEFT JOIN users uc ON po.created_by = uc.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Validate document type based on order status
    if (documentType === 'materials' && order.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'No se puede imprimir documento de materiales para una orden completada'
      }, { status: 400 })
    }

    if (documentType === 'reception' && order.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Solo se puede imprimir documento de recepción para órdenes completadas'
      }, { status: 400 })
    }

    // Get materials for the order
    const materialsResult = await db.query(`
      SELECT
        pm.*,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        v.variant_name,
        w.name as warehouse_name
      FROM market_production_materials pm
      LEFT JOIN market_products p ON pm.product_id = p.id
      LEFT JOIN market_product_variants v ON pm.variant_id = v.id
      LEFT JOIN market_warehouses w ON pm.warehouse_id = w.id
      WHERE pm.production_order_id = $1
      ORDER BY pm.id
    `, [orderId])

    // Build document data in the format expected by the print service generator
    // Using ProductionOrderData interface format
    const documentData = {
      // Order identification
      orderNumber: order.order_number,
      status: order.status || 'pending',
      documentType: documentType, // 'materials' or 'reception'

      // Source product (raw material)
      sourceProduct: {
        id: order.source_product_id,
        name: order.source_product_name + (order.source_variant_name ? ` - ${order.source_variant_name}` : ''),
        sku: order.source_product_sku || ''
      },
      sourceWarehouse: {
        id: order.source_warehouse_id,
        name: order.source_warehouse_name || '',
        code: order.source_warehouse_code || ''
      },
      sourceWeightKg: parseFloat(order.source_weight_kg) || 0,
      sourceCostPerKg: parseFloat(order.source_unit_cost) || 0,

      // Materials
      materials: materialsResult.rows.map(m => ({
        productId: m.product_id,
        name: m.product_name + (m.variant_name ? ` - ${m.variant_name}` : ''),
        sku: m.product_sku || '',
        quantity: parseFloat(m.quantity) || 0,
        warehouseName: m.warehouse_name || ''
      })),

      // Target product (manufactured)
      targetProduct: {
        id: order.target_product_id,
        name: order.target_product_name + (order.target_variant_name ? ` - ${order.target_variant_name}` : ''),
        sku: order.target_product_sku || ''
      },
      targetWarehouse: {
        id: order.target_warehouse_id,
        name: order.target_warehouse_name || '',
        code: order.target_warehouse_code || ''
      },
      targetPortionWeightKg: parseFloat(order.target_portion_weight_kg) || 0,
      targetQuantity: parseInt(order.target_quantity) || 0,

      // Calculations
      expectedTotalWeightKg: parseFloat(order.expected_total_weight_kg) || 0,
      wasteSurplusKg: Math.abs(parseFloat(order.waste_surplus_kg) || 0),
      wasteSurplusType: order.waste_surplus_type || 'exact',

      // Costs
      materialsCost: parseFloat(order.materials_cost) || 0,
      laborCost: parseFloat(order.labor_cost) || 0,
      totalCost: parseFloat(order.total_cost) || 0,
      costPerUnit: parseFloat(order.cost_per_unit) || 0,

      // Lot info (for reception document)
      lotNumber: order.lot_number,
      expirationDate: order.expiration_date,

      // Metadata
      notes: order.notes,
      createdAt: order.created_at,
      createdBy: order.created_by_name,

      // Company info
      companyName: order.company_name
    }

    // Generate job number
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    const jobNumber = `PRJ-${year}-${random}`

    // Map document type to print system document type
    const printDocumentType = documentType === 'materials'
      ? 'production_materials_receipt'
      : 'production_reception_receipt'

    // Create print job
    const jobResult = await db.query(`
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
      ) VALUES ($1, $2, $3, $4, $5, 'production_order', $6, $7, 1, 0, 'pending', $8, NOW())
      RETURNING id
    `, [
      jobNumber,
      companyId,
      printServiceId || null,
      printerId || null,
      printDocumentType,
      orderId,
      JSON.stringify(documentData),
      userId
    ])

    const jobId = jobResult.rows[0].id

    // Log job creation
    await db.query(`
      INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
      VALUES ($1, 'created', $2, NOW())
    `, [jobId, JSON.stringify({
      requestedBy: payload.email,
      documentType: printDocumentType,
      orderNumber: order.order_number
    })])

    // Update order to mark document as printed
    const docColumn = documentType === 'materials' ? 'production_doc_printed' : 'reception_doc_printed'
    await db.query(`
      UPDATE market_production_orders
      SET ${docColumn} = true
      WHERE id = $1
    `, [orderId])

    // Log in production log
    await db.query(`
      INSERT INTO market_production_log (
        production_order_id, action, details, performed_by, performed_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      orderId,
      documentType === 'materials' ? 'materials_document_printed' : 'reception_document_printed',
      JSON.stringify({ jobNumber, jobId }),
      userId
    ])

    console.log(`[Production Print] Created job ${jobNumber} for ${printDocumentType}, order: ${order.order_number}`)

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        jobNumber,
        documentType: printDocumentType,
        orderNumber: order.order_number,
        status: 'pending'
      },
      message: documentType === 'materials'
        ? 'Documento de entrega de materiales enviado a imprimir'
        : 'Documento de recepción enviado a imprimir'
    })

  } catch (error) {
    console.error('[Production Print API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear trabajo de impresión'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/production/orders/[id]/print
 * Get print document data (for preview or direct download)
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

    const companyId = payload.companyId
    const { id } = await params
    const orderId = parseInt(id)

    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get('documentType') || 'materials'

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Get order details
    const orderResult = await db.query(`
      SELECT
        po.*,
        c.legalname as company_name,
        c.logo as company_logo,
        sp.name as source_product_name,
        sp.sku as source_product_sku,
        sp.barcode as source_product_barcode,
        sv.variant_name as source_variant_name,
        tp.name as target_product_name,
        tp.sku as target_product_sku,
        tp.barcode as target_product_barcode,
        tv.variant_name as target_variant_name,
        sw.name as source_warehouse_name,
        sw.code as source_warehouse_code,
        tw.name as target_warehouse_name,
        tw.code as target_warehouse_code,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as created_by_name
      FROM market_production_orders po
      LEFT JOIN companies c ON po.company_id = c.id
      LEFT JOIN market_products sp ON po.source_product_id = sp.id
      LEFT JOIN market_product_variants sv ON po.source_variant_id = sv.id
      LEFT JOIN market_products tp ON po.target_product_id = tp.id
      LEFT JOIN market_product_variants tv ON po.target_variant_id = tv.id
      LEFT JOIN market_warehouses sw ON po.source_warehouse_id = sw.id
      LEFT JOIN market_warehouses tw ON po.target_warehouse_id = tw.id
      LEFT JOIN users uc ON po.created_by = uc.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get materials
    const materialsResult = await db.query(`
      SELECT
        pm.*,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        v.variant_name,
        w.name as warehouse_name
      FROM market_production_materials pm
      LEFT JOIN market_products p ON pm.product_id = p.id
      LEFT JOIN market_product_variants v ON pm.variant_id = v.id
      LEFT JOIN market_warehouses w ON pm.warehouse_id = w.id
      WHERE pm.production_order_id = $1
      ORDER BY pm.id
    `, [orderId])

    // Return document data for preview
    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        lotNumber: order.lot_number,
        expirationDate: order.expiration_date,
        companyName: order.company_name,
        sourceProduct: {
          name: order.source_product_name + (order.source_variant_name ? ` - ${order.source_variant_name}` : ''),
          sku: order.source_product_sku,
          barcode: order.source_product_barcode,
          quantity: parseFloat(order.source_quantity) || 1,
          weightKg: parseFloat(order.source_weight_kg)
        },
        targetProduct: {
          name: order.target_product_name + (order.target_variant_name ? ` - ${order.target_variant_name}` : ''),
          sku: order.target_product_sku,
          barcode: order.target_product_barcode,
          quantity: order.actual_quantity || order.target_quantity,
          expectedQuantity: order.target_quantity,
          portionWeightKg: parseFloat(order.target_portion_weight_kg)
        },
        materials: materialsResult.rows.map(m => ({
          name: m.product_name + (m.variant_name ? ` - ${m.variant_name}` : ''),
          sku: m.product_sku,
          barcode: m.product_barcode,
          quantity: parseFloat(m.quantity),
          warehouseName: m.warehouse_name
        })),
        sourceWarehouse: {
          name: order.source_warehouse_name,
          code: order.source_warehouse_code
        },
        targetWarehouse: {
          name: order.target_warehouse_name,
          code: order.target_warehouse_code
        },
        costs: {
          total: parseFloat(order.total_cost) || 0,
          perUnit: parseFloat(order.cost_per_unit) || 0
        },
        createdAt: order.created_at,
        completedAt: order.completed_at,
        createdBy: order.created_by_name
      }
    })

  } catch (error) {
    console.error('[Production Print API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener datos de impresión'
    }, { status: 500 })
  }
}
