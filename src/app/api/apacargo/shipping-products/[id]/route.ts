import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface UpdateProductRequest {
  customName?: string
  customDescription?: string
  supportsAir?: boolean
  supportsSea?: boolean
  miCosto?: number
  precioMayorista?: number
  precioPublico?: number | null
  isActive?: boolean
}

// GET - Obtener detalle del producto
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

    // Verificar autenticacion
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const userRole = cookieStore.get('user-role')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const result = await db.query(`
      SELECT
        id,
        apacargo_product_id,
        original_name,
        original_description,
        custom_name,
        custom_description,
        slug,
        supports_air,
        supports_sea,
        mi_costo,
        precio_mayorista,
        precio_publico,
        is_active,
        created_at,
        updated_at
      FROM apacargo_shipping_products
      WHERE id = $1
    `, [productId])

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
        apacargoProductId: row.apacargo_product_id,
        originalName: row.original_name,
        originalDescription: row.original_description,
        customName: row.custom_name,
        customDescription: row.custom_description,
        slug: row.slug,
        supportsAir: row.supports_air,
        supportsSea: row.supports_sea,
        miCosto: parseFloat(row.mi_costo),
        precioMayorista: parseFloat(row.precio_mayorista),
        precioPublico: row.precio_publico ? parseFloat(row.precio_publico) : null,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })
  } catch (error) {
    console.error('Error obteniendo producto ApaCargo:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener producto',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT - Actualizar producto
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

    // Verificar autenticacion
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const userRole = cookieStore.get('user-role')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Verificar que existe
    const existingResult = await db.query(`
      SELECT id FROM apacargo_shipping_products WHERE id = $1
    `, [productId])

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const body: UpdateProductRequest = await request.json()

    // Validaciones
    if (body.supportsAir === false && body.supportsSea === false) {
      return NextResponse.json(
        { success: false, error: 'El producto debe soportar al menos un tipo de envio' },
        { status: 400 }
      )
    }

    if (body.miCosto !== undefined && body.miCosto <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mi Costo debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.precioMayorista !== undefined && body.precioMayorista <= 0) {
      return NextResponse.json(
        { success: false, error: 'Precio Mayorista debe ser mayor a 0' },
        { status: 400 }
      )
    }

    // Construir query de actualizacion
    const updates: string[] = []
    const values: (string | number | boolean | null)[] = []
    let paramIndex = 1

    if (body.customName !== undefined) {
      updates.push(`custom_name = $${paramIndex}`)
      values.push(body.customName.trim())
      paramIndex++

      // Actualizar slug tambien
      const slug = body.customName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      updates.push(`slug = $${paramIndex}`)
      values.push(slug)
      paramIndex++
    }

    if (body.customDescription !== undefined) {
      updates.push(`custom_description = $${paramIndex}`)
      values.push(body.customDescription?.trim() || null)
      paramIndex++
    }

    if (body.supportsAir !== undefined) {
      updates.push(`supports_air = $${paramIndex}`)
      values.push(body.supportsAir)
      paramIndex++
    }

    if (body.supportsSea !== undefined) {
      updates.push(`supports_sea = $${paramIndex}`)
      values.push(body.supportsSea)
      paramIndex++
    }

    if (body.miCosto !== undefined) {
      updates.push(`mi_costo = $${paramIndex}`)
      values.push(body.miCosto)
      paramIndex++
    }

    if (body.precioMayorista !== undefined) {
      updates.push(`precio_mayorista = $${paramIndex}`)
      values.push(body.precioMayorista)
      paramIndex++
    }

    if (body.precioPublico !== undefined) {
      updates.push(`precio_publico = $${paramIndex}`)
      values.push(body.precioPublico)
      paramIndex++
    }

    if (body.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`)
      values.push(body.isActive)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)

    const result = await db.query(`
      UPDATE apacargo_shipping_products
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, [...values, productId])

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado correctamente',
      data: {
        id: row.id,
        apacargoProductId: row.apacargo_product_id,
        customName: row.custom_name,
        customDescription: row.custom_description,
        slug: row.slug,
        supportsAir: row.supports_air,
        supportsSea: row.supports_sea,
        miCosto: parseFloat(row.mi_costo),
        precioMayorista: parseFloat(row.precio_mayorista),
        precioPublico: row.precio_publico ? parseFloat(row.precio_publico) : null,
        isActive: row.is_active
      }
    })
  } catch (error) {
    console.error('Error actualizando producto ApaCargo:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar producto',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar producto (soft delete)
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

    // Verificar autenticacion
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const userRole = cookieStore.get('user-role')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Soft delete
    const result = await db.query(`
      UPDATE apacargo_shipping_products
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id, custom_name
    `, [productId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Producto "${result.rows[0].custom_name}" eliminado correctamente`
    })
  } catch (error) {
    console.error('Error eliminando producto ApaCargo:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al eliminar producto',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
