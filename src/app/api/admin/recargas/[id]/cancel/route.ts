import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/admin/recargas/[id]/cancel
 * Cancela una orden de recarga pendiente de pago
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rechargeId = parseInt(id)

    if (isNaN(rechargeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de recarga inválido'
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Verificar que la orden existe y está pendiente de pago
    let query = `
      SELECT id, status, payment_status, company_id
      FROM recharge_transactions
      WHERE id = $1
    `
    const queryParams: (number | string)[] = [rechargeId]

    // Filter by company for non-SUPER_ADMIN
    if (payload.role !== 'SUPER_ADMIN') {
      query += ` AND company_id = $2`
      queryParams.push(payload.companyId)
    }

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Recarga no encontrada'
      }, { status: 404 })
    }

    const recharge = result.rows[0]

    // Solo se pueden cancelar órdenes pendientes de pago
    if (recharge.status !== 'pending' || recharge.payment_status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden cancelar órdenes pendientes de pago'
      }, { status: 400 })
    }

    // Cancelar la orden
    await db.query(`
      UPDATE recharge_transactions
      SET status = 'cancelled', payment_status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [rechargeId])

    // También cancelar el payment link asociado
    await db.query(`
      UPDATE payment_links
      SET status = 'cancelled', updated_at = NOW()
      WHERE order_type = 'recharge' AND order_id = $1 AND status = 'pending'
    `, [rechargeId])

    console.log(`[Recargas] Orden ${rechargeId} cancelada por usuario ${payload.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Orden cancelada exitosamente'
    })

  } catch (error) {
    console.error('[Recargas] Error cancelling recharge:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cancelar la recarga'
    }, { status: 500 })
  }
}
