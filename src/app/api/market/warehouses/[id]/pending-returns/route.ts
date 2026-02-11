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
        r.notes,
        r.created_at,
        r.created_by,
        o.order_number,
        s.name as supplier_name,
        s.code as supplier_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name
      FROM consignment_returns r
      LEFT JOIN consignment_orders o ON o.id = r.order_id
      JOIN market_suppliers s ON s.id = r.supplier_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.warehouse_id = $1 AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `, [warehouseId])

    // Get return lines for each return
    const pendingReturns = await Promise.all(returnsResult.rows.map(async (r) => {
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
    return NextResponse.json({
      success: false,
      error: 'Error al cargar devoluciones pendientes'
    }, { status: 500 })
  }
}
