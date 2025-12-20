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
 * Get purchase details with lines, including lot/expiration info
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

    // Get purchase with supplier and warehouse info
    const purchaseResult = await db.query(`
      SELECT
        mp.id,
        mp.purchase_number,
        mp.supplier_id,
        mp.supplier_name,
        mp.supplier_contact,
        mp.supplier_address,
        mp.warehouse_id,
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
        ms.name as supplier_registered_name,
        ms.supplier_code,
        ms.phone as supplier_phone,
        ms.email as supplier_email,
        mw.name as warehouse_name,
        mw.address as warehouse_address,
        COALESCE(u1.firstname || ' ' || u1.lastname, u1.email) as created_by_name,
        COALESCE(u2.firstname || ' ' || u2.lastname, u2.email) as confirmed_by_name,
        COALESCE(u3.firstname || ' ' || u3.lastname, u3.email) as received_by_name
      FROM market_purchases mp
      LEFT JOIN market_suppliers ms ON mp.supplier_id = ms.id
      LEFT JOIN market_warehouses mw ON mp.warehouse_id = mw.id
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

    // Get lines with lot info
    const linesResult = await db.query(`
      SELECT
        mpl.id,
        mpl.product_id,
        mpl.quantity,
        mpl.unit_price,
        mpl.total_price,
        mpl.quantity_received,
        mpl.lot_number,
        mpl.expiration_date,
        mpl.manufacturing_date,
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
        supplierId: purchase.supplier_id,
        supplierCode: purchase.supplier_code,
        supplierName: purchase.supplier_registered_name || purchase.supplier_name,
        supplierContact: purchase.supplier_contact,
        supplierPhone: purchase.supplier_phone,
        supplierEmail: purchase.supplier_email,
        supplierAddress: purchase.supplier_address,
        warehouseId: purchase.warehouse_id,
        warehouseName: purchase.warehouse_name,
        warehouseAddress: purchase.warehouse_address,
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
          quantityReceived: parseInt(line.quantity_received) || 0,
          lotNumber: line.lot_number,
          expirationDate: line.expiration_date,
          manufacturingDate: line.manufacturing_date
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
 * Update purchase or change status
 *
 * Status flow:
 * - draft → comprada (confirm)
 * - comprada → pendiente (partial receive) | recibido (full receive)
 * - pendiente → recibido (receive remaining)
 * - any except recibido → cancelled
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
    const { action, lines, receivedItems, warehouseId } = body

    // Get current purchase
    const purchaseResult = await db.query(`
      SELECT id, status, company_id, warehouse_id FROM market_purchases WHERE id = $1
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
        SET status = 'comprada',
            confirmed_by = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [userId, purchaseId])

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada exitosamente'
      })
    }

    // Receive items (partial or complete)
    if (action === 'receive' || action === 'receive_partial' || action === 'receive_complete') {
      // Valid statuses for receiving: 'comprada', 'pendiente', 'confirmed' (legacy)
      if (!['comprada', 'pendiente', 'confirmed'].includes(purchase.status)) {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden recibir compras en estado comprada o pendiente'
        }, { status: 400 })
      }

      // Use warehouseId from request body if provided, otherwise use the one from purchase
      const targetWarehouseId = warehouseId || purchase.warehouse_id

      // If warehouse provided, update the purchase with the warehouse_id
      if (warehouseId && !purchase.warehouse_id) {
        await db.query(`
          UPDATE market_purchases SET warehouse_id = $1 WHERE id = $2
        `, [warehouseId, purchaseId])
      }

      await db.transaction(async (client) => {
        // Get current lines
        const linesResult = await client.query(`
          SELECT id, product_id, quantity, quantity_received
          FROM market_purchase_lines
          WHERE purchase_id = $1
        `, [purchaseId])

        let allReceived = true

        // Process each line
        for (const line of linesResult.rows) {
          const lineId = line.id
          const productId = line.product_id
          const totalQuantity = parseInt(line.quantity)
          const alreadyReceived = parseInt(line.quantity_received) || 0
          const remaining = totalQuantity - alreadyReceived

          // Check if this line has items to receive
          let quantityToReceive = 0

          if (receivedItems && receivedItems[lineId] !== undefined) {
            // Specific quantity provided for this line
            quantityToReceive = Math.min(receivedItems[lineId], remaining)
          } else if (action === 'receive' || action === 'receive_complete') {
            // Receive all remaining items
            quantityToReceive = remaining
          }

          if (quantityToReceive > 0) {
            const newReceived = alreadyReceived + quantityToReceive

            // Update line quantity_received
            await client.query(`
              UPDATE market_purchase_lines
              SET quantity_received = $1
              WHERE id = $2
            `, [newReceived, lineId])

            // Update product inventory
            await client.query(`
              UPDATE market_products
              SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
                  quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1),
                  updated_at = NOW()
              WHERE id = $2
            `, [quantityToReceive, productId])

            // Get updated quantity for movement record (after the UPDATE above)
            const currentQty = await client.query(
              'SELECT quantity_on_hand FROM market_products WHERE id = $1',
              [productId]
            )
            const qtyAfter = parseInt(currentQty.rows[0]?.quantity_on_hand) || 0
            const qtyBefore = qtyAfter - quantityToReceive

            // Create inventory movement
            await client.query(`
              INSERT INTO market_inventory_movements (
                company_id, product_id, movement_type,
                quantity, quantity_before, quantity_after,
                reference_type, reference_id, notes, created_by, created_at
              ) VALUES ($1, $2, 'purchase_in', $3, $4, $5, 'purchase', $6, 'Recepción de compra', $7, NOW())
            `, [
              companyId,
              productId,
              quantityToReceive,
              qtyBefore,
              qtyAfter,
              purchaseId,
              userId
            ])

            // Update warehouse stock if warehouse is specified
            if (targetWarehouseId) {
              // Check if stock record exists
              const existingStock = await client.query(`
                SELECT id, quantity_on_hand FROM market_warehouse_stock
                WHERE warehouse_id = $1 AND product_id = $2 AND variant_id IS NULL
              `, [targetWarehouseId, productId])

              if (existingStock.rows.length > 0) {
                // Update existing stock
                await client.query(`
                  UPDATE market_warehouse_stock
                  SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
                  WHERE warehouse_id = $2 AND product_id = $3 AND variant_id IS NULL
                `, [quantityToReceive, targetWarehouseId, productId])
              } else {
                // Insert new stock record
                await client.query(`
                  INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, created_at, updated_at)
                  VALUES ($1, $2, NULL, $3, NOW(), NOW())
                `, [targetWarehouseId, productId, quantityToReceive])
              }
            }

            // Check if line is fully received
            if (newReceived < totalQuantity) {
              allReceived = false
            }
          } else if (alreadyReceived < totalQuantity) {
            allReceived = false
          }
        }

        // Determine new status
        const newStatus = allReceived ? 'recibido' : 'pendiente'

        // Update purchase status
        await client.query(`
          UPDATE market_purchases
          SET status = $1,
              received_by = $2,
              received_date = CASE WHEN $1 = 'recibido' THEN CURRENT_DATE ELSE received_date END,
              updated_at = NOW()
          WHERE id = $3
        `, [newStatus, userId, purchaseId])

        console.log('[Market Purchase] Reception:', purchaseId, 'new status:', newStatus)
      })

      return NextResponse.json({
        success: true,
        message: 'Recepción procesada exitosamente. Inventario actualizado.'
      })
    }

    if (action === 'cancel') {
      if (purchase.status === 'recibido') {
        return NextResponse.json({
          success: false,
          error: 'No se pueden cancelar compras ya recibidas completamente'
        }, { status: 400 })
      }

      await db.transaction(async (client) => {
        // Get lines and revert expected quantities (but not already received)
        const linesResult = await client.query(`
          SELECT product_id, quantity, quantity_received FROM market_purchase_lines WHERE purchase_id = $1
        `, [purchaseId])

        for (const line of linesResult.rows) {
          const remaining = parseInt(line.quantity) - (parseInt(line.quantity_received) || 0)
          if (remaining > 0) {
            await client.query(`
              UPDATE market_products
              SET quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1),
                  updated_at = NOW()
              WHERE id = $2
            `, [remaining, line.product_id])
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
            INSERT INTO market_purchase_lines (
              purchase_id, product_id, quantity, unit_price, total_price,
              quantity_received, lot_number, expiration_date, manufacturing_date, created_at
            ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, NOW())
          `, [
            purchaseId,
            line.productId,
            line.quantity,
            line.unitPrice,
            lineTotal,
            line.lotNumber || null,
            line.expirationDate || null,
            line.manufacturingDate || null
          ])

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
