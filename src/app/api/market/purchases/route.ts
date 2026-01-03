import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { uploadProductImageByBarcode } from '@/lib/product-images'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// Migration flag
let migrationRun = false

/**
 * Ensure quantity columns support decimals
 */
async function ensureDecimalQuantities() {
  if (migrationRun) return
  migrationRun = true

  try {
    // Change quantity columns to DECIMAL to support fractional quantities
    await db.query(`
      ALTER TABLE market_purchase_lines
      ALTER COLUMN quantity TYPE DECIMAL(12,3) USING quantity::DECIMAL(12,3)
    `)
    console.log('[Migration] Changed market_purchase_lines.quantity to DECIMAL')
  } catch (error) {
    // Column might already be DECIMAL or error is expected
    const msg = error instanceof Error ? error.message : ''
    if (!msg.includes('already exists') && !msg.includes('does not exist')) {
      console.log('[Migration] quantity column migration:', msg)
    }
  }

  try {
    await db.query(`
      ALTER TABLE market_purchase_lines
      ALTER COLUMN quantity_received TYPE DECIMAL(12,3) USING quantity_received::DECIMAL(12,3)
    `)
    console.log('[Migration] Changed market_purchase_lines.quantity_received to DECIMAL')
  } catch (error) {
    // Ignore errors
  }

  try {
    await db.query(`
      ALTER TABLE market_products
      ALTER COLUMN quantity_expected TYPE DECIMAL(12,3) USING quantity_expected::DECIMAL(12,3)
    `)
    console.log('[Migration] Changed market_products.quantity_expected to DECIMAL')
  } catch (error) {
    // Ignore errors
  }
}

interface NewProduct {
  tempId: number // ID temporal negativo para mapear con las líneas
  name: string
  sku?: string | null
  barcode?: string | null
  unitCost: number
  sellingPrice?: number
  unitOfMeasure?: string
  category?: string
  imageBase64?: string | null // Imagen generada/limpiada con IA en base64
}

/**
 * Genera un SKU único basado en el nombre del producto
 */
function generateSku(name: string, existingSku: string | null): string {
  if (existingSku) return existingSku

  const prefix = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map(w => w.substring(0, 3).toUpperCase())
    .join('-')

  const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
  return `${prefix}-${timestamp}`
}

/**
 * Genera un código de barras EAN-13 válido
 */
