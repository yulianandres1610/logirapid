import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * Detecta si un código de barra tiene peso embebido (EAN-13 con prefijo 2)
 * Formato: 2PPPPPWWWWWC
 * - 2: Prefijo para productos de peso variable
 * - PPPPP: 5 dígitos del código de producto
 * - WWWWW: 5 dígitos del peso (ej: 01250 = 1.250 kg)
 * - C: Dígito verificador
 */
function parseWeightBarcode(barcode: string): { prefix: string; weight: number } | null {
  // EAN-13 con peso: 2PPPPPWWWWWC (13 dígitos)
  if (barcode.length === 13 && barcode.startsWith('2')) {
    const prefix = barcode.substring(1, 6)  // 5 dígitos de producto
    const weightStr = barcode.substring(6, 11)  // 5 dígitos de peso

    // Validar que sean números
    if (!/^\d{5}$/.test(prefix) || !/^\d{5}$/.test(weightStr)) {
      return null
    }

    const weight = parseInt(weightStr) / 1000  // Convertir a kg (3 decimales)

    // Validar que el peso sea razonable
    if (weight <= 0 || weight > 9999.999) {
      return null
    }

    return { prefix, weight }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    const companyId = cookieStore.get('user-company-id')?.value

    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Código requerido' }, { status: 400 })
    }

    const searchCode = code.trim()

    // ============================================
    // PRIMERO: Detectar si es un código de peso embebido (EAN-13 con prefijo 2)
    // ============================================
    const weightInfo = parseWeightBarcode(searchCode)

    if (weightInfo) {
      // Buscar producto por weight_barcode_prefix
      const weightProductQuery = `
        SELECT
          mp.id,
          mp.name,
          mp.sku,
          mp.barcode,
          mp.image_url as "imageUrl",
          mp.quantity_on_hand as "quantityOnHand",
          mp.cost_price as "costPrice",
          mp.selling_price as "sellingPrice",
          mp.unit_of_measure as "unitOfMeasure",
          mp.weight_barcode_prefix as "weightBarcodePrefix",
          mp.is_weight_product as "isWeightProduct",
          mc.name as "categoryName"
        FROM market_products mp
        LEFT JOIN market_categories mc ON mp.category_id = mc.id
        WHERE mp.company_id = $1
          AND mp.is_active = true
          AND mp.weight_barcode_prefix = $2
        LIMIT 1
      `

      const weightResult = await db.query(weightProductQuery, [parseInt(companyId), weightInfo.prefix])

      if (weightResult.rows.length > 0) {
        const product = weightResult.rows[0]
        const pricePerKg = parseFloat(product.sellingPrice) || 0
        const calculatedTotal = pricePerKg * weightInfo.weight

        return NextResponse.json({
          success: true,
          data: {
            ...product,
            // Campos especiales para producto de peso detectado
            isWeightProduct: true,
            detectedWeight: weightInfo.weight,
            suggestedQuantity: weightInfo.weight,
            pricePerUnit: pricePerKg,
            calculatedTotal: Math.round(calculatedTotal * 100) / 100,
            scannedBarcode: searchCode // El código original escaneado
          }
        })
      }

      // Si no encuentra producto con ese prefijo, continuar con búsqueda normal
      console.log(`[Scan] Weight barcode detected (${searchCode}) but no product found with prefix ${weightInfo.prefix}`)
    }

    // ============================================
    // SEGUNDO: Búsqueda normal por barcode, sku o id
    // ============================================

    // Search product by barcode, sku, or id
    const query = `
      SELECT
        mp.id,
        mp.name,
        mp.sku,
        mp.barcode,
        mp.image_url as "imageUrl",
        mp.quantity_on_hand as "quantityOnHand",
        mp.cost_price as "costPrice",
        mp.selling_price as "sellingPrice",
        mp.unit_of_measure as "unitOfMeasure",
        mc.name as "categoryName"
      FROM market_products mp
      LEFT JOIN market_categories mc ON mp.category_id = mc.id
      WHERE mp.company_id = $1
        AND mp.is_active = true
        AND (
          LOWER(mp.barcode) = LOWER($2)
          OR LOWER(mp.sku) = LOWER($2)
          OR mp.id::text = $2
        )
      LIMIT 1
    `

    const result = await db.query(query, [parseInt(companyId), searchCode])

    if (result.rows.length === 0) {
      // Try partial match
      const partialQuery = `
        SELECT
          mp.id,
          mp.name,
          mp.sku,
          mp.barcode,
          mp.image_url as "imageUrl",
          mp.quantity_on_hand as "quantityOnHand",
          mp.cost_price as "costPrice",
          mp.selling_price as "sellingPrice",
          mp.unit_of_measure as "unitOfMeasure",
          mc.name as "categoryName"
        FROM market_products mp
        LEFT JOIN market_categories mc ON mp.category_id = mc.id
        WHERE mp.company_id = $1
          AND mp.is_active = true
          AND (
            LOWER(mp.barcode) LIKE LOWER($2)
            OR LOWER(mp.sku) LIKE LOWER($2)
            OR LOWER(mp.name) LIKE LOWER($2)
          )
        ORDER BY
          CASE
            WHEN LOWER(mp.barcode) = LOWER($3) THEN 1
            WHEN LOWER(mp.sku) = LOWER($3) THEN 2
            ELSE 3
          END
        LIMIT 1
      `

      const partialResult = await db.query(partialQuery, [
        parseInt(companyId),
        `%${searchCode}%`,
        searchCode
      ])

      if (partialResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Producto no encontrado: ${searchCode}`
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: partialResult.rows[0]
      })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error scanning product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al buscar producto'
    }, { status: 500 })
  }
}
