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

const RETURN_REASON_LABELS: Record<string, string> = {
  not_sold: 'Producto no vendido',
  damaged: 'Producto dañado',
  expired: 'Producto próximo a vencer',
  agreement: 'Acuerdo con proveedor',
  other: 'Otro motivo'
}

/**
 * GET /api/market/warehouses/[id]/pending-returns
 * List pending supplier returns for a warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)

    // Verify warehouse belongs to company
    const warehouseResult = await db.query(
      'SELECT id, name, code FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Get pending returns with lines
    // First, just get the basic return data
    const returnsResult = await db.query(`
      SELECT
        r.id,
        r.return_number,
        r.order_id,
        r.supplier_id,
        r.status,
        r.total_items,
        r.total_units,
        r.total_value,
        r.reason,
        r.created_at,
        r.created_by
      FROM consignment_returns r
      WHERE r.warehouse_id = $1 AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `, [warehouseId])

    // For each return, get additional info with separate queries to avoid JOIN issues
    const enrichedReturns = await Promise.all(returnsResult.rows.map(async (r) => {
      // Get order info
      let orderNumber = null
      if (r.order_id) {
        const orderResult = await db.query(
          'SELECT order_number FROM consignment_orders WHERE id = $1',
          [r.order_id]
        )
        orderNumber = orderResult.rows[0]?.order_number
      }

      // Get supplier info
      let supplierName = 'Proveedor no encontrado'
      let supplierCode = ''
      if (r.supplier_id) {
        const supplierResult = await db.query(
          'SELECT name, supplier_code FROM market_suppliers WHERE id = $1',
          [r.supplier_id]
        )
        if (supplierResult.rows.length > 0) {
          supplierName = supplierResult.rows[0].name
          supplierCode = supplierResult.rows[0].supplier_code || ''
        }
      }

      // Get created by name
      let createdByName = null
      if (r.created_by) {
        const userResult = await db.query(
          "SELECT COALESCE(firstname || ' ' || lastname, email) as name FROM users WHERE id = $1",
          [r.created_by]
        )
        createdByName = userResult.rows[0]?.name
      }

      return {
        ...r,
        order_number: orderNumber,
        supplier_name: supplierName,
        supplier_code: supplierCode,
        created_by_name: createdByName
      }
    }))

    // Get return lines for each return
    const pendingReturns = await Promise.all(enrichedReturns.map(async (r) => {
      const linesResult = await db.query(`
        SELECT
          rl.id,
          rl.order_line_id,
          rl.product_id,
          rl.quantity_to_return,
          rl.unit_cost,
          p.name as product_name,
          p.sku as product_sku,
          p.barcode as product_barcode,
          p.image_url as product_image
        FROM consignment_return_lines rl
        JOIN market_products p ON p.id = rl.product_id
        WHERE rl.return_id = $1
        ORDER BY rl.id
      `, [r.id])

      return {
        id: r.id,
        returnNumber: r.return_number,
        orderNumber: r.order_number,
        orderId: r.order_id,
        supplier: {
          id: r.supplier_id,
          code: r.supplier_code,
          name: r.supplier_name
        },
        status: r.status,
        totalItems: parseInt(r.total_items) || 0,
        totalUnits: parseInt(r.total_units) || 0,
        totalValue: parseFloat(r.total_value) || 0,
        reason: r.reason,
        reasonLabel: RETURN_REASON_LABELS[r.reason] || r.reason,
        notes: r.notes,
        createdAt: r.created_at,
        createdByName: r.created_by_name,
        lines: linesResult.rows.map(l => ({
          id: l.id,
          orderLineId: l.order_line_id,
          product: {
            id: l.product_id,
            name: l.product_name,
            sku: l.product_sku,
            barcode: l.product_barcode,
            imageUrl: l.product_image
          },
          quantityToReturn: parseInt(l.quantity_to_return) || 0,
          unitCost: parseFloat(l.unit_cost) || 0
        }))
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        warehouse: warehouseResult.rows[0],
        pendingReturns
      }
    })

  } catch (error) {
    console.error('[Pending Returns GET] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({
      success: false,
      error: `Error al cargar devoluciones pendientes: ${errorMessage}`
    }, { status: 500 })
  }
}
