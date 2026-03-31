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
 * GET /api/market/warehouses/[id]/supplier-returns/suppliers
 * Lista proveedores con stock de consignación disponible para devolución
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

    // Get suppliers that have available stock in this warehouse
    // Use market_suppliers (unified table) - lot_inventory.supplier_id references market_suppliers.id
    const suppliersResult = await db.query(`
      SELECT
        ms.id,
        ms.supplier_code as code,
        ms.name,
        SUM(cli.quantity_available) as total_stock,
        SUM(cli.quantity_available * cli.unit_cost) as total_value
      FROM market_suppliers ms
      JOIN consignment_lot_inventory cli ON cli.supplier_id = ms.id
      WHERE cli.warehouse_id = $1
        AND cli.company_id = $2
        AND cli.quantity_available > 0
      GROUP BY ms.id, ms.supplier_code, ms.name
      HAVING SUM(cli.quantity_available) > 0
      ORDER BY ms.name
    `, [warehouseId, payload.companyId])

    const suppliers = suppliersResult.rows.map(row => ({
      id: parseInt(row.id),
      code: row.code,
      name: row.name,
      totalStock: parseInt(row.total_stock),
      totalValue: parseFloat(row.total_value)
    }))

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        count: suppliers.length
      }
    })

  } catch (error) {
    console.error('[Supplier Returns - Suppliers] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedores'
    }, { status: 500 })
  }
}
