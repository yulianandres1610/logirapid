import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUnivCellClient, UnivCellProduct, UnivCellPromotion } from '@/lib/univcell-client'

export interface UnivCellProductOption {
  id: string
  univcellProductId: number
  name: string
  description: string | null
  type: 'product' | 'promotion'
  providerAmount: number
  pattern: string
  mask: string
  countryCode: string
  countryName: string
  validFrom?: string
  validTo?: string
  promotionSummary?: string
}

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

    const client = getUnivCellClient()

    if (!client.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'UnivCell no está configurado' },
        { status: 500 }
      )
    }

    // Fetch products and promotions in parallel
    const [productsData, promotionsData] = await Promise.all([
      client.getProducts().catch((err) => {
        console.error('[UnivCell] Error fetching products:', err)
        return [] as UnivCellProduct[]
      }),
      client.getPromotions().catch((err) => {
        console.error('[UnivCell] Error fetching promotions:', err)
        return [] as UnivCellPromotion[]
      }),
    ])

    const options: UnivCellProductOption[] = []

    // Add regular products
    for (const product of productsData) {
      options.push({
        id: `product-${product.id}`,
        univcellProductId: product.id,
        name: product.name,
        description: product.description,
        type: 'product',
        providerAmount: product.price,
        pattern: product.pattern,
        mask: product.mask || '',
        countryCode: product.country?.sortname || '',
        countryName: product.country?.name || '',
      })
    }

    // Add promotions as separate product options
    for (const promo of promotionsData) {
      // Find the base product for this promotion
      const baseProduct = productsData.find(p => p.id === promo.product_id)

      options.push({
        id: `promo-${promo.id}`,
        univcellProductId: promo.product_id, // Same product_id as base product
        name: `${promo.product?.name || baseProduct?.name || 'Producto'} - ${promo.summary.split(':')[1]?.trim() || 'Promoción'}`,
        description: promo.description,
        type: 'promotion',
        providerAmount: promo.min_amount, // Use min_amount for promotions
        pattern: promo.product?.pattern || baseProduct?.pattern || '',
        mask: promo.product?.mask || baseProduct?.mask || '',
        countryCode: promo.product?.country?.sortname || baseProduct?.country?.sortname || '',
        countryName: promo.product?.country?.name || baseProduct?.country?.name || '',
        validFrom: promo.from,
        validTo: promo.to,
        promotionSummary: promo.summary,
      })
    }

    // Sort: products first, then promotions
    options.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name)
      }
      return a.type === 'product' ? -1 : 1
    })

    return NextResponse.json({
      success: true,
      data: {
        products: options,
        totalProducts: productsData.length,
        totalPromotions: promotionsData.length,
      },
    })
  } catch (error: any) {
    console.error('[API] Error fetching univcell products:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener productos' },
      { status: 500 }
    )
  }
}
