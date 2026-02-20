import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

interface WarehouseQuantities {
  [warehouseId: string]: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Generate next operation number for wholesale delivery
 */
async function generateOperationNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WD-${year}-`

  const result = await db.query(`
    SELECT operation_number FROM market_warehouse_operations
    WHERE company_id = $1 AND operation_number LIKE $2
    ORDER BY operation_number DESC LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].operation_number
    const match = lastNumber.match(/WD-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Generate next delivery number
 */
async function generateDeliveryNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ENT-${year}-`

  const result = await db.query(`
    SELECT delivery_number FROM market_invoice_deliveries
    WHERE delivery_number LIKE $1
    ORDER BY delivery_number DESC LIMIT 1
  `, [`${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].delivery_number
    const match = lastNumber.match(/ENT-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * POST /api/market/wholesale/invoices/[id]/confirm
 * Confirm an invoice (changes status from draft to confirmed)
 * Supports multi-warehouse: creates separate deliveries per warehouse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const invoiceId = parseInt(id)

    // Verify invoice exists and is in draft status
    const checkResult = await db.query(`
      SELECT i.id, i.status, i.invoice_number, i.warehouse_id, i.customer_id,
             w.name as warehouse_name, c.business_name as customer_name, c.address as customer_address
      FROM market_invoices i
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = checkResult.rows[0]

    if (invoice.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'No se pueden confirmar facturas canceladas'
      }, { status: 400 })
    }

    if (invoice.status === 'delivered') {
      return NextResponse.json({
        success: false,
        error: 'Esta factura ya fue entregada'
      }, { status: 400 })
    }

    // Check if deliveries already exist (avoid duplicates)
    const existingDeliveries = await db.query(
      'SELECT id FROM market_invoice_deliveries WHERE invoice_id = $1',
      [invoiceId]
    )
    if (existingDeliveries.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Esta factura ya tiene entregas creadas'
      }, { status: 400 })
    }

    // Get invoice lines with warehouse_quantities
    const linesResult = await db.query(`
      SELECT il.*, p.name as product_name, p.sku as product_sku, p.barcode
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
    `, [invoiceId])

    // Determine if this is multi-warehouse (has warehouse_quantities data)
    const isMultiWarehouse = linesResult.rows.some(line => {
      const wq = line.warehouse_quantities
      if (!wq || typeof wq !== 'object') return false
      const quantities = wq as WarehouseQuantities
      return Object.keys(quantities).length > 0 && Object.values(quantities).some(q => q > 0)
    })

    // Collect all warehouse IDs involved
    const warehouseIds = new Set<number>()

    if (isMultiWarehouse) {
      // Multi-warehouse mode: collect warehouses from line quantities
      for (const line of linesResult.rows) {
        const wq = line.warehouse_quantities as WarehouseQuantities || {}
        for (const [warehouseIdStr, qty] of Object.entries(wq)) {
          if (qty > 0) {
            warehouseIds.add(parseInt(warehouseIdStr))
          }
        }
      }

      if (warehouseIds.size === 0) {
        return NextResponse.json({
          success: false,
          error: 'No se especificaron cantidades por almacén para los productos'
        }, { status: 400 })
      }
    } else {
      // Single warehouse mode (legacy)
      if (!invoice.warehouse_id) {
        return NextResponse.json({
          success: false,
          error: 'Debe seleccionar un almacén para confirmar la factura'
        }, { status: 400 })
      }
      warehouseIds.add(invoice.warehouse_id)
    }

    // Get warehouse names for response
    const warehouseResult = await db.query(`
      SELECT id, name FROM market_warehouses WHERE id = ANY($1)
    `, [Array.from(warehouseIds)])
    const warehouseNames = new Map<number, string>()
    for (const row of warehouseResult.rows) {
      warehouseNames.set(row.id, row.name)
    }

    // Verify stock availability per warehouse
    const insufficientStock: Array<{
      product: string
      warehouseName: string
      required: number
      available: number
      onHand: number
      reserved: number
    }> = []

    for (const line of linesResult.rows) {
      if (isMultiWarehouse) {
        // Check stock for each warehouse quantity
        const wq = line.warehouse_quantities as WarehouseQuantities || {}
        for (const [warehouseIdStr, qty] of Object.entries(wq)) {
          if (qty <= 0) continue
          const warehouseId = parseInt(warehouseIdStr)

          const stockResult = await db.query(`
            SELECT
              COALESCE(quantity_on_hand, 0) as on_hand,
              COALESCE(quantity_reserved, 0) as reserved
            FROM market_warehouse_stock
            WHERE warehouse_id = $1 AND product_id = $2
            ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
          `, line.variant_id
            ? [warehouseId, line.product_id, line.variant_id]
            : [warehouseId, line.product_id]
          )

          const onHand = parseFloat(stockResult.rows[0]?.on_hand) || 0
          const reserved = parseFloat(stockResult.rows[0]?.reserved) || 0
          const available = onHand - reserved

          if (available < qty) {
            insufficientStock.push({
              product: line.product_name,
              warehouseName: warehouseNames.get(warehouseId) || `Almacén ${warehouseId}`,
              required: qty,
              available: available,
              onHand: onHand,
              reserved: reserved
            })
          }
        }
      } else {
        // Legacy single warehouse check
        const stockResult = await db.query(`
          SELECT
            COALESCE(quantity_on_hand, 0) as on_hand,
            COALESCE(quantity_reserved, 0) as reserved
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
          ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
        `, line.variant_id
          ? [invoice.warehouse_id, line.product_id, line.variant_id]
          : [invoice.warehouse_id, line.product_id]
        )

        const onHand = parseFloat(stockResult.rows[0]?.on_hand) || 0
        const reserved = parseFloat(stockResult.rows[0]?.reserved) || 0
        const available = onHand - reserved
        const required = parseFloat(line.quantity)

        if (available < required) {
          insufficientStock.push({
            product: line.product_name,
            warehouseName: invoice.warehouse_name || 'Almacén',
            required: required,
            available: available,
            onHand: onHand,
            reserved: reserved
          })
        }
      }
    }

    if (insufficientStock.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Stock insuficiente para algunos productos',
        data: { insufficientStock }
      }, { status: 400 })
    }

    // Start transaction
    await db.query('BEGIN')

    try {
      // 1. Confirm invoice (preserve confirmed_at if already set)
      await db.query(`
        UPDATE market_invoices SET
          status = 'confirmed',
          confirmed_at = COALESCE(confirmed_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
      `, [invoiceId])

      const createdDeliveries: Array<{
        deliveryId: number
        deliveryNumber: string
        operationId: number
        warehouseId: number
        warehouseName: string
        operationNumber: string
        productCount: number
      }> = []

      if (isMultiWarehouse) {
        // Multi-warehouse: create delivery per warehouse
        // Group lines by warehouse
        const linesByWarehouse = new Map<number, Array<{
          lineId: number
          productId: number
          variantId: number | null
          productName: string
          quantity: number
        }>>()

        for (const line of linesResult.rows) {
          const wq = line.warehouse_quantities as WarehouseQuantities || {}
          for (const [warehouseIdStr, qty] of Object.entries(wq)) {
            if (qty <= 0) continue
            const warehouseId = parseInt(warehouseIdStr)

            if (!linesByWarehouse.has(warehouseId)) {
              linesByWarehouse.set(warehouseId, [])
            }
            linesByWarehouse.get(warehouseId)!.push({
              lineId: line.id,
              productId: line.product_id,
              variantId: line.variant_id,
              productName: line.product_name,
              quantity: qty
            })

            // Reserve stock in this warehouse
            const stockCheck = await db.query(`
              SELECT id FROM market_warehouse_stock
              WHERE warehouse_id = $1 AND product_id = $2
              ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
            `, line.variant_id
              ? [warehouseId, line.product_id, line.variant_id]
              : [warehouseId, line.product_id]
            )

            if (stockCheck.rows.length > 0) {
              await db.query(`
                UPDATE market_warehouse_stock SET
                  quantity_reserved = COALESCE(quantity_reserved, 0) + $1,
                  updated_at = NOW()
                WHERE warehouse_id = $2 AND product_id = $3
                ${line.variant_id ? 'AND variant_id = $4' : 'AND variant_id IS NULL'}
              `, line.variant_id
                ? [qty, warehouseId, line.product_id, line.variant_id]
                : [qty, warehouseId, line.product_id]
              )
            }
          }
        }

        // Create delivery and operation for each warehouse
        for (const [warehouseId, warehouseLines] of linesByWarehouse) {
          const deliveryNumber = await generateDeliveryNumber(payload.companyId)
          const operationNumber = await generateOperationNumber(payload.companyId)

          // Create warehouse operation
          const operationResult = await db.query(`
            INSERT INTO market_warehouse_operations (
              company_id, operation_number, operation_type, status,
              source_warehouse_id, validation_status,
              reference_type, reference_id, reference_number,
              notes, created_by, created_at
            ) VALUES (
              $1, $2, 'wholesale_delivery', 'pending',
              $3, 'pending_validation',
              'wholesale_invoice', $4, $5,
              $6, $7, NOW()
            ) RETURNING id
          `, [
            payload.companyId,
            operationNumber,
            warehouseId,
            invoiceId,
            invoice.invoice_number,
            `Entrega mayorista - Cliente: ${invoice.customer_name}`,
            payload.userId
          ])

          const operationId = operationResult.rows[0].id

          // Create delivery record
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
            `Entrega desde ${warehouseNames.get(warehouseId) || 'almacén'}`,
            payload.userId
          ])

          const deliveryId = deliveryResult.rows[0].id

          // Create delivery lines and operation lines
          for (const lineItem of warehouseLines) {
            // Delivery line
            await db.query(`
              INSERT INTO market_invoice_delivery_lines (
                delivery_id, invoice_line_id, product_id, variant_id,
                quantity_to_deliver, quantity_delivered, created_at
              ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
            `, [
              deliveryId,
              lineItem.lineId,
              lineItem.productId,
              lineItem.variantId,
              lineItem.quantity
            ])

            // Operation line
            await db.query(`
              INSERT INTO market_warehouse_operation_lines (
                operation_id, product_id, variant_id,
                quantity_planned, quantity_validated,
                created_at
              ) VALUES ($1, $2, $3, $4, 0, NOW())
            `, [operationId, lineItem.productId, lineItem.variantId, lineItem.quantity])
          }

          createdDeliveries.push({
            deliveryId,
            deliveryNumber,
            operationId,
            warehouseId,
            warehouseName: warehouseNames.get(warehouseId) || 'Almacén',
            operationNumber,
            productCount: warehouseLines.length
          })
        }
      } else {
        // Legacy single warehouse mode
        const operationNumber = await generateOperationNumber(payload.companyId)
        const deliveryNumber = await generateDeliveryNumber(payload.companyId)

        // Reserve stock for each line
        for (const line of linesResult.rows) {
          const stockCheck = await db.query(`
            SELECT id FROM market_warehouse_stock
            WHERE warehouse_id = $1 AND product_id = $2
            ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
          `, line.variant_id
            ? [invoice.warehouse_id, line.product_id, line.variant_id]
            : [invoice.warehouse_id, line.product_id]
          )

          if (stockCheck.rows.length > 0) {
            await db.query(`
              UPDATE market_warehouse_stock SET
                quantity_reserved = COALESCE(quantity_reserved, 0) + $1,
                updated_at = NOW()
              WHERE warehouse_id = $2 AND product_id = $3
              ${line.variant_id ? 'AND variant_id = $4' : 'AND variant_id IS NULL'}
            `, line.variant_id
              ? [line.quantity, invoice.warehouse_id, line.product_id, line.variant_id]
              : [line.quantity, invoice.warehouse_id, line.product_id]
            )
          }
        }

        // Create warehouse operation
        const operationResult = await db.query(`
          INSERT INTO market_warehouse_operations (
            company_id, operation_number, operation_type, status,
            source_warehouse_id, validation_status,
            reference_type, reference_id, reference_number,
            notes, created_by, created_at
          ) VALUES (
            $1, $2, 'wholesale_delivery', 'pending',
            $3, 'pending_validation',
            'wholesale_invoice', $4, $5,
            $6, $7, NOW()
          ) RETURNING id
        `, [
          payload.companyId,
          operationNumber,
          invoice.warehouse_id,
          invoiceId,
          invoice.invoice_number,
          `Entrega mayorista - Cliente: ${invoice.customer_name}`,
          payload.userId
        ])

        const operationId = operationResult.rows[0].id

        // Create delivery record
        const deliveryResult = await db.query(`
          INSERT INTO market_invoice_deliveries (
            invoice_id, delivery_number, warehouse_id, operation_id,
            status, delivery_address, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW())
          RETURNING id
        `, [
          invoiceId,
          deliveryNumber,
          invoice.warehouse_id,
          operationId,
          invoice.customer_address || null,
          `Entrega desde ${invoice.warehouse_name || 'almacén'}`,
          payload.userId
        ])

        const deliveryId = deliveryResult.rows[0].id

        // Create operation lines and delivery lines
        for (const line of linesResult.rows) {
          await db.query(`
            INSERT INTO market_warehouse_operation_lines (
              operation_id, product_id, variant_id,
              quantity_planned, quantity_validated,
              created_at
            ) VALUES ($1, $2, $3, $4, 0, NOW())
          `, [operationId, line.product_id, line.variant_id, line.quantity])

          await db.query(`
            INSERT INTO market_invoice_delivery_lines (
              delivery_id, invoice_line_id, product_id, variant_id,
              quantity_to_deliver, quantity_delivered, created_at
            ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
          `, [
            deliveryId,
            line.id,
            line.product_id,
            line.variant_id,
            line.quantity
          ])
        }

        createdDeliveries.push({
          deliveryId,
          deliveryNumber,
          operationId,
          warehouseId: invoice.warehouse_id,
          warehouseName: invoice.warehouse_name || 'Almacén',
          operationNumber,
          productCount: linesResult.rows.length
        })
      }

      // Update customer balance
      const invoiceTotal = await db.query(
        'SELECT total_amount FROM market_invoices WHERE id = $1',
        [invoiceId]
      )
      const { total_amount } = invoiceTotal.rows[0]

      await db.query(`
        UPDATE market_wholesale_customers SET
          current_balance = current_balance + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [total_amount, invoice.customer_id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Factura ${invoice.invoice_number} confirmada exitosamente`,
        data: {
          invoiceNumber: invoice.invoice_number,
          deliveries: createdDeliveries,
          isMultiWarehouse,
          totalDeliveries: createdDeliveries.length
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Wholesale Invoice Confirm] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar factura'
    }, { status: 500 })
  }
}
