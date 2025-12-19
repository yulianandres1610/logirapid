import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// Ensure the product_change_logs table exists
async function ensureTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_product_change_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Change details
        action VARCHAR(50) NOT NULL,  -- 'created', 'updated', 'deleted', 'price_changed', 'stock_adjusted'
        field_name VARCHAR(100),      -- Field that changed (null for create/delete)
        old_value TEXT,
        new_value TEXT,

        -- User who made the change
        user_id INTEGER REFERENCES users(id),
        user_name VARCHAR(255),
        user_email VARCHAR(255),

        -- Additional context
        notes TEXT,
        ip_address VARCHAR(50),

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_change_logs_product ON market_product_change_logs(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_change_logs_company ON market_product_change_logs(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_change_logs_date ON market_product_change_logs(created_at DESC)
    `)
  } catch (error) {
    console.error('Error creating change logs table:', error)
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Ensure table exists
    await ensureTable()

    // Get URL params for pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Get change logs
    const logsResult = await db.query(`
      SELECT
        id,
        action,
        field_name,
        old_value,
        new_value,
        user_id,
        user_name,
        user_email,
        notes,
        created_at
      FROM market_product_change_logs
      WHERE product_id = $1 AND company_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `, [productId, parseInt(companyId), limit, offset])

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_product_change_logs
      WHERE product_id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    const total = parseInt(countResult.rows[0]?.total) || 0

    // Format action labels
    const actionLabels: Record<string, string> = {
      'created': 'Producto creado',
      'updated': 'Producto actualizado',
      'deleted': 'Producto eliminado',
      'price_changed': 'Precio modificado',
      'stock_adjusted': 'Stock ajustado',
      'image_updated': 'Imagen actualizada',
      'category_changed': 'Categoría cambiada',
      'status_changed': 'Estado cambiado'
    }

    // Format field labels
    const fieldLabels: Record<string, string> = {
      'name': 'Nombre',
      'description': 'Descripción',
      'cost_price': 'Precio de costo',
      'selling_price': 'Precio de venta',
      'sku': 'SKU',
      'barcode': 'Código de barras',
      'category': 'Categoría',
      'quantity_on_hand': 'Cantidad disponible',
      'minimum_stock': 'Stock mínimo',
      'supplier_name': 'Proveedor',
      'image_url': 'Imagen',
      'is_active': 'Estado activo',
      'unit_of_measure': 'Unidad de medida',
      'currency': 'Moneda'
    }

    const logs = logsResult.rows.map(row => {
      let newValueDisplay = row.new_value
      let productDetails = null

      // For 'created' action, parse the JSON details if available
      if (row.action === 'created' && row.new_value) {
        try {
          productDetails = JSON.parse(row.new_value)
          newValueDisplay = `${productDetails.name} - ${productDetails.sku}`
        } catch {
          // Not JSON, use as is
        }
      }

      return {
        id: row.id,
        action: row.action,
        actionLabel: actionLabels[row.action] || row.action,
        fieldName: row.field_name,
        fieldLabel: row.field_name ? (fieldLabels[row.field_name] || row.field_name) : null,
        oldValue: row.old_value,
        newValue: newValueDisplay,
        productDetails, // Include parsed details for creation events
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        notes: row.notes,
        createdAt: row.created_at
      }
    })

    // Also get inventory movements for this product
    const movementsResult = await db.query(`
      SELECT
        mim.id,
        mim.movement_type,
        mim.quantity,
        mim.quantity_before,
        mim.quantity_after,
        mim.reference_type,
        mim.reference_id,
        mim.notes,
        mim.created_at,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        u.email as user_email
      FROM market_inventory_movements mim
      LEFT JOIN users u ON mim.created_by = u.id
      WHERE mim.product_id = $1 AND mim.company_id = $2
      ORDER BY mim.created_at DESC
      LIMIT 50
    `, [productId, parseInt(companyId)])

    const movementLabels: Record<string, string> = {
      'purchase_in': 'Entrada por compra',
      'sale_out': 'Salida por venta',
      'adjustment': 'Ajuste de inventario',
      'return': 'Devolución',
      'transfer_in': 'Entrada por transferencia',
      'transfer_out': 'Salida por transferencia',
      'scrap': 'Merma/Descarte'
    }

    const movements = movementsResult.rows.map(row => ({
      id: row.id,
      type: row.movement_type,
      typeLabel: movementLabels[row.movement_type] || row.movement_type,
      quantity: row.quantity,
      quantityBefore: row.quantity_before,
      quantityAfter: row.quantity_after,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      userName: row.user_name,
      userEmail: row.user_email,
      createdAt: row.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        logs,
        movements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error getting product logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener historial del producto'
    }, { status: 500 })
  }
}

