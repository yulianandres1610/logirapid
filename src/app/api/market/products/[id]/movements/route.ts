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

interface Movement {
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
    const movements: Movement[] = []

    // 1. Get purchases (entries) - include variant info
    try {
      const purchasesResult = await db.query(`
        SELECT
          mpl.id as line_id,
          mp.id as purchase_id,
          mp.purchase_number,
          mp.status,
          mp.created_at,
          mp.received_at,
          mpl.quantity,
          mpl.quantity_received,
          mpl.variant_id,
          mpv.variant_name,
          mw.id as warehouse_id,
          mw.name as warehouse_name,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
          s.name as supplier_name
        FROM market_purchase_lines mpl
        JOIN market_purchases mp ON mp.id = mpl.purchase_id
        LEFT JOIN market_product_variants mpv ON mpv.id = mpl.variant_id
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
          const variantLabel = row.variant_name ? ` (${row.variant_name})` : ''
          movements.push({
            id: `purchase-${row.line_id}`,
            type: 'purchase',
            typeLabel: `Compra${variantLabel}`,
            date: row.received_at || row.created_at,
            quantity: qty,
            direction: 'in',
            reference: row.purchase_number || `PO-${row.purchase_id}`,
            referenceId: row.purchase_id,
            warehouseName: row.warehouse_name,
            sourceWarehouse: row.supplier_name || 'Proveedor',
            destWarehouse: row.warehouse_name,
            userName: row.user_name,
            status: row.status,
            notes: row.variant_name ? `Variante: ${row.variant_name}` : null,
            stockAfter: null
          })
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching purchases:', error)
    }

    // 2. Get warehouse transfers (both directions) - include variant info
    try {
      const transfersResult = await db.query(`
        SELECT
          mwol.id as line_id,
          mwo.id as operation_id,
          mwo.operation_number,
          mwo.operation_type,
          mwo.status,
          mwo.created_at,
          mwo.completed_at,
          mwol.quantity_planned,
          mwol.quantity_done,
          mwol.variant_id,
          mpv.variant_name,
          sw.id as source_id,
          sw.name as source_warehouse,
          dw.id as dest_id,
          dw.name as dest_warehouse,
          COALESCE(u_sender.firstname || ' ' || u_sender.lastname, u_sender.email) as sender_name,
          COALESCE(u_receiver.firstname || ' ' || u_receiver.lastname, u_receiver.email) as receiver_name,
          mwo.notes
        FROM market_warehouse_operation_lines mwol
        JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
        LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
        LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
        LEFT JOIN market_warehouses dw ON dw.id = mwo.destination_warehouse_id
        LEFT JOIN users u_sender ON u_sender.id = mwo.created_by
        LEFT JOIN users u_receiver ON u_receiver.id = mwo.validated_by
        WHERE mwol.product_id = $1 AND mwo.company_id = $2
          AND mwo.operation_type = 'internal'
          AND mwo.status IN ('done', 'completed', 'validated', 'confirmed')
        ORDER BY COALESCE(mwo.completed_at, mwo.created_at) DESC
        LIMIT $3
      `, [productId, payload.companyId, limit])

      for (const row of transfersResult.rows) {
        const qty = parseFloat(row.quantity_done) || parseFloat(row.quantity_planned) || 0
        if (qty > 0) {
          const variantLabel = row.variant_name ? ` (${row.variant_name})` : ''
          const variantNote = row.variant_name ? `Variante: ${row.variant_name}` : null

          // Add as exit from source - show sender (who created the transfer)
          if (row.source_warehouse) {
            movements.push({
              id: `transfer-out-${row.line_id}`,
              type: 'transfer_out',
              typeLabel: `Transferencia (Salida)${variantLabel}`,
              date: row.completed_at || row.created_at,
              quantity: qty,
              direction: 'out',
              reference: row.operation_number || `TRF-${row.operation_id}`,
              referenceId: row.operation_id,
              warehouseName: row.source_warehouse,
              sourceWarehouse: row.source_warehouse,
              destWarehouse: row.dest_warehouse,
              userName: row.sender_name,
              status: row.status,
              notes: variantNote || row.notes,
              stockAfter: null
            })
          }

          // Add as entry to destination - show receiver (who validated the transfer)
          if (row.dest_warehouse) {
            movements.push({
              id: `transfer-in-${row.line_id}`,
              type: 'transfer_in',
              typeLabel: `Transferencia (Entrada)${variantLabel}`,
              date: row.completed_at || row.created_at,
              quantity: qty,
              direction: 'in',
              reference: row.operation_number || `TRF-${row.operation_id}`,
              referenceId: row.operation_id,
              warehouseName: row.dest_warehouse,
              sourceWarehouse: row.source_warehouse,
              destWarehouse: row.dest_warehouse,
              userName: row.receiver_name || row.sender_name,
              status: row.status,
              notes: variantNote || row.notes,
              stockAfter: null
            })
          }
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching transfers:', error)
    }

    // 3. Get POS sales (exits) - include variant info
    try {
      const salesResult = await db.query(`
        SELECT
          mpol.id as line_id,
          mpo.id as order_id,
          mpo.order_number,
          mpo.status,
          mpo.created_at,
          mpol.quantity,
          mpol.variant_id,
          mpv.variant_name,
          mw.id as warehouse_id,
          mw.name as warehouse_name,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
          t.name as terminal_name
        FROM market_pos_order_lines mpol
        JOIN market_pos_orders mpo ON mpo.id = mpol.order_id
        LEFT JOIN market_product_variants mpv ON mpv.id = mpol.variant_id
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
          const variantLabel = row.variant_name ? ` (${row.variant_name})` : ''
          movements.push({
            id: `sale-${row.line_id}`,
            type: 'sale',
            typeLabel: `Venta POS${variantLabel}`,
            date: row.created_at,
            quantity: qty,
            direction: 'out',
            reference: row.order_number || `ORD-${row.order_id}`,
            referenceId: row.order_id,
            warehouseName: row.warehouse_name,
            sourceWarehouse: row.warehouse_name,
            destWarehouse: row.terminal_name || 'Cliente',
            userName: row.user_name,
            status: row.status,
            notes: row.variant_name ? `Variante: ${row.variant_name}` : null,
            stockAfter: null
          })
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching sales:', error)
    }

    // 4. Get audit adjustments
    try {
      // First check if audit_counts table exists
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'audit_counts'
        ) as exists
      `)

      if (tableCheck.rows[0]?.exists) {
        const auditsResult = await db.query(`
          SELECT
            ac.id,
            ac.count_number,
            ac.status,
            ac.applied_at,
            ac.created_at,
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
          ORDER BY COALESCE(ac.applied_at, ac.created_at) DESC
          LIMIT $3
        `, [productId, payload.companyId, limit])

        for (const row of auditsResult.rows) {
          const diff = parseFloat(row.difference) || 0
          if (diff !== 0) {
            movements.push({
              id: `audit-${row.id}`,
              type: 'audit',
              typeLabel: diff > 0 ? 'Ajuste Auditoría (+)' : 'Ajuste Auditoría (-)',
              date: row.applied_at || row.created_at || new Date().toISOString(),
              quantity: Math.abs(diff),
              direction: diff > 0 ? 'in' : 'out',
              reference: row.count_number || `AUD-${row.id}`,
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
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching audits:', error)
    }

    // 5. Get manual adjustments (from warehouse operations)
    try {
      // Check if table exists first
      const opTableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'market_warehouse_operations'
        ) as exists
      `)