function generateBarcode(existingBarcode: string | null): string {
  if (existingBarcode) return existingBarcode

  // Prefijo para productos internos: 200-299 (uso interno según GS1)
  const prefix = '200'
  const timestamp = Date.now().toString().slice(-9)
  const baseCode = prefix + timestamp

  // Calcular dígito de verificación EAN-13
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(baseCode[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10

  return baseCode + checkDigit
}

/**
 * GET /api/market/purchases
 * List all purchases for a market company
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
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        mp.id,
        mp.purchase_number,
        mp.supplier_id,
        mp.supplier_name,
        mp.supplier_contact,
        mp.supplier_address,
        mp.warehouse_id,
        mp.subtotal,
        mp.tax_amount,
        mp.total_amount,
        mp.currency,
        mp.status,
        mp.purchase_date,
        mp.expected_date,
        mp.received_date,
        mp.notes,
        mp.created_at,
        mp.updated_at,
        ms.name as supplier_registered_name,
        ms.supplier_code,
        mw.name as warehouse_name,
        COALESCE(u1.firstname || ' ' || u1.lastname, u1.email) as created_by_name,
        COALESCE(u2.firstname || ' ' || u2.lastname, u2.email) as confirmed_by_name,
        COALESCE(u3.firstname || ' ' || u3.lastname, u3.email) as received_by_name,
        (SELECT COUNT(*) FROM market_purchase_lines WHERE purchase_id = mp.id) as line_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM market_purchase_lines WHERE purchase_id = mp.id) as total_items,
        (SELECT COALESCE(SUM(quantity_received), 0) FROM market_purchase_lines WHERE purchase_id = mp.id) as total_received
      FROM market_purchases mp
      LEFT JOIN market_suppliers ms ON mp.supplier_id = ms.id
      LEFT JOIN market_warehouses mw ON mp.warehouse_id = mw.id
      LEFT JOIN users u1 ON mp.created_by = u1.id
      LEFT JOIN users u2 ON mp.confirmed_by = u2.id
      LEFT JOIN users u3 ON mp.received_by = u3.id
      WHERE mp.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND mp.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM market_purchases/, 'SELECT COUNT(*) as total FROM market_purchases')
    const countResult = await db.query(countQuery.replace(/LEFT JOIN[\s\S]+WHERE/, 'WHERE'), [companyId])
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY mp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'comprada') as comprada_count,
        COUNT(*) FILTER (WHERE status = 'pendiente') as pendiente_count,
        COUNT(*) FILTER (WHERE status = 'recibido') as recibido_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'recibido'), 0) as total_received_amount
      FROM market_purchases
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        purchases: result.rows.map(row => ({
          id: row.id,
          purchaseNumber: row.purchase_number,
          supplierId: row.supplier_id,
          supplierName: row.supplier_registered_name || row.supplier_name,
          supplierCode: row.supplier_code,
          supplierContact: row.supplier_contact,
          supplierAddress: row.supplier_address,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          subtotal: parseFloat(row.subtotal) || 0,
          taxAmount: parseFloat(row.tax_amount) || 0,
          totalAmount: parseFloat(row.total_amount) || 0,
          currency: row.currency || 'USD',
          status: row.status,
          purchaseDate: row.purchase_date,
          expectedDate: row.expected_date,
          receivedDate: row.received_date,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdByName: row.created_by_name,
          confirmedByName: row.confirmed_by_name,
          receivedByName: row.received_by_name,
          lineCount: parseInt(row.line_count) || 0,
          totalItems: parseInt(row.total_items) || 0,
          totalReceived: parseInt(row.total_received) || 0
        })),
        stats: {
          draft: parseInt(stats.draft_count) || 0,
          comprada: parseInt(stats.comprada_count) || 0,
          pendiente: parseInt(stats.pendiente_count) || 0,
          recibido: parseInt(stats.recibido_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          totalReceivedAmount: parseFloat(stats.total_received_amount) || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Market Purchases API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener compras'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/purchases
 * Create a new purchase order
 * Supports both legacy format (supplierName) and new wizard format (supplierId)
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure decimal quantities are supported
    await ensureDecimalQuantities()

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
    const userId = payload.userId

    const body = await request.json()
    const {
      // New wizard format
      supplierId,
      warehouseId,
      // Legacy format (still supported)
      supplierName,
      supplierContact,
      supplierAddress,
      // Common fields
      purchaseDate,
      expectedDate,
      notes,
      currency = 'USD',
      lines = [],
      saveAsDraft = false,
      newProducts = [] as NewProduct[]
    } = body

    // Crear mapa para productos nuevos (tempId -> realId)
    const productIdMap = new Map<number, number>()
    const createdProducts: Array<{ tempId: number; id: number; name: string; sku: string; barcode: string }> = []

    // Crear productos nuevos si existen
    if (newProducts && newProducts.length > 0) {
      console.log('[Market Purchases] Creating', newProducts.length, 'new products')

      for (const newProduct of newProducts) {
        const sku = generateSku(newProduct.name, newProduct.sku || null)
        // Add small delay to ensure unique barcodes
        await new Promise(resolve => setTimeout(resolve, 10))
        const barcode = generateBarcode(newProduct.barcode || null)
        const sellingPrice = newProduct.sellingPrice || newProduct.unitCost * 1.3 // 30% margen por defecto

        console.log('[Market Purchases] Creating product:', {
          name: newProduct.name,
          sku,
          barcode,
          costPrice: newProduct.unitCost,
          sellingPrice
        })

        const result = await db.query(`
          INSERT INTO market_products (
            company_id, name, sku, barcode, cost_price, selling_price,
            currency, quantity_on_hand, is_active, category, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'USD', 0, true, $7, NOW())
          RETURNING id
        `, [
          companyId,
          newProduct.name,
          sku,
          barcode,
          newProduct.unitCost,
          sellingPrice,
          newProduct.category || 'General'
        ])

        const realId = result.rows[0].id
        productIdMap.set(newProduct.tempId, realId)

        // Si hay imagen generada con IA, subirla a storage
        let productImageUrl: string | null = null
        if (newProduct.imageBase64 && barcode) {
          try {
            console.log('[Market Purchases] Uploading AI-generated image for product:', newProduct.name)

            // Limpiar el base64 si tiene prefijo data:image
            let cleanBase64 = newProduct.imageBase64
            if (cleanBase64.startsWith('data:')) {
              cleanBase64 = cleanBase64.replace(/^data:image\/\w+;base64,/, '')
            }

            const imageBuffer = Buffer.from(cleanBase64, 'base64')

            // Detectar tipo de imagen
            let contentType = 'image/png'
            if (cleanBase64.startsWith('/9j/')) {
              contentType = 'image/jpeg'
            } else if (cleanBase64.startsWith('UklGR')) {
              contentType = 'image/webp'
            }

            const { url } = await uploadProductImageByBarcode(barcode, imageBuffer, contentType)
            productImageUrl = url

            // Actualizar el producto con la URL de la imagen
            await db.query(`
              UPDATE market_products SET image_url = $1 WHERE id = $2
            `, [url, realId])

            console.log('[Market Purchases] Image uploaded successfully:', url)
          } catch (imgError) {
            console.error('[Market Purchases] Error uploading image:', imgError)
            // No fallar la creación del producto si falla la imagen
          }
        }

        createdProducts.push({
          tempId: newProduct.tempId,
          id: realId,
          name: newProduct.name,
          sku,
          barcode
        })

        console.log('[Market Purchases] Product created:', { tempId: newProduct.tempId, realId, imageUrl: productImageUrl })
      }
    }

    // Determine supplier info
    let finalSupplierName = supplierName
    let finalSupplierContact = supplierContact
    let finalSupplierAddress = supplierAddress
    let finalSupplierId = supplierId || null
    let createdSupplier: { id: number; supplierCode: string; name: string } | null = null

    // Create new supplier if ID is negative (auto-create from AI scan)
    if (supplierId && supplierId < 0 && supplierName) {
      console.log('[Market Purchases] Creating new supplier:', supplierName)

      // Generate supplier code
      const year = new Date().getFullYear()
      const countResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_suppliers
        WHERE company_id = $1 AND supplier_code LIKE $2
      `, [companyId, `SUP-${year}-%`])

      const count = parseInt(countResult.rows[0]?.count) || 0
      const supplierCode = `SUP-${year}-${(count + 1).toString().padStart(4, '0')}`

      const result = await db.query(`
        INSERT INTO market_suppliers (
          company_id, supplier_code, name, is_active, rating,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, true, 3, $4, NOW(), NOW())
        RETURNING id
      `, [companyId, supplierCode, supplierName, userId])

      finalSupplierId = result.rows[0].id
      createdSupplier = { id: finalSupplierId, supplierCode, name: supplierName }
      finalSupplierName = supplierName
      console.log('[Market Purchases] Created supplier:', createdSupplier)
    }
    // If supplierId is provided and positive, fetch supplier details
    else if (supplierId && supplierId > 0) {
      const supplierResult = await db.query(`
        SELECT name, phone, address, city, state
        FROM market_suppliers
        WHERE id = $1 AND company_id = $2
      `, [supplierId, companyId])

      if (supplierResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Proveedor no encontrado'
        }, { status: 404 })
      }

      const supplier = supplierResult.rows[0]
      finalSupplierName = supplier.name
      finalSupplierContact = supplier.phone
      finalSupplierAddress = [supplier.address, supplier.city, supplier.state].filter(Boolean).join(', ')
    }

    if (!finalSupplierName) {
      return NextResponse.json({
        success: false,
        error: 'El proveedor es requerido'
      }, { status: 400 })
    }

    // Validate warehouse if provided
    if (warehouseId) {
      const warehouseResult = await db.query(`
        SELECT id FROM market_warehouses
        WHERE id = $1 AND company_id = $2
      `, [warehouseId, companyId])

      if (warehouseResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Almacén no encontrado'
        }, { status: 404 })
      }
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos un producto'
      }, { status: 400 })
    }

    // Validate lines (allow negative productIds for new products that will be created)
    for (const line of lines) {
      // For new products, productId can be negative
      if (line.productId === undefined || line.productId === null || !line.quantity || !line.unitPrice) {
        return NextResponse.json({
          success: false,
          error: 'Cada línea debe tener producto, cantidad y precio unitario'
        }, { status: 400 })
      }
    }

    // Generate purchase number
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM market_purchases
      WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
    `, [companyId, year])
    const count = parseInt(countResult.rows[0]?.count || '0') + 1
    const purchaseNumber = `PUR-${year}-${count.toString().padStart(4, '0')}`

    // Calculate totals
    let subtotal = 0
    for (const line of lines) {
      const lineTotal = line.quantity * line.unitPrice
      subtotal += lineTotal
    }
    const taxAmount = 0 // No tax for now
    const totalAmount = subtotal + taxAmount

    // Determine initial status: 'draft' if saving as draft, 'comprada' otherwise
    const initialStatus = saveAsDraft ? 'draft' : 'comprada'

    // Create purchase and lines in transaction
    const result = await db.transaction(async (client) => {
      // Create purchase with new fields (supplier_id, warehouse_id)
      const purchaseResult = await client.query(`
        INSERT INTO market_purchases (
          company_id,
          purchase_number,
          supplier_id,
          supplier_name,
          supplier_contact,
          supplier_address,
          warehouse_id,
          subtotal,
          tax_amount,
          total_amount,
          currency,
          status,
          purchase_date,
          expected_date,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING id
      `, [
        companyId,
        purchaseNumber,
        finalSupplierId,
        finalSupplierName,
        finalSupplierContact || null,
        finalSupplierAddress || null,
        warehouseId || null,
        subtotal,
        taxAmount,
        totalAmount,
        currency,
        initialStatus,
        purchaseDate || new Date().toISOString().split('T')[0],
        expectedDate || null,
        notes || null,
        userId
      ])

      const purchaseId = purchaseResult.rows[0].id

      // Create lines with lot info
      for (const line of lines) {
        // Si es un producto nuevo (ID negativo), usar el ID real creado
        let productId = line.productId
        if (line.isNewProduct && line.productId < 0) {
          const realId = productIdMap.get(line.productId)
          if (!realId) {
            console.error('[Market Purchases] Product ID not found in map:', line.productId)
            continue
          }
          productId = realId
        }

        console.log('[Market Purchases] Saving line:', {
          originalProductId: line.productId,
          mappedProductId: productId,
          isNewProduct: line.isNewProduct
        })

        const lineTotal = line.quantity * line.unitPrice
        await client.query(`
          INSERT INTO market_purchase_lines (
            purchase_id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            quantity_received,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
        `, [
          purchaseId,
          productId,
          line.variantId || null,
          line.quantity,
          line.unitPrice,
          lineTotal
        ])

        // Update product expected quantity (use mapped productId)
        await client.query(`
          UPDATE market_products
          SET quantity_expected = COALESCE(quantity_expected, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [line.quantity, productId])
      }

      return { purchaseId, purchaseNumber, createdProducts }
    })

    console.log('[Market Purchases] Created purchase:', result.purchaseNumber, 'status:', initialStatus)

    return NextResponse.json({
      success: true,
      data: {
        id: result.purchaseId,
        purchaseNumber: result.purchaseNumber,
        status: initialStatus,
        totalAmount,
        currency
      },
      createdProducts: result.createdProducts && result.createdProducts.length > 0 ? result.createdProducts : undefined,
      createdSupplier: createdSupplier || undefined,
      message: saveAsDraft ? 'Borrador guardado exitosamente' : 'Orden de compra creada exitosamente'
    })

  } catch (error) {
    console.error('[Market Purchases API] Error creating purchase:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden de compra'
    }, { status: 500 })
  }
}
