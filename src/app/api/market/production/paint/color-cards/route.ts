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
  const baseTypeId = searchParams.get('baseTypeId')
  const search = searchParams.get('search')

  try {
    let query = `
      SELECT cc.*, bt.name as base_type_name, bt.code as base_type_code,
             (SELECT COUNT(*) FROM paint_color_card_tints t WHERE t.color_card_id = cc.id) as tint_count
      FROM paint_color_cards cc
      JOIN paint_base_types bt ON bt.id = cc.base_type_id
      WHERE cc.company_id = $1
    `
    const params: any[] = [payload.companyId]

    if (baseTypeId) {
      params.push(parseInt(baseTypeId))
      query += ` AND cc.base_type_id = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      query += ` AND (cc.name ILIKE $${params.length} OR cc.code ILIKE $${params.length})`
    }

    query += ' ORDER BY cc.name'
    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        baseTypeId: r.base_type_id,
        baseTypeName: r.base_type_name,
        baseTypeCode: r.base_type_code,
        hexColor: r.hex_color,
        isActive: r.is_active,
        tintCount: parseInt(r.tint_count) || 0,
        notes: r.notes,
        createdAt: r.created_at
      }))
    })
  } catch (error) {
    console.error('[Paint Color Cards] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener cartas de color' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { code, name, baseTypeId, hexColor, notes, tints } = await request.json()

    if (!code || !name || !baseTypeId) {
      return NextResponse.json({ success: false, error: 'Código, nombre y tipo de base son requeridos' }, { status: 400 })
    }

    // Transaction: create color card + tints
    const client = await db.query('BEGIN')
    try {
      const ccResult = await db.query(`
        INSERT INTO paint_color_cards (company_id, code, name, base_type_id, hex_color, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [payload.companyId, code.toUpperCase(), name, baseTypeId, hexColor || null, notes || null])

      const colorCardId = ccResult.rows[0].id

      // Insert tints
      if (Array.isArray(tints) && tints.length > 0) {
        for (const tint of tints) {
          if (tint.tintProductId && tint.quantityPerKg > 0) {
            await db.query(`
              INSERT INTO paint_color_card_tints (color_card_id, tint_product_id, quantity_per_kg, unit, notes)
              VALUES ($1, $2, $3, $4, $5)
            `, [colorCardId, tint.tintProductId, tint.quantityPerKg, tint.unit || 'g', tint.notes || null])
          }
        }
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: { id: colorCardId },
        message: 'Carta de color creada'
      })
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Ya existe una carta de color con ese código' }, { status: 400 })
    }
    console.error('[Paint Color Cards] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear carta de color' }, { status: 500 })
  }
}
