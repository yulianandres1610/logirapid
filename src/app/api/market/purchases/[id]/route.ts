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
 * GET /api/market/purchases/[id]
 * Get purchase details with lines
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
    const purchaseId = parseInt(id)

    // Get purchase
    const purchaseResult = await db.query(`
      SELECT
        mp.id,
        mp.purchase_number,
        mp.supplier_name,
        mp.supplier_contact,
        mp.supplier_address,
        mp.subtotal,
        mp.tax_amount,
        mp.total_amount,
        mp.currency,
        mp.status,
        mp.purchase_date,
        mp.expected_date,
        mp.received_date,
        mp.notes,
        mp.created_at,
        mp.updated_at,
        u1.name as created_by_name,
        u2.name as confirmed_by_name,
        u3.name as received_by_name
      FROM market_purchases mp
      LEFT JOIN users u1 ON mp.created_by = u1.id
      LEFT JOIN users u2 ON mp.confirmed_by = u2.id
      LEFT JOIN users u3 ON mp.received_by = u3.id
      WHERE mp.id = $1 AND mp.company_id = $2
    `, [purchaseId, companyId])

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Compra no encontrada'
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]

    // Get lines
    const linesResult = await db.query(`
      SELECT
        mpl.id,
        mpl.product_id,
        mpl.quantity,
        mpl.unit_price,
        mpl.total_price,
        mpl.quantity_received,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.image_url as product_image
      FROM market_purchase_lines mpl
      JOIN market_products mp ON mpl.product_id = mp.id
      WHERE mpl.purchase_id = $1
      ORDER BY mpl.id
    `, [purchaseId])

    return NextResponse.json({
      success: true,
      data: {
        id: purchase.id,
        purchaseNumber: purchase.purchase_number,
        supplierName: purchase.supplier_name,
        supplierContact: purchase.supplier_contact,
        supplierAddress: purchase.supplier_address,
        subtotal: parseFloat(purchase.subtotal) || 0,
        taxAmount: parseFloat(purchase.tax_amount) || 0,
        totalAmount: parseFloat(purchase.total_amount) || 0,
        currency: purchase.currency || 'USD',
        status: purchase.status,
        purchaseDate: purchase.purchase_date,
        expectedDate: purchase.expected_date,
        receivedDate: purchase.received_date,
        notes: purchase.notes,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at,
        createdByName: purchase.created_by_name,
        confirmedByName: purchase.confirmed_by_name,
        receivedByName: purchase.received_by_name,
        lines: linesResult.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          productSku: line.product_sku,
          productImage: line.product_image,
          quantity: parseInt(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          totalPrice: parseFloat(line.total_price) || 0,
          quantityReceived: parseInt(line.quantity_received) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Market Purchase API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener compra'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/purchases/[id]
 * Update purchase (only draft) or change status
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
    const purchaseId = parseInt(id)

    const body = await request.json()
    const { action, lines } = body

    // Get current purchase
    const purchaseResult = await db.query(`
      SELECT id, status, company_id FROM market_purchases WHERE id = $1
    `, [purchaseId])

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Compra no encontrada'
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]

    if (purchase.company_id !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 403 })
    }

    // Handle different actions
    if (action === 'confirm') {
      if (purchase.status !== 'draft') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden confirmar compras en borrador'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE market_purchases
        SET status = 'confirmed',
            confirmed_by = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [userId, purchaseId])

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada exitosamente'
      })
    }

    if (action === 'receive') {
      if (purchase.status !== 'confirmed') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden recibir compras confirmadas'
        }, { status: 400 })
      }

      // Receive all items and update inventory
      await db.transaction(async (client) => {
        // Get lines
        const linesResult = await client.query(`
          SELECT id, product_id, quantity FROM market_purchase_lines WHERE purchase_id = $1
        `, [purchaseId])

        // Update each product's inventory
        for (const line of linesResult.rows) {
          // Update product stock
          await client.query(`
            UPDATE market_products
            SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
                quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1),
                updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])

          // Update line as received
          await client.query(`
            UPDATE market_purchase_lines
            SET quantity_received = quantity
            WHERE id = $1
          `, [line.id])
        }

        // Update purchase status
        await client.query(`
          UPDATE market_purchases
          SET status = 'received',
              received_by = $1,
              received_date = CURRENT_DATE,
              updated_at = NOW()
          WHERE id = $2
        `, [userId, purchaseId])
      })

      return NextResponse.json({
        success: true,
        message: 'Compra recibida exitosamente. Inventario actualizado.'
      })
    }

    if (action === 'cancel') {
      if (purchase.status === 'received') {
        return NextResponse.json({
          success: false,
          error: 'No se pueden cancelar compras ya recibidas'
        }, { status: 400 })
      }

      await db.transaction(async (client) => {
        // If confirmed, revert expected quantities
        if (purchase.status === 'confirmed' || purchase.status === 'draft') {
          const linesResult = await client.query(`
            SELECT product_id, quantity FROM market_purchase_lines WHERE purchase_id = $1
          `, [purchaseId])

          for (const line of linesResult.rows) {
            await client.query(`
              UPDATE market_products
              SET quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1),
                  updated_at = NOW()
              WHERE id = $2
            `, [line.quantity, line.product_id])
          }
        }

        await client.query(`
          UPDATE market_purchases
          SET status = 'cancelled',
              updated_at = NOW()
          WHERE id = $1
        `, [purchaseId])
      })

      return NextResponse.json({
        success: true,
        message: 'Compra cancelada exitosamente'
      })
    }

    // Update draft purchase
    if (purchase.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden editar compras en borrador'
      }, { status: 400 })
    }

    const {
      supplierName,
      supplierContact,
      supplierAddress,
      purchaseDate,
      expectedDate,
      notes
    } = body

    if (supplierName) {
      await db.query(`
        UPDATE market_purchases
        SET supplier_name = $1,
            supplier_contact = $2,
            supplier_address = $3,
            purchase_date = $4,
            expected_date = $5,
            notes = $6,
            updated_at = NOW()
        WHERE id = $7
      `, [
        supplierName,
        supplierContact || null,
        supplierAddress || null,
        purchaseDate || null,
        expectedDate || null,
        notes || null,
        purchaseId
      ])
    }

    // Update lines if provided
    if (lines && Array.isArray(lines)) {
      await db.transaction(async (client) => {
        // Get current lines to revert expected quantities
        const currentLines = await client.query(`
          SELECT product_id, quantity FROM market_purchase_lines WHERE purchase_id = $1
        `, [purchaseId])

        for (const line of currentLines.rows) {
          await client.query(`
            UPDATE market_products
            SET quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1)
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }

        // Delete current lines
        await client.query(`DELETE FROM market_purchase_lines WHERE purchase_id = $1`, [purchaseId])

        // Create new lines
        let subtotal = 0
        for (const line of lines) {
          const lineTotal = line.quantity * line.unitPrice
          subtotal += lineTotal

          await client.query(`
            INSERT INTO market_purchase_lines (purchase_id, product_id, quantity, unit_price, total_price, quantity_received, created_at)
            VALUES ($1, $2, $3, $4, $5, 0, NOW())
          `, [purchaseId, line.productId, line.quantity, line.unitPrice, lineTotal])

          // Update expected quantity
          await client.query(`
            UPDATE market_products
            SET quantity_expected = COALESCE(quantity_expected, 0) + $1
            WHERE id = $2
          `, [line.quantity, line.productId])
        }

        // Update totals
        await client.query(`
          UPDATE market_purchases
          SET subtotal = $1, tax_amount = 0, total_amount = $1, updated_at = NOW()
          WHERE id = $2
        `, [subtotal, purchaseId])
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Compra actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Market Purchase API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar compra'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/purchases/[id]
 * Delete a draft purchase
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
    const purchaseId = parseInt(id)

    // Get purchase
    const purchaseResult = await db.query(`
      SELECT id, status, company_id FROM market_purchases WHERE id = $1
    `, [purchaseId])

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Compra no encontrada'
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]

    if (purchase.company_id !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 403 })
    }

    if (purchase.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden eliminar compras en borrador'
      }, { status: 400 })
    }

    await db.transaction(async (client) => {
      // Revert expected quantities
      const linesResult = await client.query(`
        SELECT product_id, quantity FROM market_purchase_lines WHERE purchase_id = $1
      `, [purchaseId])

      for (const line of linesResult.rows) {
        await client.query(`
          UPDATE market_products
          SET quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1)
          WHERE id = $2
        `, [line.quantity, line.product_id])
      }

      // Delete lines and purchase
      await client.query(`DELETE FROM market_purchase_lines WHERE purchase_id = $1`, [purchaseId])
      await client.query(`DELETE FROM market_purchases WHERE id = $1`, [purchaseId])
    })

    return NextResponse.json({
      success: true,
      message: 'Compra eliminada exitosamente'
    })

  } catch (error) {
    console.error('[Market Purchase API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar compra'
    }, { status: 500 })
  }
}
