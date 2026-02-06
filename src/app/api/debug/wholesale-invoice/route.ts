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
 * GET /api/debug/wholesale-invoice
 * Diagnose wholesale invoice state, operations, and deliveries
 *
 * Query params:
 * - invoiceId: ID of the invoice to debug
 * - invoiceNumber: Alternative - invoice number to debug
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Only admins can debug
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const invoiceNumber = searchParams.get('invoiceNumber')

    if (!invoiceId && !invoiceNumber) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere invoiceId o invoiceNumber'
      }, { status: 400 })
    }

    // Get invoice details
    let invoiceResult
    if (invoiceId) {
      invoiceResult = await db.query(`
        SELECT
          i.id,
          i.invoice_number,
          i.status,
          i.warehouse_id,
          i.customer_id,
          i.subtotal,
          i.tax_amount,
          i.discount_amount,
          i.total_amount,
          i.created_at,
          i.confirmed_at,
          i.completed_at,
          i.company_id,
          w.name as warehouse_name,
          c.business_name as customer_name,
          c.code as customer_code,
          c.address as customer_address
        FROM market_invoices i
        LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
        WHERE i.id = $1 AND i.company_id = $2
      `, [parseInt(invoiceId), payload.companyId])
    } else {
      invoiceResult = await db.query(`
        SELECT
          i.id,
          i.invoice_number,
          i.status,
          i.warehouse_id,
          i.customer_id,
          i.subtotal,
          i.tax_amount,
          i.discount_amount,
          i.total_amount,
          i.created_at,
          i.confirmed_at,
          i.completed_at,
          i.company_id,
          w.name as warehouse_name,
          c.business_name as customer_name,
          c.code as customer_code,
          c.address as customer_address
        FROM market_invoices i
        LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
        WHERE i.invoice_number = $1 AND i.company_id = $2
      `, [invoiceNumber, payload.companyId])
    }

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT
        il.id,
        il.product_id,
        il.variant_id,
        il.quantity,
        il.unit_price,
        il.discount_percent,
        il.subtotal,
        il.warehouse_quantities,
        p.name as product_name,
        p.sku,
        pv.variant_name as variant_name
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      LEFT JOIN market_product_variants pv ON pv.id = il.variant_id
      WHERE il.invoice_id = $1
      ORDER BY il.id
    `, [invoice.id])

    // Get warehouse operations for this invoice
    const operationsResult = await db.query(`
      SELECT
        o.id,
        o.operation_number,
        o.operation_type,
        o.status,
        o.validation_status,
        o.source_warehouse_id,
        o.destination_warehouse_id,
        o.reference_type,
        o.reference_id,
        o.reference_number,
        o.notes,
        o.created_at,
        o.completed_at,
        sw.name as source_warehouse_name,
        dw.name as destination_warehouse_name
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = o.destination_warehouse_id
      WHERE o.reference_type = 'wholesale_invoice' AND o.reference_id = $1
      ORDER BY o.id
    `, [invoice.id])

    // Get operation lines for each operation
    const operationsWithLines = await Promise.all(
      operationsResult.rows.map(async (op) => {
        const opLinesResult = await db.query(`
          SELECT
            ol.id,
            ol.product_id,
            ol.variant_id,
            ol.quantity_planned,
            ol.quantity_validated,
            ol.quantity_done,
            p.name as product_name,
            p.sku
          FROM market_warehouse_operation_lines ol
          JOIN market_products p ON p.id = ol.product_id
          WHERE ol.operation_id = $1
        `, [op.id])

        return {
          id: op.id,
          operationNumber: op.operation_number,
          operationType: op.operation_type,
          status: op.status,
          validationStatus: op.validation_status,
          sourceWarehouse: {
            id: op.source_warehouse_id,
            name: op.source_warehouse_name
          },
          destinationWarehouse: op.destination_warehouse_id ? {
            id: op.destination_warehouse_id,
            name: op.destination_warehouse_name
          } : null,
          referenceType: op.reference_type,
          referenceId: op.reference_id,
          referenceNumber: op.reference_number,
          notes: op.notes,
          createdAt: op.created_at,
          completedAt: op.completed_at,
          lines: opLinesResult.rows.map(l => ({
            id: l.id,
            productId: l.product_id,
            productName: l.product_name,
            sku: l.sku,
            quantityPlanned: parseFloat(l.quantity_planned) || 0,
            quantityValidated: parseFloat(l.quantity_validated) || 0,
            quantityDone: parseFloat(l.quantity_done) || 0
          }))
        }
      })
    )

    // Get deliveries for this invoice
    const deliveriesResult = await db.query(`
      SELECT
        d.id,
        d.delivery_number,
        d.warehouse_id,
        d.operation_id,
        d.status,
        d.delivery_address,
        d.notes,
        d.created_at,
        d.completed_at,
        w.name as warehouse_name
      FROM market_invoice_deliveries d
      LEFT JOIN market_warehouses w ON w.id = d.warehouse_id
      WHERE d.invoice_id = $1
      ORDER BY d.id
    `, [invoice.id])

    // Get delivery lines
    const deliveriesWithLines = await Promise.all(
      deliveriesResult.rows.map(async (del) => {
        const delLinesResult = await db.query(`
          SELECT
            dl.id,
            dl.product_id,
            dl.variant_id,
            dl.quantity_to_deliver,
            dl.quantity_delivered,
            p.name as product_name
          FROM market_invoice_delivery_lines dl
          JOIN market_products p ON p.id = dl.product_id
          WHERE dl.delivery_id = $1
        `, [del.id])

        return {
          id: del.id,
          deliveryNumber: del.delivery_number,
          warehouse: {
            id: del.warehouse_id,
            name: del.warehouse_name
          },
          operationId: del.operation_id,
          status: del.status,
          deliveryAddress: del.delivery_address,
          notes: del.notes,
          createdAt: del.created_at,
          completedAt: del.completed_at,
          lines: delLinesResult.rows.map(l => ({
            id: l.id,
            productId: l.product_id,
            productName: l.product_name,
            quantityToDeliver: parseFloat(l.quantity_to_deliver) || 0,
            quantityDelivered: parseFloat(l.quantity_delivered) || 0
          }))
        }
      })
    )

    // Get stock status for products in this invoice
    const stockStatus = await Promise.all(
      linesResult.rows.map(async (line) => {
        const stockResult = await db.query(`
          SELECT
            mws.warehouse_id,
            mw.name as warehouse_name,
            mws.quantity_on_hand,
            mws.quantity_reserved
          FROM market_warehouse_stock mws
          JOIN market_warehouses mw ON mw.id = mws.warehouse_id
          WHERE mws.product_id = $1
            AND (mws.variant_id = $2 OR (mws.variant_id IS NULL AND $2::int IS NULL))
            AND mw.company_id = $3
          ORDER BY mw.name
        `, [line.product_id, line.variant_id, payload.companyId])

        return {
          productId: line.product_id,
          productName: line.product_name,
          sku: line.sku,
          quantityOrdered: parseFloat(line.quantity) || 0,
          warehouseQuantities: line.warehouse_quantities,
          stockByWarehouse: stockResult.rows.map(s => ({
            warehouseId: s.warehouse_id,
            warehouseName: s.warehouse_name,
            onHand: parseFloat(s.quantity_on_hand) || 0,
            reserved: parseFloat(s.quantity_reserved) || 0,
            available: (parseFloat(s.quantity_on_hand) || 0) - (parseFloat(s.quantity_reserved) || 0)
          }))
        }
      })
    )

    // Identify issues
    const issues: string[] = []

    // Check if invoice is confirmed but has no operations
    if (invoice.status === 'confirmed' && operationsWithLines.length === 0) {
      issues.push('Factura confirmada pero sin operaciones de almacén creadas')
    }

    // Check if invoice is confirmed but has no deliveries
    if (invoice.status === 'confirmed' && deliveriesWithLines.length === 0) {
      issues.push('Factura confirmada pero sin entregas creadas')
    }

    // Check for pending operations
    const pendingOperations = operationsWithLines.filter(
      op => op.status === 'pending' && (op.validationStatus === 'pending_validation' || !op.validationStatus)
    )
    if (pendingOperations.length > 0) {
      issues.push(`${pendingOperations.length} operación(es) pendientes de validación`)
    }

    // Check for stock issues
    for (const product of stockStatus) {
      const wq = product.warehouseQuantities
      if (wq && typeof wq === 'object') {
        for (const [whId, qty] of Object.entries(wq as Record<string, number>)) {
          if (qty > 0) {
            const warehouseStock = product.stockByWarehouse.find(s => s.warehouseId === parseInt(whId))
            if (!warehouseStock) {
              issues.push(`${product.productName}: Sin registro de stock en almacén ${whId}`)
            } else if (warehouseStock.available < qty) {
              issues.push(`${product.productName}: Stock insuficiente en almacén ${whId} (necesita: ${qty}, disponible: ${warehouseStock.available})`)
            }
          }
        }
      }
    }

    // Check for mismatched operation warehouse
    for (const op of operationsWithLines) {
      const hasMatchingDelivery = deliveriesWithLines.some(d => d.operationId === op.id)
      if (!hasMatchingDelivery) {
        issues.push(`Operación ${op.operationNumber} sin entrega asociada`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          status: invoice.status,
          warehouse: invoice.warehouse_id ? {
            id: invoice.warehouse_id,
            name: invoice.warehouse_name
          } : null,
          customer: {
            id: invoice.customer_id,
            name: invoice.customer_name,
            code: invoice.customer_code,
            address: invoice.customer_address
          },
          totals: {
            subtotal: parseFloat(invoice.subtotal) || 0,
            tax: parseFloat(invoice.tax_amount) || 0,
            discount: parseFloat(invoice.discount_amount) || 0,
            total: parseFloat(invoice.total_amount) || 0
          },
          createdAt: invoice.created_at,
          confirmedAt: invoice.confirmed_at,
          completedAt: invoice.completed_at
        },
        lines: linesResult.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          sku: line.sku,
          variantId: line.variant_id,
          variantName: line.variant_name,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          discountPercent: parseFloat(line.discount_percent) || 0,
          subtotal: parseFloat(line.subtotal) || 0,
          warehouseQuantities: line.warehouse_quantities
        })),
        operations: operationsWithLines,
        deliveries: deliveriesWithLines,
        stockStatus,
        diagnosis: {
          hasOperations: operationsWithLines.length > 0,
          hasDeliveries: deliveriesWithLines.length > 0,
          pendingOperationsCount: pendingOperations.length,
          isMultiWarehouse: linesResult.rows.some(l => {
            const wq = l.warehouse_quantities
            return wq && typeof wq === 'object' && Object.keys(wq).length > 0
          }),
          issues,
          recommendation: issues.length === 0
            ? 'No se detectaron problemas'
            : issues.length === 1 && issues[0].includes('pendientes de validación')
              ? 'Las operaciones están pendientes de validación en el almacén correspondiente'
              : 'Se requiere revisión manual de los problemas detectados'
        }
      }
    })

  } catch (error) {
    console.error('[Debug Wholesale Invoice] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al diagnosticar factura'
    }, { status: 500 })
  }
}
