import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/migrations/fix-pur-2026-0010
 * Fix purchase order PUR-2026-0010:
 * - Update quantity to 37.40
 * - Reset quantity_received to 0
 * - Set status to 'comprada'
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - necesita autenticación'
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

    // Only allow admins
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para ejecutar migraciones'
      }, { status: 403 })
    }

    const results: string[] = []

    // Find the purchase order
    const purchaseResult = await db.query(`
      SELECT mp.id, mp.purchase_number, mp.status, mp.company_id,
             mpl.id as line_id, mpl.quantity, mpl.quantity_received, mpl.unit_price
      FROM market_purchases mp
      JOIN market_purchase_lines mpl ON mpl.purchase_id = mp.id
      WHERE mp.purchase_number = 'PUR-2026-0010'
    `)

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden PUR-2026-0010 no encontrada'
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]
    results.push(`Encontrada orden: ${purchase.purchase_number}, status actual: ${purchase.status}`)
    results.push(`Línea ID: ${purchase.line_id}, cantidad actual: ${purchase.quantity}, recibido: ${purchase.quantity_received}`)

    // Update the order
    await db.transaction(async (client) => {
      // Update line quantity to 37.40 and reset quantity_received
      const newQuantity = 37.40
      const unitPrice = parseFloat(purchase.unit_price) || 0
      const totalPrice = newQuantity * unitPrice

      await client.query(`
        UPDATE market_purchase_lines
        SET quantity = $1,
            quantity_received = 0,
            total_price = $2
        WHERE purchase_id = $3
      `, [newQuantity, totalPrice, purchase.id])

      results.push(`Cantidad actualizada a: ${newQuantity}, total: ${totalPrice.toFixed(2)}`)

      // Update purchase totals
      await client.query(`
        UPDATE market_purchases
        SET subtotal = $1,
            total_amount = $1,
            status = 'comprada',
            received_by = NULL,
            received_date = NULL,
            updated_at = NOW()
        WHERE id = $2
      `, [totalPrice, purchase.id])

      results.push(`Orden actualizada: status = 'comprada', cantidad_recibida reseteada`)
    })

    return NextResponse.json({
      success: true,
      message: 'Orden PUR-2026-0010 corregida exitosamente',
      data: {
        purchaseNumber: 'PUR-2026-0010',
        newQuantity: 37.40,
        newStatus: 'comprada',
        results
      }
    })

  } catch (error) {
    console.error('[Fix PUR-2026-0010] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir orden'
    }, { status: 500 })
  }
}
