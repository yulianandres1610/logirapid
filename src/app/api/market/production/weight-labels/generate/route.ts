import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

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
 * Formato: 2PPPPPWWWWWC
 * - 2: Prefijo para productos de peso variable
 * - PPPPP: 5 dígitos del código de producto
 * - WWWWW: 5 dígitos del peso (ej: 01250 = 1.250 kg)
 * - C: Dígito verificador
 */
function generateWeightBarcode(productPrefix: string, weightKg: number): string {
  // Validar y formatear prefijo de producto (5 dígitos)
  const prefix = productPrefix.padStart(5, '0').substring(0, 5)

  // Convertir peso a entero (3 decimales)
  // Ej: 1.250 kg -> 1250
  const weightInt = Math.round(weightKg * 1000)
  const weightStr = weightInt.toString().padStart(5, '0').substring(0, 5)

  // Código sin dígito verificador: 2 + PPPPP + WWWWW = 12 dígitos
  const code12 = `2${prefix}${weightStr}`

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
    const { productId, variantId, weightKg, copies = 1, printerName } = body

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
        c.name as "companyName"
      FROM market_products p
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.id = $1 AND p.company_id = $2
    `, [productId, companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Verificar que tenga prefijo de código de barra
    if (!product.weightBarcodePrefix) {
      return NextResponse.json({
        success: false,
        error: 'Este producto no tiene configurado un prefijo de código de barra para peso. Configure uno primero.'
      }, { status: 400 })
    }

    // Obtener tasa de cambio vigente
    const rateResult = await db.query(`
      SELECT exchange_rate
      FROM agency_rates_history
      WHERE company_id = $1
        AND is_active = true
      ORDER BY effective_date DESC, created_at DESC
      LIMIT 1
    `, [companyId])

    const exchangeRate = rateResult.rows[0]?.exchange_rate || 380

    // Calcular precios
    const pricePerKg = parseFloat(product.sellingPrice) || 0
    const priceUSD = pricePerKg * weightKg
    const priceCUP = Math.round(priceUSD * exchangeRate)

    // Generar código de barra con peso embebido
    const barcode = generateWeightBarcode(product.weightBarcodePrefix, weightKg)

    // Formatear peso para mostrar usando la unidad del producto
    const unit = product.unitOfMeasure || 'kg'
    const weightDisplay = `${weightKg.toFixed(3)} ${unit}`

    // Registrar en el log
    await db.query(`
      INSERT INTO market_weight_labels_log
        (company_id, product_id, variant_id, weight_kg, price_cup, barcode_generated, printed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [companyId, productId, variantId || null, weightKg, priceCUP, barcode, userId || null])

    // Crear trabajo de impresión
    const printJobResult = await db.query(`
      INSERT INTO print_jobs
        (company_id, job_number, document_type, document_data, status, priority, copies, printer_name, created_by)
      VALUES
        ($1, $2, 'weight_label', $3, 'pending', 'normal', $4, $5, $6)
      RETURNING id
    `, [
      companyId,
      `WL-${Date.now()}`,
      JSON.stringify({
        productName: product.name,
        productSku: product.sku,
        weight: weightDisplay,
        weightKg: weightKg,
        priceCUP: priceCUP,
        pricePerKg: pricePerKg,
        barcode: barcode,
        barcodeType: 'ean13',
        printDate: new Date().toLocaleDateString('es-ES'),
        companyName: product.companyName,
        exchangeRate: exchangeRate
      }),
      copies,
      printerName || null,
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
      error: 'Error al generar etiqueta de peso'
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
