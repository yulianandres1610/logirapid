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

interface OfflineOrder {
  offlineId: string
  terminalId: number
  sessionId: number
  warehouseId?: number
  customerId?: number
  customerName?: string
  currency: string
  lines: Array<{
    productId: number
    productName: string
    productSku?: string
    quantity: number
    unitPrice: number
    discountPercent?: number
    discountAmount?: number
    taxAmount?: number
    promotionId?: number
    promotionName?: string
  }>
  payments: Array<{
    method: string
    amount: number
    currency: string
    amountTendered?: number
    changeAmount?: number
    changeCurrency?: string | null  // Currency of the change (USD or CUP)
    reference?: string
  }>
  createdAt: string
}

/**
 * POST /api/market/pos/sync
 * Sync offline orders to the server
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { sessionId, orders } = body as { sessionId: number; orders: OfflineOrder[] }

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de sesión'
      }, { status: 400 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: { synced: 0, skipped: 0, failed: 0 },
        message: 'No hay órdenes para sincronizar'
      })
    }

    // Verify session exists and is open
    const sessionCheck = await db.query(`
      SELECT id, status, pos_terminal_id FROM market_pos_sessions
      WHERE id = $1 AND company_id = $2
    `, [sessionId, companyId])

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = sessionCheck.rows[0]

    // Get terminal warehouse
    const terminalResult = await db.query(`
      SELECT warehouse_id FROM market_pos_terminals WHERE id = $1
    `, [session.pos_terminal_id])

    const defaultWarehouseId = terminalResult.rows[0]?.warehouse_id

    const results = {
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ offlineId: string; error: string }>
    }

    // Process each order
    for (const order of orders) {
      try {
        // Check if already synced
        const existingOrder = await db.query(`
          SELECT id FROM market_pos_orders WHERE offline_id = $1
        `, [order.offlineId])

        if (existingOrder.rows.length > 0) {
          results.skipped++
          continue
        }

        // Generate order number
        const year = new Date().getFullYear()
        const countResult = await db.query(`
          SELECT COUNT(*) as count FROM market_pos_orders WHERE company_id = $1
        `, [companyId])
        const count = parseInt(countResult.rows[0].count) + 1
        const orderNumber = `POS-${year}-${String(count).padStart(5, '0')}`

        // Calculate totals
        let subtotal = 0
        let totalDiscount = 0
        let totalTax = 0

        for (const line of order.lines) {
          const lineSubtotal = (line.quantity || 1) * (line.unitPrice || 0)
          const lineDiscount = line.discountAmount || (lineSubtotal * (line.discountPercent || 0) / 100)
          const lineTax = line.taxAmount || 0

          subtotal += lineSubtotal
          totalDiscount += lineDiscount
          totalTax += lineTax
        }

        const totalAmount = subtotal - totalDiscount + totalTax
        const warehouseId = order.warehouseId || defaultWarehouseId

        // Validate stock availability in the POS terminal's warehouse before creating order
        let hasStockError = false
        if (warehouseId) {
          for (const line of order.lines) {
            const quantity = parseFloat(String(line.quantity)) || 1
            const productId = parseInt(String(line.productId)) || null

            if (productId) {
              // Get product info
              const productCheck = await db.query(
                'SELECT name, COALESCE(quantity_on_hand, 0) as global_stock FROM market_products WHERE id = $1',
                [productId]
              )

              // Check warehouse stock availability (only the POS terminal's warehouse matters)
              const stockCheck = await db.query(`
                SELECT COALESCE(quantity_on_hand, 0) as available
                FROM market_warehouse_stock
                WHERE product_id = $1 AND warehouse_id = $2
              `, [productId, warehouseId])

              let availableStock: number

              if (stockCheck.rows.length > 0) {
                availableStock = parseFloat(stockCheck.rows[0]?.available) || 0
              } else {
                // No warehouse stock record - check global stock and auto-initialize
                const globalStock = parseFloat(productCheck.rows[0]?.global_stock) || 0
                if (globalStock > 0) {
                  await db.query(`
                    INSERT INTO market_warehouse_stock (product_id, warehouse_id, variant_id, quantity_on_hand, created_at, updated_at)
                    VALUES ($1, $2, NULL, $3, NOW(), NOW())
                  `, [productId, warehouseId, globalStock])
                  availableStock = globalStock
                  console.log('[POS Sync] Auto-initialized warehouse stock:', { productId, warehouseId, stock: globalStock })
                } else {
                  availableStock = 0
                }
              }

              if (availableStock < quantity) {
                const productName = productCheck.rows[0]?.name || `Producto ${productId}`
                console.log('[POS Sync] Insufficient stock for offline order:', {
                  offlineId: order.offlineId,
                  productId,
                  productName,
                  requested: quantity,
                  available: availableStock,
                  warehouseId
                })

                results.failed++
                results.errors.push({
                  offlineId: order.offlineId,
                  error: `Stock insuficiente para "${productName}". Disponible: ${availableStock}`
                })
                hasStockError = true
                break // Exit line loop
              }
            }
          }
        }

        if (hasStockError) {
          continue // Skip to next order
        }

        // Create order
        const orderResult = await db.query(`
          INSERT INTO market_pos_orders (
            company_id, pos_session_id, pos_terminal_id, warehouse_id,
            order_number, customer_id, customer_name,
            subtotal, discount_amount, tax_amount, total_amount,
            currency, status, offline_id, synced_at,
            created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, $16, NOW())
          RETURNING id
        `, [
          companyId,
          sessionId,
          order.terminalId,
          warehouseId || null,
          orderNumber,
          order.customerId || null,
          order.customerName || null,
          subtotal,
          totalDiscount,
          totalTax,
          totalAmount,
          order.currency || 'USD',
          'paid', // Offline orders are assumed paid
          order.offlineId,
          userId,
          order.createdAt || new Date().toISOString()
        ])

        const orderId = orderResult.rows[0].id

        // Insert order lines
        for (const line of order.lines) {
          const lineSubtotal = (line.quantity || 1) * (line.unitPrice || 0)
          const lineDiscount = line.discountAmount || (lineSubtotal * (line.discountPercent || 0) / 100)
          const lineTotal = lineSubtotal - lineDiscount + (line.taxAmount || 0)

          await db.query(`
            INSERT INTO market_pos_order_lines (
              order_id, product_id, product_name, product_sku,
              quantity, unit_price,
              discount_percent, discount_amount,
              subtotal, tax_amount, total,
              promotion_id, promotion_name,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          `, [
            orderId,
            line.productId,
            line.productName,
            line.productSku || null,
            line.quantity || 1,
            line.unitPrice || 0,
            line.discountPercent || 0,
            lineDiscount,
            lineSubtotal,
            line.taxAmount || 0,
            lineTotal,
            line.promotionId || null,
            line.promotionName || null
          ])

          // Update inventory - deduct from the POS terminal's warehouse stock
          if (warehouseId && line.productId) {
            // Deduct from warehouse stock
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
              WHERE product_id = $2 AND warehouse_id = $3
            `, [line.quantity || 1, line.productId, warehouseId])

            // Also update global product stock for tracking
            await db.query(`
              UPDATE market_products
              SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
              WHERE id = $2
            `, [line.quantity || 1, line.productId])
          } else if (line.productId) {
            await db.query(`
              UPDATE market_products
              SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
              WHERE id = $2
            `, [line.quantity || 1, line.productId])
          }
        }

        // Insert payments
        for (const payment of order.payments) {
          await db.query(`
            INSERT INTO market_pos_payments (
              order_id, payment_method, amount, currency,
              amount_tendered, change_amount, change_currency, reference,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            orderId,
            payment.method || 'cash',
            payment.amount || 0,
            payment.currency || 'USD',
            payment.amountTendered || null,
            payment.changeAmount || null,
            payment.changeCurrency || null, // Currency of the change (USD or CUP)
            payment.reference || null
          ])
        }

        results.synced++
        console.log('[POS Sync] Synced order:', order.offlineId, '→', orderNumber)

      } catch (error) {
        results.failed++
        results.errors.push({
          offlineId: order.offlineId,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
        console.error('[POS Sync] Error syncing order:', order.offlineId, error)
      }
    }

    console.log('[POS Sync] Completed:', results)

    return NextResponse.json({
      success: true,
      data: results,
      message: `Sincronización completada: ${results.synced} órdenes sincronizadas, ${results.skipped} omitidas, ${results.failed} fallidas`
    })

  } catch (error) {
    console.error('[POS Sync API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/pos/sync
 * Get sync status for a session
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de sesión'
      }, { status: 400 })
    }

    // Get sync stats for session
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE offline_id IS NOT NULL) as offline_orders,
        COUNT(*) FILTER (WHERE synced_at IS NOT NULL) as synced_orders,
        MAX(synced_at) as last_sync,
        SUM(total_amount) FILTER (WHERE status = 'paid') as total_sales
      FROM market_pos_orders
      WHERE pos_session_id = $1 AND company_id = $2
    `, [parseInt(sessionId), companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: parseInt(stats.total_orders) || 0,
        offlineOrders: parseInt(stats.offline_orders) || 0,
        syncedOrders: parseInt(stats.synced_orders) || 0,
        lastSync: stats.last_sync,
        totalSales: parseFloat(stats.total_sales) || 0
      }
    })

  } catch (error) {
    console.error('[POS Sync API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estado de sincronización'
    }, { status: 500 })
  }
}
