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

    // Calculate margins
    const proposedMargin = costPrice > 0 ? ((proposedPriceNum - costPrice) / costPrice) * 100 : 0
    const baseMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0

    // Calculate alerts
    let alertType: 'none' | 'below_cost' | 'no_margin' | 'low_margin' | 'high_difference' | 'above_market' = 'none'
    let alertMessage: string | null = null
    let alertSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    let pricePosition: 'low' | 'average' | 'high' = 'average'
    let priceDifferencePercent = 0

    // Check vs cost price - CRITICAL: Below cost
    if (proposedPriceNum < costPrice) {
      alertType = 'below_cost'
      const loss = costPrice - proposedPriceNum
      alertMessage = `PERDIDA: Precio ($${proposedPriceNum.toFixed(2)}) menor al costo ($${costPrice.toFixed(2)}). Perderas $${loss.toFixed(2)} por unidad.`
      alertSeverity = 'critical'
      priceDifferencePercent = ((proposedPriceNum - costPrice) / costPrice) * 100
    }
    // Check if price equals cost (no margin)
    else if (Math.abs(proposedPriceNum - costPrice) < 0.01) {
      alertType = 'no_margin'
      alertMessage = `SIN MARGEN: El precio es igual al costo ($${costPrice.toFixed(2)}). No obtendras ganancia.`
      alertSeverity = 'high'
      priceDifferencePercent = 0
    }
    // Check if margin is too low (less than 5%)
    else if (proposedMargin > 0 && proposedMargin < 5) {
      alertType = 'low_margin'
      alertMessage = `MARGEN BAJO: Solo ${proposedMargin.toFixed(1)}% de margen. Considera aumentar el precio.`
      alertSeverity = 'medium'
      priceDifferencePercent = proposedMargin
    }
    // Check vs selling price
    else if (sellingPrice > 0) {
      priceDifferencePercent = ((proposedPriceNum - sellingPrice) / sellingPrice) * 100

      if (priceDifferencePercent > 50) {
        alertType = 'high_difference'
        alertMessage = `PRECIO ALTO: ${priceDifferencePercent.toFixed(1)}% mayor al precio base ($${sellingPrice.toFixed(2)}). Puede afectar ventas.`
        alertSeverity = 'high'
      } else if (priceDifferencePercent > 30) {
        alertType = 'high_difference'
        alertMessage = `Precio ${priceDifferencePercent.toFixed(1)}% mayor al precio base ($${sellingPrice.toFixed(2)}).`
        alertSeverity = 'medium'
      } else if (priceDifferencePercent < -20 && proposedMargin < 15) {
        alertType = 'low_margin'
        alertMessage = `MARGEN REDUCIDO: ${Math.abs(priceDifferencePercent).toFixed(1)}% menor al precio base. Margen: ${proposedMargin.toFixed(1)}%`
        alertSeverity = 'medium'
      }
    }

    // Determine price position vs market
    if (competitorCount > 0) {
      const marketDiff = ((proposedPriceNum - averagePrice) / averagePrice) * 100

      if (proposedPriceNum < averagePrice * 0.85) {
        pricePosition = 'low'
      } else if (proposedPriceNum > averagePrice * 1.15) {
        pricePosition = 'high'
      } else {
        pricePosition = 'average'
      }

      // Additional alert if price is significantly above market average (and no other alert)
      if (alertType === 'none' && proposedPriceNum > averagePrice * 1.25) {
        alertType = 'above_market'
        alertMessage = `SOBRE EL MERCADO: Tu precio es ${marketDiff.toFixed(1)}% mayor al promedio ($${averagePrice.toFixed(2)}). Competidores venden mas barato.`
        alertSeverity = 'medium'
      }
      // Alert if below minimum market price
      else if (alertType === 'none' && proposedPriceNum < minPrice && minPrice > 0) {
        alertMessage = `PRECIO COMPETITIVO: Eres el mas barato del mercado. El siguiente precio mas bajo es $${minPrice.toFixed(2)}.`
        alertSeverity = 'low'
      }
    }

    // Determine recommendation
    let recommendation: 'ok' | 'warning' | 'requires_justification' = 'ok'
    if (alertSeverity === 'critical') {
      recommendation = 'requires_justification'
    } else if (alertSeverity === 'high') {
      recommendation = 'warning'
    } else if (alertType !== 'none' && alertSeverity === 'medium') {
      recommendation = 'warning'
    }

    // Calculate suggested price range
    const minSuggestedPrice = costPrice * 1.15 // At least 15% margin
    const maxSuggestedPrice = competitorCount > 0
      ? Math.min(averagePrice * 1.1, maxPrice || averagePrice * 1.2)
      : sellingPrice * 1.3

    // Calculate optimal suggested price
    let suggestedOptimalPrice = sellingPrice
    if (competitorCount > 0) {
      // Optimal: slightly below average but above minimum margin
      suggestedOptimalPrice = Math.max(
        minSuggestedPrice,
        Math.min(averagePrice * 0.95, maxSuggestedPrice)
      )
    } else {
      // No competitors: use base selling price with good margin
      suggestedOptimalPrice = Math.max(minSuggestedPrice, sellingPrice)
    }

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
        // Simplified fields for the wizard
        alertType,
        alertMessage,
        percentDifference: priceDifferencePercent,
        pricePosition,
        averagePrice: averagePrice || 0,
        minPrice: minPrice || 0,
        maxPrice: maxPrice || 0,
        competitorCount,
        // Detailed analysis
        priceAnalysis: {
          priceDifferencePercent,
          pricePosition,
          alertType,
          alertMessage,
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
          max: maxSuggestedPrice,
          optimal: suggestedOptimalPrice
        },
        margins: {
          proposedMargin,
          baseMargin,
          minRecommendedMargin: 15
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
