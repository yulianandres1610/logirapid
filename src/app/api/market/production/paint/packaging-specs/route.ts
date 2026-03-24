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

export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const result = await db.query(`
      SELECT ps.*,
             cp.name as container_name, cp.sku as container_sku,
             lp.name as label_name, lp.sku as label_sku,
             ldp.name as lid_name, ldp.sku as lid_sku
      FROM paint_packaging_specs ps
      LEFT JOIN market_products cp ON cp.id = ps.container_product_id
      LEFT JOIN market_products lp ON lp.id = ps.label_product_id
      LEFT JOIN market_products ldp ON ldp.id = ps.lid_product_id
      WHERE ps.company_id = $1
      ORDER BY ps.volume_liters
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        volumeLiters: parseFloat(r.volume_liters),
        netWeightKg: parseFloat(r.net_weight_kg),
        containerProductId: r.container_product_id,
        containerName: r.container_name,
        containerSku: r.container_sku,
        labelProductId: r.label_product_id,
        labelName: r.label_name,
        labelSku: r.label_sku,
        lidProductId: r.lid_product_id,
        lidName: r.lid_name,
        lidSku: r.lid_sku,
        laborCostPerUnit: parseFloat(r.labor_cost_per_unit) || 0,
        isActive: r.is_active,
        createdAt: r.created_at
      }))
    })
  } catch (error) {
    console.error('[Paint Packaging Specs] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener especificaciones de envase' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { name, volumeLiters, netWeightKg, containerProductId, labelProductId, lidProductId, laborCostPerUnit } = await request.json()

    if (!name || !volumeLiters || !netWeightKg) {
      return NextResponse.json({ success: false, error: 'Nombre, volumen y peso neto son requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO paint_packaging_specs (company_id, name, volume_liters, net_weight_kg, container_product_id, label_product_id, lid_product_id, labor_cost_per_unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [payload.companyId, name, volumeLiters, netWeightKg, containerProductId || null, labelProductId || null, lidProductId || null, laborCostPerUnit || 0])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Especificación de envase creada'
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Ya existe una especificación para ese volumen' }, { status: 400 })
    }
    console.error('[Paint Packaging Specs] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear especificación' }, { status: 500 })
  }
}
