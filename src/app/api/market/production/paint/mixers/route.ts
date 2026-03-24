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
      SELECT * FROM paint_mixers
      WHERE company_id = $1
      ORDER BY capacity_max_kg
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        capacityMinKg: parseFloat(r.capacity_min_kg),
        capacityMaxKg: parseFloat(r.capacity_max_kg),
        mixerType: r.mixer_type,
        isAvailable: r.is_available,
        notes: r.notes,
        createdAt: r.created_at
      }))
    })
  } catch (error) {
    console.error('[Paint Mixers] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener mezcladoras' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { name, capacityMinKg, capacityMaxKg, mixerType, notes } = await request.json()

    if (!name || !capacityMinKg || !capacityMaxKg) {
      return NextResponse.json({ success: false, error: 'Nombre y capacidades son requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO paint_mixers (company_id, name, capacity_min_kg, capacity_max_kg, mixer_type, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [payload.companyId, name, capacityMinKg, capacityMaxKg, mixerType || 'large', notes || null])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Mezcladora creada'
    })
  } catch (error) {
    console.error('[Paint Mixers] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear mezcladora' }, { status: 500 })
  }
}
