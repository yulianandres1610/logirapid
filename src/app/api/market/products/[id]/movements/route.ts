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
 * GET /api/market/products/[id]/movements
 * Get comprehensive inventory movement history for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get all movements from different sources
    const movements: Array<{
      id: string
      type: string
      typeLabel: string
      date: string
      quantity: number
      direction: 'in' | 'out'
      reference: string
      referenceId: number
      warehouseName: string | null
      sourceWarehouse: string | null
      destWarehouse: string | null
      userName: string | null
      status: string
      notes: string | null
      stockAfter: Record<string, number> | null
    }> = []

    // 1. Get purchases (entries)
    const purchasesResult = await db.query(`
      SELECT
        mp.id,
        mp.purchase_number,
        mp.status,
        mp.created_at,
        mp.received_at,
        mpl.quantity,
        mpl.quantity_received,
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        s.name as supplier_name
      FROM market_purchase_lines mpl
      JOIN market_purchases mp ON mp.id = mpl.purchase_id
      LEFT JOIN market_warehouses mw ON mw.id = mp.warehouse_id
      LEFT JOIN users u ON u.id = mp.created_by
      LEFT JOIN market_suppliers s ON s.id = mp.supplier_id
      WHERE mpl.product_id = $1 AND mp.company_id = $2
        AND mp.status IN ('recibido', 'received', 'completed', 'parcial')
      ORDER BY COALESCE(mp.received_at, mp.created_at) DESC
      LIMIT $3
    `, [productId, payload.companyId, limit])

    for (const row of purchasesResult.rows) {
      const qty = parseFloat(row.quantity_received) || parseFloat(row.quantity) || 0
      if (qty > 0) {
        movements.push({
          id: `purchase-${row.id}`,
          type: 'purchase',
          typeLabel: 'Compra',
          date: row.received_at || row.created_at,
          quantity: qty,
          direction: 'in',
          reference: row.purchase_number,
          referenceId: row.id,
          warehouseName: row.warehouse_name,
          sourceWarehouse: row.supplier_name || 'Proveedor',
          destWarehouse: row.warehouse_name,
          userName: row.user_name,
          status: row.status,
          notes: null,
          stockAfter: null
        })
      }
    }

    // 2. Get warehouse transfers (both directions)
    const transfersResult = await db.query(`
      SELECT
        mwo.id,
        mwo.operation_number,
        mwo.operation_type,
        mwo.status,
        mwo.created_at,
        mwo.completed_at,
        mwol.quantity_planned,
        mwol.quantity_done,
        sw.id as source_id,
        sw.name as source_warehouse,
        dw.id as dest_id,
        dw.name as dest_warehouse,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        mwo.notes
      FROM market_warehouse_operation_lines mwol
      JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
      LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = mwo.destination_warehouse_id
      LEFT JOIN users u ON u.id = mwo.created_by
      WHERE mwol.product_id = $1 AND mwo.company_id = $2
        AND mwo.status IN ('done', 'completed', 'validated')
      ORDER BY COALESCE(mwo.completed_at, mwo.created_at) DESC
      LIMIT $3
    `, [productId, payload.companyId, limit])

    for (const row of transfersResult.rows) {
      const qty = parseFloat(row.quantity_done) || parseFloat(row.quantity_planned) || 0
      if (qty > 0) {
        // Add as exit from source
        if (row.source_warehouse) {
          movements.push({
            id: `transfer-out-${row.id}`,
            type: 'transfer_out',
            typeLabel: 'Transferencia (Salida)',
            date: row.completed_at || row.created_at,
            quantity: qty,
            direction: 'out',
            reference: row.operation_number,
            referenceId: row.id,
            warehouseName: row.source_warehouse,
            sourceWarehouse: row.source_warehouse,
            destWarehouse: row.dest_warehouse,
            userName: row.user_name,
            status: row.status,
            notes: row.notes,
            stockAfter: null
          })
        }

        // Add as entry to destination
        if (row.dest_warehouse) {
          movements.push({
            id: `transfer-in-${row.id}`,
            type: 'transfer_in',
            typeLabel: 'Transferencia (Entrada)',
            date: row.completed_at || row.created_at,
            quantity: qty,
            direction: 'in',
            reference: row.operation_number,
            referenceId: row.id,
            warehouseName: row.dest_warehouse,
            sourceWarehouse: row.source_warehouse,
            destWarehouse: row.dest_warehouse,
            userName: row.user_name,
            status: row.status,
            notes: row.notes,
            stockAfter: null
          })
        }
      }
    }

    // 3. Get POS sales (exits)
    const salesResult = await db.query(`
      SELECT
        mpo.id,
        mpo.order_number,
        mpo.status,
        mpo.created_at,
        mpol.quantity,
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        t.name as terminal_name
      FROM market_pos_order_lines mpol
      JOIN market_pos_orders mpo ON mpo.id = mpol.order_id
      LEFT JOIN market_warehouses mw ON mw.id = mpo.warehouse_id
      LEFT JOIN users u ON u.id = mpo.created_by
      LEFT JOIN market_pos_terminals t ON t.id = mpo.pos_terminal_id
      WHERE mpol.product_id = $1 AND mpo.company_id = $2
        AND mpo.status IN ('paid', 'completed')
      ORDER BY mpo.created_at DESC
      LIMIT $3
    `, [productId, payload.companyId, limit])

    for (const row of salesResult.rows) {
      const qty = parseFloat(row.quantity) || 0
      if (qty > 0) {
        movements.push({
          id: `sale-${row.id}`,
          type: 'sale',
          typeLabel: 'Venta POS',
          date: row.created_at,
          quantity: qty,
          direction: 'out',
          reference: row.order_number,
          referenceId: row.id,
          warehouseName: row.warehouse_name,
          sourceWarehouse: row.warehouse_name,
          destWarehouse: row.terminal_name || 'Cliente',
          userName: row.user_name,
          status: row.status,
          notes: null,
          stockAfter: null
        })
      }
    }

    // 4. Get audit adjustments
    const auditsResult = await db.query(`
      SELECT
        ac.id,
        ac.count_number,
        ac.status,
        ac.applied_at,
        acl.system_quantity,
        acl.counted_quantity,
        acl.difference,
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        ac.notes
      FROM audit_count_lines acl
      JOIN audit_counts ac ON ac.id = acl.count_id
      LEFT JOIN market_warehouses mw ON mw.id = ac.warehouse_id
      LEFT JOIN users u ON u.id = ac.created_by
      WHERE acl.product_id = $1 AND ac.company_id = $2
        AND ac.status = 'applied'
        AND acl.difference != 0
      ORDER BY ac.applied_at DESC
      LIMIT $3
    `, [productId, payload.companyId, limit])

    for (const row of auditsResult.rows) {
      const diff = parseFloat(row.difference) || 0
      if (diff !== 0) {
        movements.push({
          id: `audit-${row.id}`,
          type: 'audit',
          typeLabel: diff > 0 ? 'Ajuste Auditoría (+)' : 'Ajuste Auditoría (-)',
          date: row.applied_at,
          quantity: Math.abs(diff),
          direction: diff > 0 ? 'in' : 'out',
          reference: row.count_number,
          referenceId: row.id,
          warehouseName: row.warehouse_name,
          sourceWarehouse: diff > 0 ? 'Ajuste' : row.warehouse_name,
          destWarehouse: diff > 0 ? row.warehouse_name : 'Ajuste',
          userName: row.user_name,
          status: row.status,
          notes: `Sistema: ${row.system_quantity}, Contado: ${row.counted_quantity}`,
          stockAfter: null
        })
      }
    }

    // Sort all movements by date descending
    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Get current stock by warehouse
    const stockResult = await db.query(`
      SELECT
        mws.warehouse_id,
        mw.name as warehouse_name,
        mws.quantity_on_hand,
        mws.quantity_reserved
      FROM market_warehouse_stock mws
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      WHERE mws.product_id = $1 AND mws.variant_id IS NULL
      ORDER BY mw.name
    `, [productId])

    const currentStock: Record<string, { onHand: number; reserved: number }> = {}
    for (const row of stockResult.rows) {
      currentStock[row.warehouse_name] = {
        onHand: parseFloat(row.quantity_on_hand) || 0,
        reserved: parseFloat(row.quantity_reserved) || 0
      }
    }

    // Calculate stock after each movement (working backwards from current)
    const stockTracker = { ...currentStock }

    // Process movements in reverse order to calculate historical stock
    const movementsWithStock = [...movements].map((m, idx) => {
      // For the most recent movements, we can calculate what the stock was after
      const stockSnapshot: Record<string, number> = {}
      for (const [wh, data] of Object.entries(stockTracker)) {
        stockSnapshot[wh] = data.onHand
      }

      return {
        ...m,
        stockAfter: stockSnapshot
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        movements: movementsWithStock.slice(0, limit),
        currentStock,
        summary: {
          totalIn: movements.filter(m => m.direction === 'in').reduce((sum, m) => sum + m.quantity, 0),
          totalOut: movements.filter(m => m.direction === 'out').reduce((sum, m) => sum + m.quantity, 0),
          purchaseCount: movements.filter(m => m.type === 'purchase').length,
          saleCount: movements.filter(m => m.type === 'sale').length,
          transferCount: movements.filter(m => m.type.startsWith('transfer')).length / 2,
          auditCount: movements.filter(m => m.type === 'audit').length
        }
      }
    })

  } catch (error) {
    console.error('[Product Movements API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener movimientos'
    }, { status: 500 })
  }
}
