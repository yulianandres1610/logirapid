import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * Genera un prefijo único de 5 dígitos para código de barra de peso
 */
async function generateWeightBarcodePrefix(companyId: number): Promise<string> {
  try {
    // Obtener el prefijo más alto existente para esta empresa
    const result = await db.query(`
      SELECT weight_barcode_prefix
      FROM market_products
      WHERE company_id = $1
        AND weight_barcode_prefix IS NOT NULL
        AND weight_barcode_prefix ~ '^[0-9]+$'
      ORDER BY weight_barcode_prefix::INTEGER DESC
      LIMIT 1
    `, [companyId])

    let nextPrefix: number

    if (result.rows.length > 0 && result.rows[0].weight_barcode_prefix) {
      nextPrefix = parseInt(result.rows[0].weight_barcode_prefix) + 1
    } else {
      nextPrefix = 1
    }

    // Asegurar que no exceda 5 dígitos (máx 99999)
    if (nextPrefix > 99999) {
      const allPrefixes = await db.query(`
        SELECT weight_barcode_prefix::INTEGER as prefix
        FROM market_products
        WHERE company_id = $1
          AND weight_barcode_prefix IS NOT NULL
          AND weight_barcode_prefix ~ '^[0-9]+$'
        ORDER BY prefix ASC
      `, [companyId])

      const usedPrefixes = new Set(allPrefixes.rows.map(r => r.prefix))
      for (let i = 1; i <= 99999; i++) {
        if (!usedPrefixes.has(i)) {
          nextPrefix = i
          break
        }
      }
    }

    return nextPrefix.toString().padStart(5, '0')
  } catch (error) {
    console.error('[Weight Labels API] Error generating prefix:', error)
    return Date.now().toString().slice(-5)
  }
}

/**
 * Calcula el dígito verificador EAN-13
 */
function calculateEAN13CheckDigit(code12: string): string {
  if (code12.length !== 12) {
    throw new Error('El código debe tener exactamente 12 dígitos')
  }

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit.toString()
}

/**
 * Genera código EAN-13 con peso embebido
 * Formato: 20PPPPPWWWWWC (estándar GS1 para productos de peso variable)
 * - 20: Prefijo para productos de peso variable en tienda
 * - PPPPP: 5 dígitos del código de producto
 * - WWWWW: 5 dígitos del peso (ej: 01250 = 1.250 kg)
 * - C: Dígito verificador EAN-13
 * Total: 12 dígitos + 1 verificador = 13 dígitos
 */
function generateWeightBarcode(productPrefix: string, weightKg: number): string {
  // Validar y formatear prefijo de producto (5 dígitos)
  const prefix = productPrefix.padStart(5, '0').substring(0, 5)

  // Convertir peso a entero (3 decimales)
  // Ej: 1.250 kg -> 1250
  const weightInt = Math.round(weightKg * 1000)
  const weightStr = weightInt.toString().padStart(5, '0').substring(0, 5)

  // Código sin dígito verificador: 20 + PPPPP + WWWWW = 12 dígitos
  const code12 = `20${prefix}${weightStr}`

  // Calcular dígito verificador
  const checkDigit = calculateEAN13CheckDigit(code12)

  return code12 + checkDigit
}

