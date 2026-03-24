import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number; companyName: string }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  try {
    let query = `
      SELECT po.*,
        (SELECT COUNT(*) FROM paint_production_lines pl WHERE pl.paint_order_id = po.id) as line_count,
        (SELECT SUM(pl.quantity_units) FROM paint_production_lines pl WHERE pl.paint_order_id = po.id) as total_units,
        (SELECT COUNT(*) FROM paint_production_steps ps WHERE ps.paint_order_id = po.id) as step_count,
        (SELECT COUNT(*) FROM paint_production_steps ps WHERE ps.paint_order_id = po.id AND ps.status = 'completed') as completed_steps
      FROM paint_production_orders po
      WHERE po.company_id = $1
    `
    const params: any[] = [payload.companyId]

    if (status) {
      params.push(status)
      query += ` AND po.status = $${params.length}`
    }

    query += ' ORDER BY po.created_at DESC LIMIT 100'
    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        orderNumber: r.order_number,
        status: r.status,
        plannedDate: r.planned_date,
        lineCount: parseInt(r.line_count) || 0,
        totalUnits: parseInt(r.total_units) || 0,
        stepCount: parseInt(r.step_count) || 0,
        completedSteps: parseInt(r.completed_steps) || 0,
        totalCost: parseFloat(r.total_cost) || 0,
        notes: r.notes,
        createdAt: r.created_at
      }))
    })
  } catch (error) {
    console.error('[Paint Orders] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener órdenes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { lines, plannedDate, warehouseId, targetWarehouseId, notes, sourceQuoteId } = await request.json()

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, error: 'Se requiere al menos una línea' }, { status: 400 })
    }

    // Generate order number
    const yearStr = new Date().getFullYear().toString()
    const countResult = await db.query(
      `SELECT COUNT(*) as c FROM paint_production_orders WHERE company_id = $1 AND order_number LIKE $2`,
      [payload.companyId, `PPRD-${yearStr}-%`]
    )
    const nextNum = (parseInt(countResult.rows[0].c) || 0) + 1
    const orderNumber = `PPRD-${yearStr}-${String(nextNum).padStart(5, '0')}`

    // Begin transaction
    await db.query('BEGIN')

    try {
      // Create order
      const orderResult = await db.query(`
        INSERT INTO paint_production_orders (company_id, order_number, status, planned_date, warehouse_id, target_warehouse_id, notes, source_quote_id, created_by)
        VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [payload.companyId, orderNumber, plannedDate || null, warehouseId || null, targetWarehouseId || null, notes || null, sourceQuoteId || null, payload.userId])

      const orderId = orderResult.rows[0].id

      // Insert lines
      for (const line of lines) {
        const pkg = await db.query('SELECT net_weight_kg FROM paint_packaging_specs WHERE id = $1', [line.packagingSpecId])
        const netWeightKg = pkg.rows[0] ? parseFloat(pkg.rows[0].net_weight_kg) : 1
        const totalWeightKg = line.quantityUnits * netWeightKg

        await db.query(`
          INSERT INTO paint_production_lines (paint_order_id, color_card_id, packaging_spec_id, finished_product_id, quantity_units, total_weight_kg)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [orderId, line.colorCardId, line.packagingSpecId, line.finishedProductId || null, line.quantityUnits, totalWeightKg])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: { id: orderId, orderNumber },
        message: `Orden ${orderNumber} creada exitosamente`
      })
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }
  } catch (error) {
    console.error('[Paint Orders] Error creating:', error)
    return NextResponse.json({ success: false, error: 'Error al crear orden' }, { status: 500 })
  }
}
