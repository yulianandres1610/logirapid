import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Helper to get user from token
async function getUserFromToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number
      email: string
      role: string
      companyId: number
    }
  } catch {
    return null
  }
}

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto invalido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        pc.id,
        pc.code,
        pc.name,
        pc.description,
        pc.service_category,
        pc.product_type,
        pc.dimensions,
        pc.weight_capacity,
        pc.unit_type,
        pc.mi_costo,
        pc.precio_mayorista,
        pc.precio_publico,
        pc.pricing_model,
        pc.provider_company_id,
        c.legalname as provider_company_name,
        pc.is_active,
        pc.display_order,
        pc.created_at,
        pc.updated_at
      FROM product_catalog pc
      LEFT JOIN companies c ON pc.provider_company_id = c.id
      WHERE pc.id = $1
    `, [productId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('[Products API] GET [id] error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener producto'
    }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update single product (SUPER_ADMIN only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken()

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede actualizar productos'
      }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto invalido'
      }, { status: 400 })
    }

    // Check if product exists
    const existing = await db.query(
      'SELECT * FROM product_catalog WHERE id = $1',
      [productId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      service_category,
      product_type,
      dimensions,
      weight_capacity,
      unit_type,
      mi_costo,
      precio_mayorista,
      precio_publico,
      pricing_model,
      provider_company_id,
      provider_company_name,
      display_order,
      is_active
    } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`)
      values.push(code)
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }
    if (service_category !== undefined) {
      updates.push(`service_category = $${paramIndex++}`)
      values.push(service_category)
    }
    if (product_type !== undefined) {
      updates.push(`product_type = $${paramIndex++}`)
      values.push(product_type)
    }
    if (dimensions !== undefined) {
      updates.push(`dimensions = $${paramIndex++}`)
      values.push(dimensions)
    }
    if (weight_capacity !== undefined) {
      updates.push(`weight_capacity = $${paramIndex++}`)
      values.push(weight_capacity)
    }
    if (unit_type !== undefined) {
      updates.push(`unit_type = $${paramIndex++}`)
      values.push(unit_type)
    }
    if (mi_costo !== undefined) {
      updates.push(`mi_costo = $${paramIndex++}`)
      values.push(mi_costo)
    }
    if (precio_mayorista !== undefined) {
      updates.push(`precio_mayorista = $${paramIndex++}`)
      values.push(precio_mayorista)
    }
    if (precio_publico !== undefined) {
      updates.push(`precio_publico = $${paramIndex++}`)
      values.push(precio_publico)
    }
    if (pricing_model !== undefined) {
      updates.push(`pricing_model = $${paramIndex++}`)
      values.push(pricing_model)
    }
    if (provider_company_id !== undefined) {
      updates.push(`provider_company_id = $${paramIndex++}`)
      values.push(provider_company_id)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`)

    // Add product ID as last parameter
    values.push(productId)

    const updateQuery = `
      UPDATE product_catalog
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await db.query(updateQuery, values)

    // Log history
    await db.query(`
      INSERT INTO product_pricing_history (
        product_id, change_type, change_level,
        old_provider_cost, old_platform_price,
        new_provider_cost, new_platform_price,
        changed_by_user_id, changed_by_user_name, notes
      ) VALUES ($1, 'update', 'platform', $2, $3, $4, $5, $6, $7, $8)
    `, [
      productId,
      existing.rows[0].mi_costo,
      existing.rows[0].precio_mayorista,
      mi_costo ?? existing.rows[0].mi_costo,
      precio_mayorista ?? existing.rows[0].precio_mayorista,
      user.userId,
      user.email,
      `Producto actualizado: ${name || existing.rows[0].name}`
    ])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('[Products API] PUT [id] error:', error)

    if (error.code === '23505') { // Unique violation
      return NextResponse.json({
        success: false,
        error: 'Ya existe un producto con ese codigo'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Error al actualizar producto'
    }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Delete product (SUPER_ADMIN only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken()

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede eliminar productos'
      }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto invalido'
      }, { status: 400 })
    }

    // Check if product exists
    const existing = await db.query(
      'SELECT * FROM product_catalog WHERE id = $1',
      [productId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const productName = existing.rows[0].name

    // Delete related company pricing first
    await db.query(
      'DELETE FROM company_product_pricing WHERE product_id = $1',
      [productId]
    )

    // Delete related branch pricing
    await db.query(
      'DELETE FROM branch_product_pricing WHERE product_id = $1',
      [productId]
    )

    // Delete the product
    await db.query(
      'DELETE FROM product_catalog WHERE id = $1',
      [productId]
    )

    // Log history
    await db.query(`
      INSERT INTO product_pricing_history (
        product_id, change_type, change_level,
        old_provider_cost, old_platform_price,
        changed_by_user_id, changed_by_user_name, notes
      ) VALUES ($1, 'delete', 'platform', $2, $3, $4, $5, $6)
    `, [
      productId,
      existing.rows[0].mi_costo,
      existing.rows[0].precio_mayorista,
      user.userId,
      user.email,
      `Producto eliminado: ${productName}`
    ])

    return NextResponse.json({
      success: true,
      message: `Producto "${productName}" eliminado correctamente`
    })

  } catch (error: any) {
    console.error('[Products API] DELETE [id] error:', error)

    // Check for foreign key constraint
    if (error.code === '23503') {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el producto porque tiene registros relacionados'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Error al eliminar producto'
    }, { status: 500 })
  }
}
