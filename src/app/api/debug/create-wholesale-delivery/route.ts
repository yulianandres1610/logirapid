import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/create-wholesale-delivery
 * List confirmed invoices that need delivery operations
 *
 * POST /api/debug/create-wholesale-delivery
 * Create delivery operation for an invoice
 * Body: { invoiceId: number, warehouseId: number }
 */
export async function GET() {
  try {
    // Find confirmed invoices
    const invoicesResult = await db.query(`
      SELECT
        i.id,
        i.invoice_number,
        i.status,
        i.warehouse_id,
        i.customer_id,
        i.total_amount,
        i.created_at,
        i.confirmed_at,
        c.business_name as customer_name,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM market_warehouse_operations WHERE reference_type = 'wholesale_invoice' AND reference_id = i.id) as operations_count
      FROM market_invoices i
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      WHERE i.status = 'confirmed'
      ORDER BY i.created_at DESC
      LIMIT 20
    `)

    // Get lines for each invoice
    const invoices = await Promise.all(
      invoicesResult.rows.map(async (inv) => {
        const linesResult = await db.query(`
          SELECT
            il.id,
            il.product_id,
            il.quantity,
            il.warehouse_quantities,
            p.name as product_name,
            p.sku
          FROM market_invoice_lines il
          JOIN market_products p ON p.id = il.product_id
          WHERE il.invoice_id = $1
        `, [inv.id])

        // Check for operations
        const operationsResult = await db.query(`
          SELECT
            o.id,
            o.operation_number,
            o.status,
            o.validation_status,
            o.source_warehouse_id,
            o.company_id as operation_company_id,
            mw.name as warehouse_name,
            mw.company_id as warehouse_company_id
          FROM market_warehouse_operations o
          LEFT JOIN market_warehouses mw ON mw.id = o.source_warehouse_id
          WHERE o.reference_type = 'wholesale_invoice' AND o.reference_id = $1
        `, [inv.id])

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          status: inv.status,
          warehouseId: inv.warehouse_id,
          warehouseName: inv.warehouse_name,
          customerId: inv.customer_id,
          customerName: inv.customer_name,
          totalAmount: parseFloat(inv.total_amount) || 0,
          createdAt: inv.created_at,
          confirmedAt: inv.confirmed_at,
          operationsCount: parseInt(inv.operations_count) || 0,
          lines: linesResult.rows.map(l => ({
            id: l.id,
            productId: l.product_id,
            productName: l.product_name,
            sku: l.sku,
            quantity: parseFloat(l.quantity) || 0,
            warehouseQuantities: l.warehouse_quantities
          })),
          operations: operationsResult.rows.map(op => ({
            id: op.id,
            operationNumber: op.operation_number,
            status: op.status,
            validationStatus: op.validation_status,
            warehouseId: op.source_warehouse_id,
            warehouseName: op.warehouse_name,
            operationCompanyId: op.operation_company_id,
            warehouseCompanyId: op.warehouse_company_id
          }))
        }
      })
    )

    // Get warehouses
    const warehousesResult = await db.query(`
      SELECT id, name, code, company_id FROM market_warehouses WHERE is_active = true ORDER BY name
    `)

    // Get all pending wholesale_delivery operations (no company filter for debug)
    const pendingOpsResult = await db.query(`
      SELECT
        o.id,
        o.operation_number,
        o.status,
        o.validation_status,
        o.source_warehouse_id,
        o.company_id,
        mw.name as warehouse_name,
        mw.company_id as warehouse_company_id
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses mw ON mw.id = o.source_warehouse_id
      WHERE o.operation_type = 'wholesale_delivery'
        AND o.status = 'pending'
      ORDER BY o.created_at DESC
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        warehouses: warehousesResult.rows.map(w => ({
          id: w.id,
          name: w.name,
          code: w.code,
          companyId: w.company_id
        })),
        pendingWholesaleOperations: pendingOpsResult.rows.map(op => ({
          id: op.id,
          operationNumber: op.operation_number,
          status: op.status,
          validationStatus: op.validation_status,
          warehouseId: op.source_warehouse_id,
          warehouseName: op.warehouse_name,
          operationCompanyId: op.company_id,
          warehouseCompanyId: op.warehouse_company_id
        }))
      }
    })

  } catch (error) {
    console.error('[Debug Create Wholesale Delivery GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, warehouseId } = await request.json() as {
      invoiceId: number
      warehouseId: number
    }

    if (!invoiceId || !warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'invoiceId y warehouseId son requeridos'
      }, { status: 400 })
    }

    // Get a valid user ID
    const userResult = await db.query(`SELECT id FROM users LIMIT 1`)
    const userId = userResult.rows[0]?.id || 1

    // Get invoice
    const invoiceResult = await db.query(`
      SELECT i.*, c.business_name as customer_name, c.address as customer_address
      FROM market_invoices i
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.id = $1
    `, [invoiceId])

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Get warehouse
    const warehouseResult = await db.query(`
      SELECT id, name FROM market_warehouses WHERE id = $1
    `, [warehouseId])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouseName = warehouseResult.rows[0].name

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT il.*, p.name as product_name
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
    `, [invoiceId])

    // Generate operation number
    const year = new Date().getFullYear()
    const operationNumResult = await db.query(`
      SELECT operation_number FROM market_warehouse_operations
      WHERE operation_number LIKE $1
      ORDER BY operation_number DESC LIMIT 1
    `, [`WD-${year}-%`])

    let nextNum = 1
    if (operationNumResult.rows.length > 0) {
      const match = operationNumResult.rows[0].operation_number.match(/WD-\d{4}-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const operationNumber = `WD-${year}-${nextNum.toString().padStart(4, '0')}`

    // Generate delivery number
    const deliveryNumResult = await db.query(`
      SELECT delivery_number FROM market_invoice_deliveries
      WHERE delivery_number LIKE $1
      ORDER BY delivery_number DESC LIMIT 1
    `, [`ENT-${year}-%`])

    let nextDelNum = 1
    if (deliveryNumResult.rows.length > 0) {
      const match = deliveryNumResult.rows[0].delivery_number.match(/ENT-\d{4}-(\d+)/)
      if (match) nextDelNum = parseInt(match[1]) + 1
    }
    const deliveryNumber = `ENT-${year}-${nextDelNum.toString().padStart(4, '0')}`

    // Start transaction
    await db.query('BEGIN')

    try {
      // Create operation
      const operationResult = await db.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type, status,
          source_warehouse_id, validation_status,
          reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES (
          $1, $2, 'wholesale_delivery', 'pending',
          $3, 'pending_validation',
          'wholesale_invoice', $4,
          $5, $6, NOW()
        ) RETURNING id
      `, [
        invoice.company_id,
        operationNumber,
        warehouseId,
        invoiceId,
        `Entrega mayorista manual - Cliente: ${invoice.customer_name} - Almacén: ${warehouseName} - Factura: ${invoice.invoice_number}`,
        userId
      ])

      const operationId = operationResult.rows[0].id

      // Create delivery
      const deliveryResult = await db.query(`
        INSERT INTO market_invoice_deliveries (
          invoice_id, delivery_number, warehouse_id, operation_id,
          status, delivery_address, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW())
        RETURNING id
      `, [
        invoiceId,
        deliveryNumber,
        warehouseId,
        operationId,
        invoice.customer_address || null,
        `Entrega manual desde ${warehouseName}`,
        userId
      ])

      const deliveryId = deliveryResult.rows[0].id

      // Create operation lines and delivery lines
      for (const line of linesResult.rows) {
        // Determine quantity for this warehouse
        let quantity = parseFloat(line.quantity) || 0

        // Check warehouse_quantities if multi-warehouse
        const wq = line.warehouse_quantities
        if (wq && typeof wq === 'object') {
          const whQty = (wq as Record<string, number>)[warehouseId.toString()]
          if (whQty !== undefined) {
            quantity = whQty
          }
        }

        if (quantity <= 0) continue

        // Operation line
        await db.query(`
          INSERT INTO market_warehouse_operation_lines (
            operation_id, product_id, variant_id,
            quantity_planned, quantity_validated,
            created_at
          ) VALUES ($1, $2, $3, $4, 0, NOW())
        `, [operationId, line.product_id, line.variant_id, quantity])

        // Delivery line
        await db.query(`
          INSERT INTO market_invoice_delivery_lines (
            delivery_id, invoice_line_id, product_id, variant_id,
            quantity_to_deliver, quantity_delivered, created_at
          ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
        `, [deliveryId, line.id, line.product_id, line.variant_id, quantity])

        // Reserve stock
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_reserved = COALESCE(quantity_reserved, 0) + $1, updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3
            AND (variant_id = $4 OR (variant_id IS NULL AND $4::int IS NULL))
        `, [quantity, warehouseId, line.product_id, line.variant_id])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Operación de entrega creada exitosamente`,
        data: {
          operationId,
          operationNumber,
          deliveryId,
          deliveryNumber,
          warehouseId,
          warehouseName,
          invoiceId,
          invoiceNumber: invoice.invoice_number
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Debug Create Wholesale Delivery POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear operación'
    }, { status: 500 })
  }
}
