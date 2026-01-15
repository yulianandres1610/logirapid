import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface CreateProductRequest {
  apacargoProductId: number
  originalName: string
  originalDescription?: string
  customName: string
  customDescription?: string
  supportsAir: boolean
  supportsSea: boolean
  miCosto: number
  precioMayorista: number
  precioPublico?: number
}

export async function POST(request: NextRequest) {
  try {
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

    // Solo SUPER_ADMIN puede crear productos
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const body: CreateProductRequest = await request.json()

    // Validaciones
    if (!body.apacargoProductId) {
      return NextResponse.json(
        { success: false, error: 'El ID del producto de ApaCargo es requerido' },
        { status: 400 }
      )
    }

    if (!body.customName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    if (!body.miCosto || body.miCosto <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mi Costo debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (!body.precioMayorista || body.precioMayorista <= 0) {
      return NextResponse.json(
        { success: false, error: 'Precio Mayorista debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.precioMayorista < body.miCosto) {
      return NextResponse.json(
        { success: false, error: 'Precio Mayorista no puede ser menor a Mi Costo' },
        { status: 400 }
      )
    }

    if (!body.supportsAir && !body.supportsSea) {
      return NextResponse.json(
        { success: false, error: 'El producto debe soportar al menos un tipo de envio (Aereo o Maritimo)' },
        { status: 400 }
      )
    }

    // Generar slug
    const slug = body.customName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Insertar producto
    const result = await db.query(`
      INSERT INTO apacargo_shipping_products (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
      RETURNING *
    `, [
      body.apacargoProductId,
      body.originalName,
      body.originalDescription || null,
      body.customName.trim(),
      body.customDescription?.trim() || null,
      slug,
      body.supportsAir,
      body.supportsSea,
      body.miCosto,
      body.precioMayorista,
      body.precioPublico || null
    ])

    const newProduct = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Producto agregado correctamente',
      data: {
        id: newProduct.id,
        apacargoProductId: newProduct.apacargo_product_id,
        customName: newProduct.custom_name,
        slug: newProduct.slug,
        supportsAir: newProduct.supports_air,
        supportsSea: newProduct.supports_sea,
        miCosto: parseFloat(newProduct.mi_costo),
        precioMayorista: parseFloat(newProduct.precio_mayorista),
        precioPublico: newProduct.precio_publico ? parseFloat(newProduct.precio_publico) : null,
        profit: parseFloat(newProduct.precio_mayorista) - parseFloat(newProduct.mi_costo)
      }
    })
  } catch (error) {
    console.error('Error creando producto ApaCargo:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear producto',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
