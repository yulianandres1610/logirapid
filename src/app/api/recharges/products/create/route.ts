import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface CreateProductRequest {
  name: string
  description?: string
  univcellProductId: number
  isPromotion: boolean
  promotionId?: string
  providerAmount: number
  costPrice: number
  sellingPrice: number
  pattern: string
  mask: string
  countryCode?: string
  countryName?: string
  validFrom?: string
  validTo?: string
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userId = cookieStore.get('auth-token')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body: CreateProductRequest = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    if (!body.univcellProductId) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar un producto del proveedor' },
        { status: 400 }
      )
    }

    if (body.providerAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'El monto del proveedor debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.costPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio de costo debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.sellingPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio de venta debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (body.sellingPrice < body.costPrice) {
      return NextResponse.json(
        { success: false, error: 'El precio de venta no puede ser menor al precio de costo' },
        { status: 400 }
      )
    }

    // Generate a unique external_id for our custom products
    // Use negative numbers to distinguish from UnivCell product IDs
    const externalIdResult = await db.query(`
      SELECT COALESCE(MIN(external_id), 0) - 1 as next_id
      FROM external_recharge_products
      WHERE external_id < 0
    `)
    const externalId = externalIdResult.rows[0]?.next_id || -1

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Insert the product
    const result = await db.query(
      `INSERT INTO external_recharge_products (
        external_id,
        slug,
        name,
        description,
        base_cost,
        country_code,
        country_name,
        phone_pattern,
        phone_mask,
        is_active,
        custom_name,
        custom_description,
        manual_cost_price,
        manual_selling_price,
        is_promotion,
        promotion_id,
        provider_amount,
        univcell_product_id,
        valid_from,
        valid_to,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
      RETURNING *`,
      [
        externalId,
        slug,
        body.name,
        body.description || null,
        body.providerAmount, // base_cost = provider amount
        body.countryCode || 'CU',
        body.countryName || 'Cuba',
        body.pattern || '',
        body.mask || '',
        true, // is_active
        body.name, // custom_name
        body.description || null, // custom_description
        body.costPrice, // manual_cost_price
        body.sellingPrice, // manual_selling_price
        body.isPromotion || false,
        body.promotionId || null,
        body.providerAmount,
        body.univcellProductId,
        body.validFrom ? new Date(body.validFrom) : null,
        body.validTo ? new Date(body.validTo) : null,
      ]
    )

    const newProduct = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Producto creado exitosamente',
      data: {
        id: newProduct.id,
        externalId: newProduct.external_id,
        name: newProduct.name,
        description: newProduct.description,
        costPrice: parseFloat(newProduct.manual_cost_price),
        sellingPrice: parseFloat(newProduct.manual_selling_price),
        providerAmount: parseFloat(newProduct.provider_amount),
        isPromotion: newProduct.is_promotion,
        profit: parseFloat(newProduct.manual_selling_price) - parseFloat(newProduct.manual_cost_price),
      },
    })
  } catch (error: any) {
    console.error('[API] Error creating recharge product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear producto' },
      { status: 500 }
    )
  }
}

// GET - List all manually created products
export async function GET() {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Get all manually created products (external_id < 0) and active products
    const result = await db.query(`
      SELECT
        id,
        external_id,
        slug,
        name,
        description,
        base_cost,
        country_code,
        country_name,
        phone_pattern,
        phone_mask,
        is_active,
        custom_name,
        custom_description,
        manual_cost_price,
        manual_selling_price,
        is_promotion,
        promotion_id,
        provider_amount,
        univcell_product_id,
        valid_from,
        valid_to,
        created_at,
        updated_at
      FROM external_recharge_products
      WHERE manual_cost_price IS NOT NULL
      ORDER BY created_at DESC
    `)

    const products = result.rows.map((row: any) => ({
      id: row.id,
      externalId: row.external_id,
      slug: row.slug,
      name: row.custom_name || row.name,
      description: row.custom_description || row.description,
      costPrice: row.manual_cost_price ? parseFloat(row.manual_cost_price) : null,
      sellingPrice: row.manual_selling_price ? parseFloat(row.manual_selling_price) : null,
      providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : parseFloat(row.base_cost),
      isPromotion: row.is_promotion,
      promotionId: row.promotion_id,
      univcellProductId: row.univcell_product_id,
      countryCode: row.country_code,
      countryName: row.country_name,
      pattern: row.phone_pattern,
      mask: row.phone_mask,
      isActive: row.is_active,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      profit: row.manual_selling_price && row.manual_cost_price
        ? parseFloat(row.manual_selling_price) - parseFloat(row.manual_cost_price)
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        products,
        total: products.length,
      },
    })
  } catch (error: any) {
    console.error('[API] Error fetching recharge products:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener productos' },
      { status: 500 }
    )
  }
}
