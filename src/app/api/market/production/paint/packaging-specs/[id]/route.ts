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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  try {
    await db.query('DELETE FROM paint_packaging_specs WHERE id = $1 AND company_id = $2', [parseInt(id), payload.companyId])
    return NextResponse.json({ success: true, message: 'Envase eliminado' })
  } catch (e: any) {
    if (e.code === '23503') return NextResponse.json({ success: false, error: 'No se puede eliminar: está en uso' }, { status: 400 })
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}
