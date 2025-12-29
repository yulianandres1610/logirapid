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
 * GET /api/market/marketplace/price-check
 * Check price alerts and get price comparison for a product
 */
export async function GET(request: NextRequest) {
  try {
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
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const proposedPrice = searchParams.get('proposedPrice')

    if (!productId || !proposedPrice) {
      return NextResponse.json({
        success: false,
        error: 'productId y proposedPrice son requeridos'
      }, { status: 400 })
    }

    const productIdNum = parseInt(productId)
    const proposedPriceNum = parseFloat(proposedPrice)

    // Get product info
    const productResult = await db.query(`
      SELECT id, name, sku, cost_price, selling_price, category
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productIdNum, companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]
    const costPrice = parseFloat(product.cost_price)
    const sellingPrice = parseFloat(product.selling_price)

    // Get similar products in marketplace (same category, approved, from other companies)
    const similarResult = await db.query(`
      SELECT
        ml.price_marketplace,
        c.legalname as market_name,
        c.market_province as province
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.status = 'approved'
        AND ml.company_id != $1
        AND (
          mp.category = $2
          OR mp.name ILIKE $3
          OR mp.sku = $4
        )
      ORDER BY ml.price_marketplace ASC
      LIMIT 20
    `, [companyId, product.category, `%${product.name.split(' ')[0]}%`, product.sku])

    const similarProducts = similarResult.rows

    // Calculate statistics
    let averagePrice = 0
    let minPrice = 0
    let maxPrice = 0
    let competitorCount = similarProducts.length

    if (competitorCount > 0) {
      const prices = similarProducts.map(p => parseFloat(p.price_marketplace))
      averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length
      minPrice = Math.min(...prices)
      maxPrice = Math.max(...prices)
    }

    // Calculate alerts
    let alertTriggered = false
    let alertReason = null
    let alertSeverity = 'low'
    let pricePosition: 'below' | 'average' | 'above' = 'average'
    let priceDifferencePercent = 0

    // Check vs cost price
    if (proposedPriceNum < costPrice) {
      alertTriggered = true
      alertReason = `El precio propuesto ($${proposedPriceNum.toFixed(2)}) es menor al costo ($${costPrice.toFixed(2)})`
      alertSeverity = 'critical'
      priceDifferencePercent = ((proposedPriceNum - costPrice) / costPrice) * 100
    }
    // Check vs selling price
    else if (sellingPrice > 0) {
      priceDifferencePercent = ((proposedPriceNum - sellingPrice) / sellingPrice) * 100

      if (priceDifferencePercent > 50) {
        alertTriggered = true
        alertReason = `Precio ${priceDifferencePercent.toFixed(1)}% mayor al precio base. Puede afectar competitividad.`
        alertSeverity = 'high'
      } else if (priceDifferencePercent > 30) {
        alertTriggered = true
        alertReason = `Precio ${priceDifferencePercent.toFixed(1)}% mayor al precio base.`
        alertSeverity = 'medium'
      } else if (priceDifferencePercent < -20) {
        alertTriggered = true
        alertReason = `Precio ${Math.abs(priceDifferencePercent).toFixed(1)}% menor al precio base. Margen reducido.`
        alertSeverity = 'medium'
      }
    }

    // Determine price position vs market
    if (competitorCount > 0) {
      if (proposedPriceNum < averagePrice * 0.9) {
        pricePosition = 'below'
      } else if (proposedPriceNum > averagePrice * 1.1) {
        pricePosition = 'above'
      } else {
        pricePosition = 'average'
      }

      // Additional alert if price is significantly above market average
      if (!alertTriggered && proposedPriceNum > averagePrice * 1.3) {
        alertTriggered = true
        const diff = ((proposedPriceNum - averagePrice) / averagePrice) * 100
        alertReason = `Precio ${diff.toFixed(1)}% mayor al promedio del marketplace ($${averagePrice.toFixed(2)})`
        alertSeverity = 'medium'
      }
    }

    // Determine recommendation
    let recommendation: 'ok' | 'warning' | 'requires_justification' = 'ok'
    if (alertSeverity === 'critical') {
      recommendation = 'requires_justification'
    } else if (alertSeverity === 'high' || (alertTriggered && alertSeverity === 'medium')) {
      recommendation = 'warning'
    }

    // Calculate suggested price range
    const minSuggestedPrice = costPrice * 1.1 // At least 10% margin
    const maxSuggestedPrice = competitorCount > 0 ? averagePrice * 1.2 : sellingPrice * 1.5

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          costPrice,
          sellingPrice
        },
        proposedPrice: proposedPriceNum,
        priceAnalysis: {
          priceDifferencePercent,
          pricePosition,
          alertTriggered,
          alertReason,
          alertSeverity,
          recommendation
        },
        marketComparison: {
          averagePrice: averagePrice || null,
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
          competitorCount,
          similarProducts: similarProducts.map(p => ({
            marketName: p.market_name,
            price: parseFloat(p.price_marketplace),
            province: p.province
          }))
        },
        suggestedRange: {
          min: minSuggestedPrice,
          max: maxSuggestedPrice
        },
        margins: {
          proposedMargin: costPrice > 0 ? ((proposedPriceNum - costPrice) / costPrice) * 100 : 0,
          baseMargin: costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0
        }
      }
    })

  } catch (error) {
    console.error('[Price Check API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar precio'
    }, { status: 500 })
  }
}
