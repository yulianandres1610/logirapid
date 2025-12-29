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
 * GET /api/market/marketplace/[id]
 * Get listing details
 */
export async function GET(
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

    const companyId = payload.companyId
    const listingId = parseInt(id)

    const result = await db.query(`
      SELECT
        ml.*,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.barcode as product_barcode,
        mp.image_url as product_image,
        mp.category as product_category,
        mp.cost_price as product_cost,
        mp.selling_price as product_selling_price,
        mp.description as product_description,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        COALESCE(mws.quantity_on_hand, 0) as warehouse_stock,
        COALESCE(mws.quantity_reserved, 0) as warehouse_reserved
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN market_warehouses mw ON ml.warehouse_id = mw.id
      LEFT JOIN market_warehouse_stock mws ON mws.warehouse_id = ml.warehouse_id AND mws.product_id = ml.product_id
      WHERE ml.id = $1 AND ml.company_id = $2
    `, [listingId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publicacion no encontrada'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get alerts for this listing
    const alertsResult = await db.query(`
      SELECT * FROM marketplace_price_alerts
      WHERE listing_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [listingId])

    // Get history
    const historyResult = await db.query(`
      SELECT * FROM marketplace_listing_history
      WHERE listing_id = $1
      ORDER BY changed_at DESC
      LIMIT 20
    `, [listingId])

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        listingCode: row.listing_code,
        product: {
          id: row.product_id,
          name: row.product_name,
          sku: row.product_sku,
          barcode: row.product_barcode,
          imageUrl: row.product_image,
          category: row.product_category,
          description: row.product_description,
          costPrice: parseFloat(row.product_cost) || 0,
          sellingPrice: parseFloat(row.product_selling_price) || 0
        },
        warehouse: {
          id: row.warehouse_id,
          name: row.warehouse_name,
          code: row.warehouse_code,
          stockAvailable: parseInt(row.warehouse_stock) - parseInt(row.warehouse_reserved) || 0,
          stockOnHand: parseInt(row.warehouse_stock) || 0,
          stockReserved: parseInt(row.warehouse_reserved) || 0
        },
        priceMarketplace: parseFloat(row.price_marketplace) || 0,
        originalProductPrice: parseFloat(row.original_product_price) || 0,
        currency: row.currency || 'USD',
        quantityListed: parseInt(row.quantity_listed) || 0,
        quantitySold: parseInt(row.quantity_sold) || 0,
        quantityAvailable: (parseInt(row.quantity_listed) || 0) - (parseInt(row.quantity_sold) || 0),
        status: row.status,
        isFeatured: row.is_featured,
        marketplaceTitle: row.marketplace_title,
        marketplaceDescription: row.marketplace_description,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        rejectionReason: row.rejection_reason,
        rejectionCategory: row.rejection_category,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        alerts: alertsResult.rows,
        history: historyResult.rows
      }
    })

  } catch (error) {
    console.error('[Marketplace API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener publicacion'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/marketplace/[id]
 * Update a listing
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

    const companyId = payload.companyId
    const userId = payload.userId
    const listingId = parseInt(id)

    const body = await request.json()
    const {
      priceMarketplace,
      quantityListed,
      marketplaceTitle,
      marketplaceDescription,
      action // 'pause', 'resume', 'cancel'
    } = body

    // Get current listing
    const currentResult = await db.query(`
      SELECT ml.*, mp.cost_price, mp.selling_price
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      WHERE ml.id = $1 AND ml.company_id = $2
    `, [listingId, companyId])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publicacion no encontrada'
      }, { status: 404 })
    }

    const current = currentResult.rows[0]

    // Handle actions
    if (action) {
      let newStatus = current.status

      switch (action) {
        case 'pause':
          if (current.status !== 'approved') {
            return NextResponse.json({
              success: false,
              error: 'Solo se pueden pausar publicaciones aprobadas'
            }, { status: 400 })
          }
          newStatus = 'inactive'
          break

        case 'resume':
          if (current.status !== 'inactive') {
            return NextResponse.json({
              success: false,
              error: 'Solo se pueden reactivar publicaciones pausadas'
            }, { status: 400 })
          }
          newStatus = 'approved'
          break

        case 'cancel':
          if (['rejected', 'inactive'].includes(current.status)) {
            return NextResponse.json({
              success: false,
              error: 'Esta publicacion ya esta cancelada o rechazada'
            }, { status: 400 })
          }
          newStatus = 'inactive'

          // Release reserved stock
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - $1),
                updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
          `, [current.quantity_listed - current.quantity_sold, current.warehouse_id, current.product_id])
          break
      }

      await db.query(`
        UPDATE marketplace_listings
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [newStatus, listingId])

      return NextResponse.json({
        success: true,
        data: { id: listingId, status: newStatus },
        message: action === 'pause' ? 'Publicacion pausada' :
                 action === 'resume' ? 'Publicacion reactivada' :
                 'Publicacion cancelada'
      })
    }

    // Handle updates
    const updates: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    let requiresReapproval = false

    if (priceMarketplace !== undefined && priceMarketplace !== current.price_marketplace) {
      updates.push(`price_marketplace = $${paramIndex}`)
      values.push(priceMarketplace)
      paramIndex++

      // Check if significant price change requires reapproval
      const priceDiff = Math.abs((priceMarketplace - current.price_marketplace) / current.price_marketplace) * 100
      if (current.status === 'approved' && priceDiff > 10) {
        requiresReapproval = true
      }

      // Check for price alerts
      const costPrice = parseFloat(current.cost_price)
      const sellingPrice = parseFloat(current.selling_price)

      if (priceMarketplace < costPrice) {
        // Create critical alert
        await db.query(`
          INSERT INTO marketplace_price_alerts (
            listing_id, product_id, company_id,
            alert_type, severity,
            current_price, reference_price,
            price_difference_percent,
            alert_message, status
          ) VALUES ($1, $2, $3, 'price_below_cost', 'critical', $4, $5, $6, $7, 'active')
        `, [
          listingId,
          current.product_id,
          companyId,
          priceMarketplace,
          costPrice,
          ((priceMarketplace - costPrice) / costPrice) * 100,
          `Precio (${priceMarketplace}) menor al costo (${costPrice})`
        ])
      }
    }

    if (quantityListed !== undefined && quantityListed !== current.quantity_listed) {
      const quantityDiff = quantityListed - current.quantity_listed

      // Check stock availability if increasing
      if (quantityDiff > 0) {
        const stockResult = await db.query(`
          SELECT
            COALESCE(quantity_on_hand, 0) - COALESCE(quantity_reserved, 0) as available
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [current.warehouse_id, current.product_id])

        const available = stockResult.rows[0]?.available || 0
        if (quantityDiff > available) {
          return NextResponse.json({
            success: false,
            error: `Stock insuficiente. Disponible adicional: ${available} unidades`
          }, { status: 400 })
        }
      }

      updates.push(`quantity_listed = $${paramIndex}`)
      values.push(quantityListed)
      paramIndex++

      // Update reserved stock
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) + $1),
            updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
      `, [quantityDiff, current.warehouse_id, current.product_id])
    }

    if (marketplaceTitle !== undefined) {
      updates.push(`marketplace_title = $${paramIndex}`)
      values.push(marketplaceTitle)
      paramIndex++
    }

    if (marketplaceDescription !== undefined) {
      updates.push(`marketplace_description = $${paramIndex}`)
      values.push(marketplaceDescription)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // If requires reapproval, change status back to pending
    if (requiresReapproval) {
      updates.push(`status = 'pending'`)
      updates.push(`submitted_at = NOW()`)
    }

    updates.push(`updated_at = NOW()`)

    values.push(listingId, companyId)

    await db.query(`
      UPDATE marketplace_listings
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
    `, values)

    return NextResponse.json({
      success: true,
      data: {
        id: listingId,
        requiresReapproval
      },
      message: requiresReapproval
        ? 'Publicacion actualizada. Requiere nueva aprobacion por cambio significativo de precio.'
        : 'Publicacion actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Marketplace API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar publicacion'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/marketplace/[id]
 * Delete/deactivate a listing
 */
export async function DELETE(
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

    const companyId = payload.companyId
    const listingId = parseInt(id)

    // Get current listing
    const currentResult = await db.query(`
      SELECT * FROM marketplace_listings
      WHERE id = $1 AND company_id = $2
    `, [listingId, companyId])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publicacion no encontrada'
      }, { status: 404 })
    }

    const current = currentResult.rows[0]

    // Calculate stock to release (listed - sold)
    const stockToRelease = current.quantity_listed - current.quantity_sold

    // Release reserved stock
    if (stockToRelease > 0) {
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - $1),
            updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
      `, [stockToRelease, current.warehouse_id, current.product_id])
    }

    // Soft delete - mark as inactive
    await db.query(`
      UPDATE marketplace_listings
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
    `, [listingId])

    return NextResponse.json({
      success: true,
      message: 'Publicacion eliminada',
      data: {
        stockReleased: stockToRelease
      }
    })

  } catch (error) {
    console.error('[Marketplace API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar publicacion'
    }, { status: 500 })
  }
}
