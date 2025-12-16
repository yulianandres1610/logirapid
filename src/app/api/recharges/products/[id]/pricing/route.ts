import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

interface PricingRequest {
  companyId?: number | null
  marginType: 'percentage' | 'fixed'
  marginValue: number
  isEnabled?: boolean
}

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
    const companyId = cookieStore.get('user-company-id')?.value

    // Get product with all pricing configurations
    const result = await db.query(
      `SELECT
        erp.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', rpp.id,
            'company_id', rpp.company_id,
            'margin_type', rpp.margin_type,
            'margin_value', rpp.margin_value,
            'selling_price', rpp.selling_price,
            'is_enabled', rpp.is_enabled
          ))
          FROM recharge_product_pricing rpp
          WHERE rpp.external_product_id = erp.id
          ), '[]'
        ) as pricing_configs
      FROM external_recharge_products erp
      WHERE erp.id = $1`,
      [productId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const product = result.rows[0]
    const pricingConfigs = typeof product.pricing_configs === 'string'
      ? JSON.parse(product.pricing_configs)
      : product.pricing_configs

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          externalId: product.external_id,
          name: product.name,
          baseCost: parseFloat(product.base_cost),
          countryCode: product.country_code,
          countryName: product.country_name,
        },
        pricingConfigs: pricingConfigs.map((p: any) => ({
          id: p.id,
          companyId: p.company_id,
          marginType: p.margin_type,
          marginValue: parseFloat(p.margin_value),
          sellingPrice: p.selling_price ? parseFloat(p.selling_price) : null,
          isEnabled: p.is_enabled,
        })),
      },
    })
  } catch (error: any) {
    console.error('[Recharge Pricing GET Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo configuracion de precio',
      },
      { status: 500 }
    )
  }
}

export async function POST(
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

    // Only SUPER_ADMIN and ADMIN can configure pricing
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para configurar precios' },
        { status: 403 }
      )
    }

    const body: PricingRequest = await request.json()
    const { companyId, marginType, marginValue, isEnabled = true } = body

    // Validate input
    if (!marginType || !['percentage', 'fixed'].includes(marginType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de margen invalido' },
        { status: 400 }
      )
    }

    if (marginValue === undefined || marginValue < 0) {
      return NextResponse.json(
        { success: false, error: 'Valor de margen invalido' },
        { status: 400 }
      )
    }

    // Get product base cost
    const productResult = await db.query(
      'SELECT base_cost FROM external_recharge_products WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const baseCost = parseFloat(productResult.rows[0].base_cost)

    // Calculate selling price
    let sellingPrice: number
    if (marginType === 'percentage') {
      sellingPrice = baseCost * (1 + marginValue / 100)
    } else {
      sellingPrice = baseCost + marginValue
    }

    // Round to 2 decimal places
    sellingPrice = Math.round(sellingPrice * 100) / 100

    // Upsert pricing configuration
    const result = await db.query(
      `INSERT INTO recharge_product_pricing
       (external_product_id, company_id, margin_type, margin_value, selling_price, is_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (external_product_id, company_id)
       DO UPDATE SET
         margin_type = $3,
         margin_value = $4,
         selling_price = $5,
         is_enabled = $6,
         updated_at = NOW()
       RETURNING *`,
      [productId, companyId || null, marginType, marginValue, sellingPrice, isEnabled]
    )

    const pricing = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: pricing.id,
        productId: pricing.external_product_id,
        companyId: pricing.company_id,
        marginType: pricing.margin_type,
        marginValue: parseFloat(pricing.margin_value),
        sellingPrice: parseFloat(pricing.selling_price),
        isEnabled: pricing.is_enabled,
        baseCost,
        profit: parseFloat(pricing.selling_price) - baseCost,
      },
      message: 'Precio configurado correctamente',
    })
  } catch (error: any) {
    console.error('[Recharge Pricing POST Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error configurando precio',
      },
      { status: 500 }
    )
  }
}

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

    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    await db.query(
      `DELETE FROM recharge_product_pricing
       WHERE external_product_id = $1
       AND (company_id = $2 OR ($2 IS NULL AND company_id IS NULL))`,
      [productId, companyId ? parseInt(companyId) : null]
    )

    return NextResponse.json({
      success: true,
      message: 'Configuracion de precio eliminada',
    })
  } catch (error: any) {
    console.error('[Recharge Pricing DELETE Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error eliminando configuracion',
      },
      { status: 500 }
    )
  }
}
