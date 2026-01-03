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

interface InputItem {
  id: string
  name: string
  quantity: number
  unitCost: number
  totalCost: number
  sku: string | null
  barcode: string | null
  description: string | null
  isVariantOf: string | null
}

interface MatchedProduct {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  costPrice: number
  sellingPrice: number
  hasVariants: boolean
  imageUrl: string | null
  categoryId: number | null
  categoryName: string | null
}

interface MatchResult {
  inputItem: InputItem
  matchType: 'barcode' | 'sku' | 'exact_name' | 'fuzzy_name' | 'variant' | 'none'
  matchedProduct: MatchedProduct | null
  matchedVariant: {
    id: number
    name: string
    sku: string
    barcode: string | null
    costPrice: number
    price: number
  } | null
  suggestedMatches: Array<{
    id: number
    name: string
    sku: string | null
    similarity: number
  }>
  confidence: number
}

/**
 * Calcula la similitud entre dos strings usando distancia de Levenshtein
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  if (longer.length === 0) return 1.0

  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }

  return (longer.length - costs[s2.length]) / longer.length
}

/**
 * Normaliza un string para comparación
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '') // Solo alfanuméricos y espacios
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim()
}

/**
 * POST /api/market/products/match
 * Match invoice items against existing products in the database
 */
export async function POST(request: NextRequest) {
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { companyId } = payload
    const body = await request.json()
    const { items } = body as { items: InputItem[] }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un array de items'
      }, { status: 400 })
    }

    console.log('[Product Match] Matching', items.length, 'items for company', companyId)

    // Obtener todos los productos de la empresa con sus variantes
    const productsResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        p.image_url as "imageUrl",
        p.category_id as "categoryId",
        c.name as "categoryName",
        CASE WHEN COUNT(v.id) > 0 THEN true ELSE false END as "hasVariants"
      FROM market_products p
      LEFT JOIN market_product_categories c ON p.category_id = c.id
      LEFT JOIN market_product_variants v ON p.id = v.product_id
      WHERE p.company_id = $1 AND p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.barcode, p.cost_price, p.selling_price,
               p.image_url, p.category_id, c.name
    `, [companyId])

    // Obtener todas las variantes
    const variantsResult = await db.query(`
      SELECT
        v.id,
        v.product_id as "productId",
        v.name,
        v.sku,
        v.barcode,
        v.cost_price as "costPrice",
        v.price
      FROM market_product_variants v
      JOIN market_products p ON v.product_id = p.id
      WHERE p.company_id = $1 AND p.is_active = true
    `, [companyId])

    const products: MatchedProduct[] = productsResult.rows
    const variants = variantsResult.rows

    // Crear índices para búsqueda rápida
    const barcodeIndex = new Map<string, { type: 'product' | 'variant', data: unknown }>()
    const skuIndex = new Map<string, { type: 'product' | 'variant', data: unknown }>()

    products.forEach(p => {
      if (p.barcode) barcodeIndex.set(p.barcode.toLowerCase(), { type: 'product', data: p })
      if (p.sku) skuIndex.set(p.sku.toLowerCase(), { type: 'product', data: p })
    })

    variants.forEach(v => {
      if (v.barcode) barcodeIndex.set(v.barcode.toLowerCase(), { type: 'variant', data: v })
      if (v.sku) skuIndex.set(v.sku.toLowerCase(), { type: 'variant', data: v })
    })

    // Procesar cada item
    const matchResults: MatchResult[] = []

    for (const item of items) {
      let matchResult: MatchResult = {
        inputItem: item,
        matchType: 'none',
        matchedProduct: null,
        matchedVariant: null,
        suggestedMatches: [],
        confidence: 0
      }

      // 1. Buscar por código de barras (prioridad máxima)
      if (item.barcode) {
        const barcodeMatch = barcodeIndex.get(item.barcode.toLowerCase())
        if (barcodeMatch) {
          if (barcodeMatch.type === 'product') {
            matchResult.matchType = 'barcode'
            matchResult.matchedProduct = barcodeMatch.data as MatchedProduct
            matchResult.confidence = 1.0
          } else {
            const variant = barcodeMatch.data as typeof variants[0]
            const parentProduct = products.find(p => p.id === variant.productId)
            matchResult.matchType = 'variant'
            matchResult.matchedProduct = parentProduct || null
            matchResult.matchedVariant = {
              id: variant.id,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode,
              costPrice: variant.costPrice,
              price: variant.price
            }
            matchResult.confidence = 1.0
          }
        }
      }

      // 2. Buscar por SKU si no hay match por barcode
      if (matchResult.matchType === 'none' && item.sku) {
        const skuMatch = skuIndex.get(item.sku.toLowerCase())
        if (skuMatch) {
          if (skuMatch.type === 'product') {
            matchResult.matchType = 'sku'
            matchResult.matchedProduct = skuMatch.data as MatchedProduct
            matchResult.confidence = 1.0
          } else {
            const variant = skuMatch.data as typeof variants[0]
            const parentProduct = products.find(p => p.id === variant.productId)
            matchResult.matchType = 'variant'
            matchResult.matchedProduct = parentProduct || null
            matchResult.matchedVariant = {
              id: variant.id,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode,
              costPrice: variant.costPrice,
              price: variant.price
            }
            matchResult.confidence = 1.0
          }
        }
      }

      // 3. Buscar por nombre si no hay match por barcode/sku
      if (matchResult.matchType === 'none' && item.name) {
        const normalizedItemName = normalizeString(item.name)

        // Buscar match exacto primero
        const exactMatch = products.find(p =>
          normalizeString(p.name) === normalizedItemName
        )

        if (exactMatch) {
          matchResult.matchType = 'exact_name'
          matchResult.matchedProduct = exactMatch
          matchResult.confidence = 0.95
        } else {
          // Buscar matches similares
          const similarities: Array<{ product: MatchedProduct, similarity: number }> = []

          for (const product of products) {
            const similarity = levenshteinSimilarity(
              normalizedItemName,
              normalizeString(product.name)
            )
            if (similarity >= 0.6) {
              similarities.push({ product, similarity })
            }
          }

          // Ordenar por similitud descendente
          similarities.sort((a, b) => b.similarity - a.similarity)

          // Si hay un match muy bueno (>80%), usarlo
          if (similarities.length > 0 && similarities[0].similarity >= 0.8) {
            matchResult.matchType = 'fuzzy_name'
            matchResult.matchedProduct = similarities[0].product
            matchResult.confidence = similarities[0].similarity
          }

          // Guardar sugerencias (top 3)
          matchResult.suggestedMatches = similarities.slice(0, 3).map(s => ({
            id: s.product.id,
            name: s.product.name,
            sku: s.product.sku,
            similarity: Math.round(s.similarity * 100) / 100
          }))
        }
      }

      matchResults.push(matchResult)
    }

    // Estadísticas
    const stats = {
      total: matchResults.length,
      matched: matchResults.filter(r => r.matchType !== 'none').length,
      byBarcode: matchResults.filter(r => r.matchType === 'barcode').length,
      bySku: matchResults.filter(r => r.matchType === 'sku').length,
      byExactName: matchResults.filter(r => r.matchType === 'exact_name').length,
      byFuzzyName: matchResults.filter(r => r.matchType === 'fuzzy_name').length,
      byVariant: matchResults.filter(r => r.matchType === 'variant').length,
      notFound: matchResults.filter(r => r.matchType === 'none').length
    }

    console.log('[Product Match] Results:', stats)

    return NextResponse.json({
      success: true,
      data: {
        matchedItems: matchResults,
        stats
      }
    })

  } catch (error) {
    console.error('[Product Match] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar productos'
    }, { status: 500 })
  }
}
