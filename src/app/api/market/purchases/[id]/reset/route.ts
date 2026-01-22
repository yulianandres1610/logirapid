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
 * POST /api/market/purchases/[id]/reset
 * Reset a purchase order to allow re-receiving
 *
 * Body:
 * - newQuantity: optional - update line quantity to this value (useful for corrections)
 * - resetReceived: boolean - reset quantity_received to 0
 *
 * Only SUPER_ADMIN, ADMIN, MARKET_MANAGER can use this endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Only allow admins and managers
    const canReset = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER', 'MANAGER'].includes(payload.role)
    if (!canReset) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para resetear órdenes de compra'
      }, { status: 403 })
    }

    const companyId = payload.companyId
    const purchaseId = parseInt(id)

    const body = await request.json()
    const { newQuantity, resetReceived = true, newStatus = 'comprada' } = body

    // Verify purchase exists and belongs to company
    const purchaseResult = await db.query(`
      SELECT id, purchase_number, status, company_id
      FROM market_purchases
      WHERE id = $1 AND company_id = $2
    `, [purchaseId, companyId])

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Compra no encontrada'
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]

    await db.transaction(async (client) => {
      // Reset quantity_received if requested
      if (resetReceived) {
        await client.query(`
          UPDATE market_purchase_lines
          SET quantity_received = 0
          WHERE purchase_id = $1
        `, [purchaseId])
      }

      // Update quantity if provided
      if (newQuantity !== undefined && newQuantity !== null) {
        await client.query(`
          UPDATE market_purchase_lines
          SET quantity = $1,
              total_price = quantity * unit_price
          WHERE purchase_id = $2
        `, [newQuantity, purchaseId])

        // Recalculate purchase totals
        const totalsResult = await client.query(`
          SELECT SUM(total_price) as subtotal
          FROM market_purchase_lines
          WHERE purchase_id = $1
        `, [purchaseId])

        const subtotal = parseFloat(totalsResult.rows[0]?.subtotal) || 0

        await client.query(`
          UPDATE market_purchases
          SET subtotal = $1, total_amount = $1, updated_at = NOW()
          WHERE id = $2
        `, [subtotal, purchaseId])
      }

      // Update status to allow receiving again
      await client.query(`
        UPDATE market_purchases
        SET status = $1,
            received_by = NULL,
            received_date = NULL,
            updated_at = NOW()
        WHERE id = $2
      `, [newStatus, purchaseId])

      console.log(`[Purchase Reset] Order ${purchase.purchase_number} reset by user ${payload.email}`)
    })

    return NextResponse.json({
      success: true,
      message: `Orden ${purchase.purchase_number} reseteada correctamente. Estado: ${newStatus}`,
      data: {
        purchaseId,
        purchaseNumber: purchase.purchase_number,
        newStatus,
        quantityUpdated: newQuantity !== undefined,
        receivedReset: resetReceived
      }
    })

  } catch (error) {
    console.error('[Purchase Reset API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al resetear orden'
    }, { status: 500 })
  }
}
