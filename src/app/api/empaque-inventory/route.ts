import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET: Obtener inventario de empaques por almacén
 *
 * Query params:
 * - warehouseId: Filtrar por almacén específico
 * - packageSizeId: Filtrar por tamaño de empaque
 * - lowStock: true para obtener solo items con stock bajo
 * - summary: true para usar vista optimizada
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const packageSizeId = searchParams.get('packageSizeId')
    const lowStock = searchParams.get('lowStock') === 'true'
    const useSummary = searchParams.get('summary') === 'true'

    if (useSummary) {
      // Use optimized view
      const conditions: string[] = []
      const params: any[] = []

      if (warehouseId) {
        params.push(parseInt(warehouseId))
        conditions.push(`warehouse_id = $${params.length}`)
      }

      if (packageSizeId) {
        params.push(parseInt(packageSizeId))
        conditions.push(`package_size_id = $${params.length}`)
      }

      if (lowStock) {
        conditions.push(`is_low_stock = true`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const query = `
        SELECT *
        FROM v_empaque_inventory_summary
        ${whereClause}
        ORDER BY warehouse_name, package_size_name
      `

      const result = await db.query(query, params)

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    } else {
      // Use detailed query with all relationships
      const conditions: string[] = []
      const params: any[] = []

      if (warehouseId) {
        params.push(parseInt(warehouseId))
        conditions.push(`ei.warehouse_id = $${params.length}`)
      }

      if (packageSizeId) {
        params.push(parseInt(packageSizeId))
        conditions.push(`ei.package_size_id = $${params.length}`)
      }

      if (lowStock) {
        conditions.push(`ei.available_quantity <= ei.min_stock_alert`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const query = `
        SELECT
          ei.id,
          ei.warehouse_id as "warehouseId",
          w.name as "warehouseName",
          w.city as "warehouseCity",
          w.address as "warehouseAddress",
          ei.package_size_id as "packageSizeId",
          ps.name as "packageSizeName",
          ps.dimensions as "packageDimensions",
          ps.weight as "packageWeight",
          ps.description as "packageDescription",
          ei.total_quantity as "totalQuantity",
          ei.available_quantity as "availableQuantity",
          ei.assigned_delivery as "assignedDelivery",
          ei.in_use_customer as "inUseCustomer",
          ei.min_stock_alert as "minStockAlert",
          ei.max_stock_capacity as "maxStockCapacity",
          ei.reorder_point as "reorderPoint",
          ei.last_restock_date as "lastRestockDate",
          ei.last_restock_quantity as "lastRestockQuantity",
          ei.last_restock_by_user_id as "lastRestockByUserId",
          ei.last_restock_by_user_name as "lastRestockByUserName",
          ei.notes,
          ei.created_at as "createdAt",
          ei.updated_at as "updatedAt",
          (ei.available_quantity <= ei.min_stock_alert) as "isLowStock",
          (ei.available_quantity <= ei.reorder_point) as "needsReorder",
          ROUND((ei.available_quantity::NUMERIC / NULLIF(ei.total_quantity, 0) * 100), 2) as "availabilityPercentage"
        FROM empaque_inventory ei
        INNER JOIN warehouses w ON ei.warehouse_id = w.id
        INNER JOIN package_sizes ps ON ei.package_size_id = ps.id
        ${whereClause}
        ORDER BY w.name, ps.name
      `

      const result = await db.query(query, params)

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

  } catch (error) {
    console.error('Error fetching empaque inventory:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * POST: Inicializar o actualizar inventario de empaques
 *
 * Body:
 * - warehouseId: ID del almacén
 * - packageSizeId: ID del tamaño de empaque
 * - quantity: Cantidad a agregar al inventario
 * - userId: ID del usuario que realiza la operación (opcional)
 * - userName: Nombre del usuario (opcional)
 * - notes: Notas sobre el restock (opcional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.warehouseId || !body.packageSizeId || body.quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: warehouseId, packageSizeId, quantity'
      }, { status: 400 })
    }

    const quantity = parseInt(body.quantity)
    if (isNaN(quantity) || quantity < 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad debe ser un número positivo'
      }, { status: 400 })
    }

    // Check if warehouse and package_size exist
    const warehouseCheck = await db.query('SELECT id FROM warehouses WHERE id = $1', [body.warehouseId])
    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const packageSizeCheck = await db.query('SELECT id FROM package_sizes WHERE id = $1', [body.packageSizeId])
    if (packageSizeCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tamaño de empaque no encontrado'
      }, { status: 404 })
    }

    // Use the helper function from migration
    const query = `
      SELECT initialize_empaque_inventory($1, $2, $3) as inventory_id
    `

    const result = await db.query(query, [body.warehouseId, body.packageSizeId, quantity])
    const inventoryId = result.rows[0].inventory_id

    // Update restock metadata if provided
    if (body.userId || body.userName || body.notes) {
      const updateFields: string[] = []
      const updateValues: any[] = []
      let paramCount = 1

      updateFields.push(`last_restock_date = NOW()`)
      updateFields.push(`last_restock_quantity = $${paramCount++}`)
      updateValues.push(quantity)

      if (body.userId) {
        updateFields.push(`last_restock_by_user_id = $${paramCount++}`)
        updateValues.push(body.userId)
      }

      if (body.userName) {
        updateFields.push(`last_restock_by_user_name = $${paramCount++}`)
        updateValues.push(body.userName)
      }

      if (body.notes) {
        updateFields.push(`notes = $${paramCount++}`)
        updateValues.push(body.notes)
      }

      updateFields.push(`updated_at = NOW()`)
      updateValues.push(inventoryId)

      const updateQuery = `
        UPDATE empaque_inventory
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `

      await db.query(updateQuery, updateValues)
    }

    // Get updated inventory record
    const inventoryQuery = `
      SELECT
        ei.id,
        ei.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        ei.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        ei.total_quantity as "totalQuantity",
        ei.available_quantity as "availableQuantity",
        ei.assigned_delivery as "assignedDelivery",
        ei.in_use_customer as "inUseCustomer",
        ei.updated_at as "updatedAt"
      FROM empaque_inventory ei
      INNER JOIN warehouses w ON ei.warehouse_id = w.id
      INNER JOIN package_sizes ps ON ei.package_size_id = ps.id
      WHERE ei.id = $1
    `

    const inventoryResult = await db.query(inventoryQuery, [inventoryId])

    return NextResponse.json({
      success: true,
      data: inventoryResult.rows[0],
      message: `Inventario actualizado: +${quantity} unidades`
    }, { status: 201 })

  } catch (error) {
    console.error('Error initializing empaque inventory:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
