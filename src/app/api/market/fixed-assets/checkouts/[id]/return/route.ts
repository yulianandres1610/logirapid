import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/market/fixed-assets/checkouts/[id]/return
 * Register asset return
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { id } = await params
    const checkoutId = parseInt(id)
    const body = await request.json()
    const { notes, condition = 'good' } = body

    const result = await db.transaction(async (client) => {
      // Get checkout record with lock
      const checkoutResult = await client.query(`
        SELECT c.id, c.asset_id, c.status, c.company_id, a.name as asset_name
        FROM market_asset_checkouts c
        LEFT JOIN market_fixed_assets a ON c.asset_id = a.id
        WHERE c.id = $1
        ${payload.role !== 'SUPER_ADMIN' ? 'AND c.company_id = $2' : ''}
        FOR UPDATE
      `, payload.role !== 'SUPER_ADMIN' ? [checkoutId, payload.companyId] : [checkoutId])

      if (checkoutResult.rows.length === 0) {
        throw new Error('NOT_FOUND')
      }

      if (checkoutResult.rows[0].status === 'returned') {
        throw new Error('ALREADY_RETURNED')
      }

      const assetId = checkoutResult.rows[0].asset_id
      const assetName = checkoutResult.rows[0].asset_name

      // Update checkout record
      await client.query(`
        UPDATE market_asset_checkouts
        SET return_date = NOW(), return_by = $1, return_notes = $2, return_condition = $3, status = 'returned'
        WHERE id = $4
      `, [payload.userId, notes || null, condition, checkoutId])

      // Mark asset as available
      await client.query(`
        UPDATE market_fixed_assets SET is_checked_out = false WHERE id = $1
      `, [assetId])

      return { assetName }
    })

    return NextResponse.json({
      success: true,
      message: `Devolución de "${result.assetName}" registrada exitosamente`
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Checkout Return] Error:', err)

    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Préstamo no encontrado'
      }, { status: 404 })
    }

    if (err.message === 'ALREADY_RETURNED') {
      return NextResponse.json({
        success: false,
        error: 'Este activo ya fue devuelto'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al registrar devolución'
    }, { status: 500 })
  }
}
