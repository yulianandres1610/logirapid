import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// GET - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'ID de producto invalido' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const result = await db.query(
      `SELECT * FROM external_recharge_products WHERE id = $1`,
      [productId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        externalId: row.external_id,
        slug: row.slug,
        name: row.custom_name || row.name,
        description: row.custom_description || row.description,
        baseCost: row.base_cost ? parseFloat(row.base_cost) : null,
        costPrice: row.manual_cost_price ? parseFloat(row.manual_cost_price) : null,
        sellingPrice: row.manual_selling_price ? parseFloat(row.manual_selling_price) : null,
        providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : parseFloat(row.base_cost || '0'),
        isPromotion: row.is_promotion || false,
        promotionId: row.promotion_id,
        univcellProductId: row.univcell_product_id,
        countryCode: row.country_code,
        countryName: row.country_name,
        pattern: row.phone_pattern,
        mask: row.phone_mask,
        isActive: row.is_active,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  } catch (error: any) {
    console.error('[API] Error getting recharge product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener producto' },
      { status: 500 }
    )
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'ID de producto invalido' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Check product exists
    const existingResult = await db.query(
      'SELECT id FROM external_recharge_products WHERE id = $1',
      [productId]
    )

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    if (body.costPrice !== undefined && body.costPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio de costo debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.sellingPrice !== undefined && body.sellingPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio de venta debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.sellingPrice !== undefined && body.costPrice !== undefined && body.sellingPrice < body.costPrice) {
      return NextResponse.json(
        { success: false, error: 'El precio de venta no puede ser menor al precio de costo' },
        { status: 400 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Always update these fields
    updates.push(`custom_name = $${paramIndex}`)
    values.push(body.name.trim())
    paramIndex++

    updates.push(`name = $${paramIndex}`)
    values.push(body.name.trim())
    paramIndex++

    if (body.description !== undefined) {
      updates.push(`custom_description = $${paramIndex}`)
      values.push(body.description?.trim() || null)
      paramIndex++

      updates.push(`description = $${paramIndex}`)
      values.push(body.description?.trim() || null)
      paramIndex++
    }

    if (body.costPrice !== undefined) {
      updates.push(`manual_cost_price = $${paramIndex}`)
      values.push(body.costPrice)
      paramIndex++
    }

    if (body.sellingPrice !== undefined) {
      updates.push(`manual_selling_price = $${paramIndex}`)
      values.push(body.sellingPrice)
      paramIndex++
    }

    if (body.providerAmount !== undefined) {
      updates.push(`provider_amount = $${paramIndex}`)
      values.push(body.providerAmount)
      paramIndex++

      updates.push(`base_cost = $${paramIndex}`)
      values.push(body.providerAmount)
      paramIndex++
    }

    if (body.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`)
      values.push(body.isActive)
      paramIndex++
    }

    updates.push(`updated_at = NOW()`)

    // Add product ID as last parameter
    values.push(productId)

    const result = await db.query(
      `UPDATE external_recharge_products
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: {
        id: row.id,
        externalId: row.external_id,
        name: row.custom_name || row.name,
        description: row.custom_description || row.description,
        costPrice: row.manual_cost_price ? parseFloat(row.manual_cost_price) : null,
        sellingPrice: row.manual_selling_price ? parseFloat(row.manual_selling_price) : null,
        providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : parseFloat(row.base_cost || '0'),
        isPromotion: row.is_promotion || false,
        isActive: row.is_active,
      },
    })
  } catch (error: any) {
    console.error('[API] Error updating recharge product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar producto' },
      { status: 500 }
    )
  }
}

// DELETE - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'ID de producto invalido' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Check product exists
    const existingResult = await db.query(
      'SELECT id, custom_name, name FROM external_recharge_products WHERE id = $1',
      [productId]
    )

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const productName = existingResult.rows[0].custom_name || existingResult.rows[0].name

    // Delete associated pricing configurations first
    await db.query(
      'DELETE FROM recharge_product_pricing WHERE external_product_id = $1',
      [productId]
    )

    // Delete the product
    const result = await db.query(
      'DELETE FROM external_recharge_products WHERE id = $1',
      [productId]
    )

    console.log(`[DELETE Product] Product ${productId} (${productName}) deleted`)

    return NextResponse.json({
      success: true,
      message: `Producto "${productName}" eliminado exitosamente`,
      deleted: result.rowCount,
    })
  } catch (error: any) {
    console.error('[API] Error deleting recharge product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al eliminar producto' },
      { status: 500 }
    )
  }
}