/**
 * POST /api/market/production/weight-labels/generate
 * Genera etiqueta de peso con código de barra embebido
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value
    const userId = cookieStore.get('user-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, variantId, weightKg, copies = 1 } = body

    // Validaciones
    if (!productId) {
      return NextResponse.json({ success: false, error: 'ID de producto requerido' }, { status: 400 })
    }

    if (!weightKg || weightKg <= 0) {
      return NextResponse.json({ success: false, error: 'Peso inválido' }, { status: 400 })
    }

    if (weightKg > 99.999) {
      return NextResponse.json({
        success: false,
        error: 'El peso máximo soportado es 99.999 kg'
      }, { status: 400 })
    }

    // Obtener producto
    const productResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.selling_price as "sellingPrice",
        p.unit_of_measure as "unitOfMeasure",
        p.weight_barcode_prefix as "weightBarcodePrefix",
        p.image_url as "imageUrl",
        c.legalname as "companyName"
      FROM market_products p
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.id = $1 AND p.company_id = $2
    `, [productId, companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Si no tiene prefijo de código de barra, generarlo automáticamente
    if (!product.weightBarcodePrefix) {
      const newPrefix = await generateWeightBarcodePrefix(parseInt(companyId))

      // Actualizar el producto con el nuevo prefijo
      await db.query(`
        UPDATE market_products
        SET weight_barcode_prefix = $1, is_weight_product = true, updated_at = NOW()
        WHERE id = $2 AND company_id = $3
      `, [newPrefix, productId, companyId])

      product.weightBarcodePrefix = newPrefix
      console.log(`[Weight Labels API] Auto-generated prefix ${newPrefix} for product ${productId}`)
    }

    // Obtener tasa de cambio configurada en el sistema
    // Prioridad: 1) Tasa manual configurada, 2) ElToque/fallback
    let exchangeRate = 440 // Fallback default

    // 1. Verificar si hay tasa manual configurada para la empresa
    const manualRateResult = await db.query(
      `SELECT manual_rate FROM market_exchange_rate_config WHERE company_id = $1`,
      [companyId]
    )

    if (manualRateResult.rows[0]?.manual_rate) {
      const manualRate = parseFloat(manualRateResult.rows[0].manual_rate)
      if (manualRate > 0) {
        exchangeRate = manualRate
        console.log(`[Weight Labels API] Using manual rate: ${exchangeRate}`)
      }
    }

    // 2. Si no hay tasa manual, intentar obtener de ElToque
    if (!manualRateResult.rows[0]?.manual_rate) {
      try {
        const elToqueResponse = await fetch('http://173.249.39.167:8000/tasas', {
          method: 'GET',
          headers: { 'access_token': 'tu_clave_secreta_aqui' },
          signal: AbortSignal.timeout(5000)
        })

        if (elToqueResponse.ok) {
          const data = await elToqueResponse.json()
          if (data.monedas && Array.isArray(data.monedas)) {
            const usdRate = data.monedas.find((m: { moneda: string; precio_cup: number }) => m.moneda === 'USD')
            if (usdRate?.precio_cup) {
              exchangeRate = usdRate.precio_cup
              console.log(`[Weight Labels API] Using ElToque rate: ${exchangeRate}`)
            }
          }
        }
      } catch (error) {
        console.warn('[Weight Labels API] ElToque API error, using fallback:', error)
      }
    }

    // Calcular precios
    const pricePerKg = parseFloat(product.sellingPrice) || 0
    const priceUSD = pricePerKg * weightKg
    const priceCUP = Math.round(priceUSD * exchangeRate)

    // Generar código de barra con peso embebido
    const barcode = generateWeightBarcode(product.weightBarcodePrefix, weightKg)

    // Formatear peso para mostrar usando la unidad del producto
    const unit = product.unitOfMeasure || 'kg'
    const weightDisplay = `${weightKg.toFixed(3)} ${unit}`

    // Ensure log table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_weight_labels_log (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        weight_kg DECIMAL(10, 3) NOT NULL,
        price_cup INTEGER,
        barcode_generated VARCHAR(20),
        printed_by INTEGER,
        printed_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Registrar en el log
    await db.query(`
      INSERT INTO market_weight_labels_log
        (company_id, product_id, variant_id, weight_kg, price_cup, barcode_generated, printed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [companyId, productId, variantId || null, weightKg, priceCUP, barcode, userId || null])

    // Crear trabajo de impresión usando el schema existente de print_jobs
    const printJobResult = await db.query(`
      INSERT INTO print_jobs
        (job_number, company_id, document_type, source_type, document_data, copies, priority, status, requested_by, created_at)
      VALUES
        ($1, $2, 'weight_label', 'weight_label', $3, $4, 0, 'pending', $5, NOW())
      RETURNING id
    `, [
      `WL-${Date.now()}`,
      companyId,
      JSON.stringify({
        productName: product.name,
        productSku: product.sku,
        weight: weightDisplay,
        weightKg: weightKg,
        priceCUP: priceCUP,
        priceUSD: Math.round(priceUSD * 100) / 100,
        pricePerKg: pricePerKg,
        pricePerUnit: Math.round(pricePerKg * exchangeRate),
        unitOfMeasure: unit,
        barcode: barcode,
        barcodeType: 'ean13',
        printDate: new Date().toLocaleDateString('es-ES'),
        companyName: product.companyName,
        exchangeRate: exchangeRate
      }),
      copies,
      userId || null
    ])

    return NextResponse.json({
      success: true,
      data: {
        barcode,
        productName: product.name,
        productSku: product.sku,
        weight: weightDisplay,
        weightKg,
        pricePerKg,
        priceUSD: Math.round(priceUSD * 100) / 100,
        priceCUP,
        exchangeRate,
        printJobId: printJobResult.rows[0].id,
        copies
      }
    })

  } catch (error) {
    console.error('[Weight Labels API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar etiqueta de peso'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/production/weight-labels/generate
 * Obtiene el historial de etiquetas impresas
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const productId = searchParams.get('productId')

    let query = `
      SELECT
        l.id,
        l.weight_kg as "weightKg",
        l.price_cup as "priceCUP",
        l.barcode_generated as "barcode",
        l.printed_at as "printedAt",
        p.name as "productName",
        p.sku as "productSku",
        u.email as "printedBy"
      FROM market_weight_labels_log l
      LEFT JOIN market_products p ON p.id = l.product_id
      LEFT JOIN users u ON u.id = l.printed_by
      WHERE l.company_id = $1
    `
    const params: (string | number)[] = [companyId]

    if (productId) {
      params.push(productId)
      query += ` AND l.product_id = $${params.length}`
    }

    query += ` ORDER BY l.printed_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('[Weight Labels API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener historial'
    }, { status: 500 })
  }
}
