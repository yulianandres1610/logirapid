import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as any } catch { return null }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  try {
    const cc = await db.query(`
      SELECT cc.*, bt.name as base_type_name, bt.code as base_type_code
      FROM paint_color_cards cc
      JOIN paint_base_types bt ON bt.id = cc.base_type_id
      WHERE cc.id = $1 AND cc.company_id = $2
    `, [parseInt(id), payload.companyId])

    if (cc.rows.length === 0) return NextResponse.json({ success: false, error: 'Color no encontrado' }, { status: 404 })

    const tints = await db.query(`
      SELECT t.*, p.name as tint_product_name, p.sku as tint_product_sku
      FROM paint_color_card_tints t
      JOIN market_products p ON p.id = t.tint_product_id
      WHERE t.color_card_id = $1
    `, [parseInt(id)])

    const r = cc.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        id: r.id, code: r.code, name: r.name, baseTypeId: r.base_type_id,
        baseTypeName: r.base_type_name, hexColor: r.hex_color, notes: r.notes,
        tints: tints.rows.map((t: any) => ({
          id: t.id, tintProductId: t.tint_product_id, tintProductName: t.tint_product_name,
          quantityPerKg: parseFloat(t.quantity_per_kg), unit: t.unit
        }))
      }
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Error al obtener color' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const colorId = parseInt(id)

  try {
    const { name, baseTypeId, hexColor, notes, tints } = await request.json()

    await db.query('BEGIN')
    try {
      await db.query(`
        UPDATE paint_color_cards SET name = $1, base_type_id = $2, hex_color = $3, notes = $4, updated_at = NOW()
        WHERE id = $5 AND company_id = $6
      `, [name, baseTypeId, hexColor || null, notes || null, colorId, payload.companyId])

      if (Array.isArray(tints)) {
        await db.query('DELETE FROM paint_color_card_tints WHERE color_card_id = $1', [colorId])
        for (const t of tints) {
          if (t.tintProductId && t.quantityPerKg > 0) {
            await db.query(`
              INSERT INTO paint_color_card_tints (color_card_id, tint_product_id, quantity_per_kg, unit)
              VALUES ($1, $2, $3, $4)
            `, [colorId, t.tintProductId, t.quantityPerKg, t.unit || 'g'])
          }
        }
      }

      await db.query('COMMIT')
      return NextResponse.json({ success: true, message: 'Color actualizado' })
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  try {
    await db.query('DELETE FROM paint_color_card_tints WHERE color_card_id = $1', [parseInt(id)])
    await db.query('DELETE FROM paint_color_cards WHERE id = $1 AND company_id = $2', [parseInt(id), payload.companyId])
    return NextResponse.json({ success: true, message: 'Color eliminado' })
  } catch (e: any) {
    if (e.code === '23503') return NextResponse.json({ success: false, error: 'No se puede eliminar: está en uso' }, { status: 400 })
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}
