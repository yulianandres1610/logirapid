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

interface ReceivedLine {
  lineId: number
  quantityReceived: number
  lotNumber?: string
  expirationDate?: string
  variantId?: number | null
}

/**
 * POST /api/consignments/orders/[id]/receive
 * Procesar recepcion de orden de consignacion
 * Genera lotes y crea entradas en inventario FIFO
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
    const orderId = parseInt(id)
    const body = await request.json()
    const { lines } = body as { lines: ReceivedLine[] }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe incluir al menos una linea de recepcion'
      }, { status: 400 })
    }

    // Verify order exists and is pending
    const orderResult = await db.query(`
      SELECT o.*, s.supplier_code as supplier_code
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]
    if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden recibir ordenes pendientes'
      }, { status: 400 })
    }

    // Check if order is pending validation - cannot receive until approved
    if (order.validation_status === 'pending_validation') {
      return NextResponse.json({
        success: false,
        error: 'Esta consignación está pendiente de aprobación. Debe ser aprobada antes de poder recibirla.'
      }, { status: 400 })
    }

    const supplierCode = order.supplier_code
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '').slice(2) // YYMMDD

    // Process each line
    let totalUnitsReceived = 0
    let processedLines = 0

    for (const line of lines) {
      if (line.quantityReceived <= 0) continue

      // Get order line details with variant info
      const lineResult = await db.query(`
        SELECT col.*, mpv.variant_name, mpv.sku as variant_sku
        FROM consignment_order_lines col
        LEFT JOIN market_product_variants mpv ON col.variant_id = mpv.id
        WHERE col.id = $1 AND col.order_id = $2
      `, [line.lineId, orderId])

      if (lineResult.rows.length === 0) continue

      const orderLine = lineResult.rows[0]
      const variantId = orderLine.variant_id || null

      // Generate lot number if not provided: {SUPPLIER_CODE}{YYMMDD}{SEQ}
      let lotNumber = line.lotNumber
      if (!lotNumber) {
        const seqResult = await db.query(`
          SELECT COUNT(*) as count FROM consignment_lot_inventory
          WHERE lot_number LIKE $1
        `, [`${supplierCode}${dateStr}%`])
        const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(2, '0')
        lotNumber = `${supplierCode}${dateStr}${seq}`
      }

      // Update order line
      await db.query(`
        UPDATE consignment_order_lines SET
          quantity_received = quantity_received + $1,
          lot_number = $2,
          expiration_date = $3
        WHERE id = $4
      `, [
        line.quantityReceived,
        lotNumber,
        line.expirationDate || null,
        line.lineId
      ])

      // Create FIFO inventory entry
      const qtyReceived = parseInt(String(line.quantityReceived))
      const unitCost = parseFloat(orderLine.unit_cost) || 0

      await db.query(`
        INSERT INTO consignment_lot_inventory (
          company_id, warehouse_id, product_id, variant_id, order_line_id, supplier_id,
          lot_number, expiration_date, quantity_initial, quantity_available, unit_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (warehouse_id, product_id, COALESCE(variant_id, 0), lot_number) DO UPDATE SET
          quantity_initial = consignment_lot_inventory.quantity_initial + EXCLUDED.quantity_initial,
          quantity_available = consignment_lot_inventory.quantity_available + EXCLUDED.quantity_available,
          expiration_date = COALESCE(EXCLUDED.expiration_date, consignment_lot_inventory.expiration_date)
      `, [
        payload.companyId,
        parseInt(order.warehouse_id),
        parseInt(orderLine.product_id),
        variantId,
        line.lineId,
        parseInt(order.supplier_id),
        lotNumber,
        line.expirationDate || null,
        qtyReceived,
        qtyReceived,
        unitCost
      ])

      // Update variant stock if this line has a variant
      if (variantId) {
        await db.query(`
          UPDATE market_product_variants
          SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [qtyReceived, variantId])
      }

      // Update main inventory (market_product_inventory)
      await db.query(`
        INSERT INTO market_product_inventory (
          warehouse_id, product_id, quantity_on_hand, quantity_expected,
          minimum_stock, last_count_date
        ) VALUES ($1, $2, $3, 0, 0, NOW())
        ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
          quantity_on_hand = market_product_inventory.quantity_on_hand + $3
      `, [order.warehouse_id, orderLine.product_id, line.quantityReceived])

      totalUnitsReceived += line.quantityReceived
      processedLines++
    }

    // Update order status to received
    await db.query(`
      UPDATE consignment_orders SET
        status = 'received',
        received_at = NOW(),
        received_by = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [payload.userId, orderId])

    // Create wallet transaction for received goods
    const walletResult = await db.query(
      'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
      [order.supplier_id]
    )

    if (walletResult.rows.length > 0) {
      await db.query(`
        INSERT INTO consignment_wallet_transactions (
          wallet_id, order_id, transaction_type, amount, notes, created_by
        ) VALUES ($1, $2, 'received', 0, $3, $4)
      `, [
        walletResult.rows[0].id,
        orderId,
        `Recepcion de orden ${order.order_number}: ${totalUnitsReceived} unidades`,
        payload.userId
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Recepcion procesada exitosamente',
      data: {
        orderId,
        orderNumber: order.order_number,
        linesProcessed: processedLines,
        unitsReceived: totalUnitsReceived,
        status: 'received'
      }
    })

  } catch (error) {
    console.error('[Consignment Receive] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar recepcion'
    }, { status: 500 })
  }
}
