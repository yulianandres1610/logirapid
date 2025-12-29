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
 * PUT /api/admin/marketplace/[id]/reject
 * Reject a marketplace listing with reason (SUPER_ADMIN only)
 */
export async function PUT(
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

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede rechazar publicaciones'
      }, { status: 403 })
    }

    const listingId = parseInt(id)
    const userId = payload.userId

    const body = await request.json()
    const { reason, category } = body

    if (!reason) {
      return NextResponse.json({
        success: false,
        error: 'El motivo de rechazo es requerido'
      }, { status: 400 })
    }

    // Get current listing
    const currentResult = await db.query(`
      SELECT ml.*, mp.name as product_name, c.legalname as company_name
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.id = $1
    `, [listingId])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publicacion no encontrada'
      }, { status: 404 })
    }

    const listing = currentResult.rows[0]

    if (listing.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Solo se pueden rechazar publicaciones pendientes. Estado actual: ${listing.status}`
      }, { status: 400 })
    }

    // Reject the listing
    await db.query(`
      UPDATE marketplace_listings
      SET
        status = 'rejected',
        rejected_by = $1,
        rejected_at = NOW(),
        rejection_reason = $2,
        rejection_category = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [userId, reason, category || null, listingId])

    // Release reserved stock back to warehouse
    const stockToRelease = listing.quantity_listed - listing.quantity_sold
    if (stockToRelease > 0) {
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - $1),
            updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
      `, [stockToRelease, listing.warehouse_id, listing.product_id])
    }

    // Resolve any active price alerts
    await db.query(`
      UPDATE marketplace_price_alerts
      SET
        status = 'resolved',
        resolved_by = $1,
        resolved_at = NOW(),
        resolution_action = 'listing_rejected',
        resolution_notes = $2
      WHERE listing_id = $3 AND status = 'active'
    `, [userId, reason, listingId])

    console.log(`[Admin Marketplace] Listing ${listing.listing_code} rejected by user ${userId}. Reason: ${reason}. Product: ${listing.product_name}, Market: ${listing.company_name}`)

    return NextResponse.json({
      success: true,
      data: {
        id: listingId,
        listingCode: listing.listing_code,
        status: 'rejected',
        stockReleased: stockToRelease
      },
      message: `Publicacion ${listing.listing_code} rechazada`
    })

  } catch (error) {
    console.error('[Admin Marketplace Reject] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al rechazar publicacion'
    }, { status: 500 })
  }
}
