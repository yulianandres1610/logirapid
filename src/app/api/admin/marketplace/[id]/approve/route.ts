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
 * PUT /api/admin/marketplace/[id]/approve
 * Approve a marketplace listing (SUPER_ADMIN only)
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
        error: 'Solo SUPER_ADMIN puede aprobar publicaciones'
      }, { status: 403 })
    }

    const listingId = parseInt(id)
    const userId = payload.userId

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
        error: `Solo se pueden aprobar publicaciones pendientes. Estado actual: ${listing.status}`
      }, { status: 400 })
    }

    // Approve the listing
    await db.query(`
      UPDATE marketplace_listings
      SET
        status = 'approved',
        approved_by = $1,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `, [userId, listingId])

    // Resolve any active price alerts (mark as acknowledged)
    await db.query(`
      UPDATE marketplace_price_alerts
      SET
        status = 'acknowledged',
        resolved_by = $1,
        resolved_at = NOW(),
        resolution_action = 'approved_with_alert'
      WHERE listing_id = $2 AND status = 'active'
    `, [userId, listingId])

    // Create stats entry if not exists
    await db.query(`
      INSERT INTO marketplace_listing_stats (listing_id)
      VALUES ($1)
      ON CONFLICT (listing_id) DO NOTHING
    `, [listingId])

    console.log(`[Admin Marketplace] Listing ${listing.listing_code} approved by user ${userId}. Product: ${listing.product_name}, Market: ${listing.company_name}`)

    return NextResponse.json({
      success: true,
      data: {
        id: listingId,
        listingCode: listing.listing_code,
        status: 'approved'
      },
      message: `Publicacion ${listing.listing_code} aprobada exitosamente`
    })

  } catch (error) {
    console.error('[Admin Marketplace Approve] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al aprobar publicacion'
    }, { status: 500 })
  }
}
