import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface ApproveRequest {
  receiverNotes?: string
  items?: {
    id: number
    actualRetailPrice: number
  }[]
}

/**
 * POST /api/consignments/orders/[id]/approve
 * Approve a pending consignment order (as receiver)
 * This imports product catalog but does NOT add stock
 * Stock is added when the receiver calls /receive after the order is in_transit
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const userIdCookie = cookieStore.get('user-id')
    const currentCompanyId = companyIdCookie?.value
    const userId = userIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params
    const body: ApproveRequest = await request.json().catch(() => ({}))
    const { receiverNotes, items } = body

    // Verify order exists and is pending approval for current company as receiver
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        co.provider_company_id,
        p.legalname as provider_name
      FROM consignment_orders co
      LEFT JOIN companies p ON p.id = co.provider_company_id
      WHERE co.id = $1 AND co.receiver_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    if (order.status !== 'pending_approval') {
      return NextResponse.json({
        success: false,
        error: 'Esta consignación no está pendiente de aprobación'
      }, { status: 400 })
    }

    await db.query('BEGIN')

    try {
      // Update retail prices if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await db.query(`
            UPDATE consignment_order_items
            SET actual_retail_price = $1
            WHERE id = $2 AND consignment_order_id = $3
          `, [item.actualRetailPrice, item.id, id])
        }
      }

      // Get all items with product details from provider
      const orderItems = await db.query(`
        SELECT
          coi.*,
          mp.name as product_name,
          mp.sku as product_sku,
          mp.barcode as product_barcode,
          mp.description as product_description,
          mp.category_id as product_category_id,
          mp.unit_of_measure as product_unit,
          mp.image_url as product_image_url,
          mp.weight as product_weight,
          mp.dimensions as product_dimensions,
          mp.is_active as product_is_active
        FROM consignment_order_items coi
        LEFT JOIN market_products mp ON mp.id = coi.product_id
        WHERE coi.consignment_order_id = $1
      `, [id])

      // Import product catalog to receiver's company
      // For each product, check if it already exists in receiver's catalog
      // If not, create it with provider_price as the cost
      let productsImported = 0
      for (const item of orderItems.rows) {
        // Check if product with same SKU or barcode exists in receiver's catalog
        const existingProduct = await db.query(`
          SELECT id FROM market_products
          WHERE company_id = $1 AND (sku = $2 OR barcode = $3)
        `, [currentCompanyId, item.product_sku, item.product_barcode])

        if (existingProduct.rows.length === 0) {
          // Create new product in receiver's catalog
          await db.query(`
            INSERT INTO market_products (
              company_id,
              name,
              sku,
              barcode,
              description,
              category_id,
              unit_of_measure,
              cost,
              price,
              image_url,
              weight,
              dimensions,
              is_active,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          `, [
            currentCompanyId,
            item.product_name,
            item.product_sku,
            item.product_barcode,
            item.product_description,
            item.product_category_id,
            item.product_unit,
            item.provider_price,  // Cost for receiver = provider's price
            item.actual_retail_price || item.suggested_retail_price || item.provider_price * 1.3,  // Default 30% margin
            item.product_image_url,
            item.product_weight,
            item.product_dimensions,
            true
          ])
          productsImported++
        }
      }

      // Create or get wallet for this provider-receiver relationship
      const walletResult = await db.query(`
        INSERT INTO consignment_wallets (provider_company_id, receiver_company_id)
        VALUES ($1, $2)
        ON CONFLICT (provider_company_id, receiver_company_id)
        DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [order.provider_company_id, currentCompanyId])

      // Update order status to approved (not received - that happens after send → receive)
      await db.query(`
        UPDATE consignment_orders
        SET status = 'approved',
            receiver_notes = $1,
            approved_by = $2,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [receiverNotes || null, userId, id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Consignación ${order.order_number} aprobada. ${productsImported > 0 ? `${productsImported} productos importados al catálogo.` : ''} Esperando envío del proveedor.`,
        data: {
          id: order.id,
          orderNumber: order.order_number,
          status: 'approved',
          productsImported,
          totalItems: orderItems.rows.length,
          walletId: walletResult.rows[0].id
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consignment Approve] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al aprobar consignación'
    }, { status: 500 })
  }
}