      if (opTableCheck.rows[0]?.exists) {
        const adjustmentsResult = await db.query(`
          SELECT
            mwo.id,
            mwo.operation_number,
            mwo.operation_type,
            mwo.status,
            mwo.created_at,
            mwo.completed_at,
            mwol.quantity_planned,
            mwol.quantity_done,
            mwol.scrap_reason,
            sw.id as warehouse_id,
            sw.name as warehouse_name,
            COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
            mwo.notes
          FROM market_warehouse_operation_lines mwol
          JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
          LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
          LEFT JOIN users u ON u.id = mwo.created_by
          WHERE mwol.product_id = $1 AND mwo.company_id = $2
            AND mwo.operation_type = 'adjustment'
            AND mwo.status IN ('done', 'completed', 'confirmed', 'validated', 'draft')
          ORDER BY COALESCE(mwo.completed_at, mwo.created_at) DESC
          LIMIT $3
        `, [productId, payload.companyId, limit])

        for (const row of adjustmentsResult.rows) {
          const qty = parseFloat(row.quantity_done) || parseFloat(row.quantity_planned) || 0
          if (qty !== 0) {
            // Adjustments can be positive or negative based on notes or context
            // By default, we treat them as reductions (out) unless notes indicate otherwise
            const notesLower = (row.notes || '').toLowerCase()
            const isPositive = notesLower.includes('entrada') ||
                              notesLower.includes('agregar') ||
                              notesLower.includes('añadir')
            movements.push({
              id: `adjustment-${row.id}`,
              type: 'adjustment',
              typeLabel: isPositive ? 'Ajuste Manual (+)' : 'Ajuste Manual (-)',
              date: row.completed_at || row.created_at || new Date().toISOString(),
              quantity: Math.abs(qty),
              direction: isPositive ? 'in' : 'out',
              reference: row.operation_number || `ADJ-${row.id}`,
              referenceId: row.id,
              warehouseName: row.warehouse_name || 'N/A',
              sourceWarehouse: isPositive ? 'Ajuste' : (row.warehouse_name || 'N/A'),
              destWarehouse: isPositive ? (row.warehouse_name || 'N/A') : 'Ajuste',
              userName: row.user_name,
              status: row.status,
              notes: row.notes,
              stockAfter: null
            })
          }
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching adjustments:', error)
    }

    // 6. Get scrap/waste (from warehouse operations)
    try {
      // Use the same table check from adjustments (already verified above)
      const scrapResult = await db.query(`
        SELECT
          mwo.id,
          mwo.operation_number,
          mwo.operation_type,
          mwo.status,
          mwo.created_at,
          mwo.completed_at,
          mwol.quantity_planned,
          mwol.quantity_done,
          mwol.scrap_reason,
          sw.id as warehouse_id,
          sw.name as warehouse_name,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
          mwo.notes
        FROM market_warehouse_operation_lines mwol
        JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
        LEFT JOIN market_warehouses sw ON sw.id = mwo.source_warehouse_id
        LEFT JOIN users u ON u.id = mwo.created_by
        WHERE mwol.product_id = $1 AND mwo.company_id = $2
          AND mwo.operation_type = 'scrap'
          AND mwo.status IN ('done', 'completed', 'confirmed', 'validated', 'draft')
        ORDER BY COALESCE(mwo.completed_at, mwo.created_at) DESC
        LIMIT $3
      `, [productId, payload.companyId, limit])

      const SCRAP_REASON_LABELS: Record<string, string> = {
        damaged: 'Dañado',
        expired: 'Vencido',
        defective: 'Defectuoso',
        theft_loss: 'Robo/Pérdida',
        other: 'Otro'
      }

      for (const row of scrapResult.rows) {
        const qty = parseFloat(row.quantity_done) || parseFloat(row.quantity_planned) || 0
        if (qty > 0) {
          const reasonLabel = SCRAP_REASON_LABELS[row.scrap_reason] || row.scrap_reason || 'Scrap'
          movements.push({
            id: `scrap-${row.id}`,
            type: 'scrap',
            typeLabel: `Scrap (${reasonLabel})`,
            date: row.completed_at || row.created_at || new Date().toISOString(),
            quantity: qty,
            direction: 'out',
            reference: row.operation_number || `SCR-${row.id}`,
            referenceId: row.id,
            warehouseName: row.warehouse_name || 'N/A',
            sourceWarehouse: row.warehouse_name || 'N/A',
            destWarehouse: 'Merma',
            userName: row.user_name,
            status: row.status,
            notes: row.notes || `Motivo: ${reasonLabel}`,
            stockAfter: null
          })
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching scrap:', error)
    }

    // Sort all movements by date descending (handle null/invalid dates)
    movements.sort((a, b) => {
      let dateA = 0
      let dateB = 0
      try {
        if (a.date) {
          const parsed = new Date(a.date).getTime()
          if (!isNaN(parsed)) dateA = parsed
        }
      } catch { /* ignore */ }
      try {
        if (b.date) {
          const parsed = new Date(b.date).getTime()
          if (!isNaN(parsed)) dateB = parsed
        }
      } catch { /* ignore */ }
      return dateB - dateA
    })

    // Get current stock by warehouse
    let currentStock: Record<string, { onHand: number; reserved: number }> = {}
    try {
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

      for (const row of stockResult.rows) {
        currentStock[row.warehouse_name] = {
          onHand: parseFloat(row.quantity_on_hand) || 0,
          reserved: parseFloat(row.quantity_reserved) || 0
        }
      }
    } catch (error) {
      console.error('[Product Movements] Error fetching current stock:', error)
    }

    // Calculate stock after each movement (working backwards from current)
    const movementsWithStock = movements.map((m) => {
      // For the most recent movements, we can calculate what the stock was after
      const stockSnapshot: Record<string, number> = {}
      for (const [wh, data] of Object.entries(currentStock)) {
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
          auditCount: movements.filter(m => m.type === 'audit').length,
          adjustmentCount: movements.filter(m => m.type === 'adjustment').length,
          scrapCount: movements.filter(m => m.type === 'scrap').length
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
