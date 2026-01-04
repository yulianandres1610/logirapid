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
}

interface NewProductVariant {
  name: string
  sku?: string | null
  barcode?: string | null
  unitCost: number
  sellingPrice?: number
  imageUrl?: string | null
  tempId: number // Para mapear con las líneas
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
  // Soporte para variantes
  hasVariants?: boolean
  variants?: NewProductVariant[]
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

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * GET /api/consignments/orders
 * Lista órdenes de consignación
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const warehouseId = searchParams.get('warehouseId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        o.*,
        s.supplier_code as supplier_code,
        s.name as supplier_name,
        w.name as warehouse_name,
        w.code as warehouse_code,
        u.firstname || ' ' || u.lastname as created_by_name,
        (SELECT COUNT(*) FROM consignment_order_lines WHERE order_id = o.id) as line_count
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (search) {
      query += ` AND (o.order_number ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (supplierId) {
      query += ` AND o.supplier_id = $${paramIndex}`
      params.push(parseInt(supplierId))
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND o.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    // Count total - build count query separately to avoid subquery issues
    let countQuery = `
      SELECT COUNT(*) as total
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.company_id = $1
    `
    const countParams: (string | number)[] = [payload.companyId]
    let countParamIndex = 2

    if (search) {
      countQuery += ` AND (o.order_number ILIKE $${countParamIndex} OR s.name ILIKE $${countParamIndex})`
      countParams.push(`%${search}%`)
      countParamIndex++
    }

    if (status) {
      countQuery += ` AND o.status = $${countParamIndex}`
      countParams.push(status)
      countParamIndex++
    }

    if (supplierId) {
      countQuery += ` AND o.supplier_id = $${countParamIndex}`
      countParams.push(parseInt(supplierId))
      countParamIndex++
    }

    if (warehouseId) {
      countQuery += ` AND o.warehouse_id = $${countParamIndex}`
      countParams.push(parseInt(warehouseId))
      countParamIndex++
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get stats by status
    const statsResult = await db.query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(total_sold), 0) as total_sold,
        COALESCE(SUM(total_paid), 0) as total_paid
      FROM consignment_orders
      WHERE company_id = $1
      GROUP BY status
    `, [payload.companyId])

    const stats = {
      pending: { count: 0, totalCost: 0 },
      received: { count: 0, totalCost: 0 },
      selling: { count: 0, totalCost: 0, totalSold: 0 },
      paid: { count: 0, totalPaid: 0 },
      returned: { count: 0 },
      liquidated: { count: 0 }
    }

    for (const row of statsResult.rows) {
      const s = row.status as keyof typeof stats
      if (stats[s]) {
        stats[s].count = parseInt(row.count)
        if ('totalCost' in stats[s]) {
          (stats[s] as { totalCost: number }).totalCost = parseFloat(row.total_cost)
        }
        if ('totalSold' in stats[s]) {
          (stats[s] as { totalSold: number }).totalSold = parseFloat(row.total_sold)
        }
        if ('totalPaid' in stats[s]) {
          (stats[s] as { totalPaid: number }).totalPaid = parseFloat(row.total_paid)
        }
      }
    }

    // Get paginated results
    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const orders = result.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      supplier: {
        id: o.supplier_id,
        code: o.supplier_code,
        name: o.supplier_name
      },
      warehouse: {
        id: o.warehouse_id,
        code: o.warehouse_code,
        name: o.warehouse_name
      },
      status: o.status,
      totalItems: parseInt(o.line_count) || 0,
      totalUnits: parseInt(o.total_units) || 0,
      totalCost: parseFloat(o.total_cost) || 0,
      totalSold: parseFloat(o.total_sold) || 0,
      totalPaid: parseFloat(o.total_paid) || 0,
      totalReturned: parseFloat(o.total_returned) || 0,
      consignmentDate: o.consignment_date,
      receivedAt: o.received_at,
      completedAt: o.completed_at,
      notes: o.notes,
      createdBy: o.created_by_name,
      createdAt: o.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Consignment Orders GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/consignments/orders
 * Crear orden de consignación
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId: rawSupplierId, supplierName, warehouseId, consignmentDate, notes, lines, newProducts } = body as {
      supplierId: number
      supplierName?: string // Name for new supplier
      warehouseId: number
      consignmentDate?: string
      notes?: string
      lines: Array<{
        productId: number
        variantId?: number | null
        quantity: number
        unitCost: number
        unitPrice?: number
        isNewProduct?: boolean
      }>
      newProducts?: NewProduct[]
    }

    // Validaciones
    if (!rawSupplierId || !warehouseId || !lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor, almacén y productos son requeridos'
      }, { status: 400 })
    }

    // Create new supplier if ID is negative
    let supplierId = rawSupplierId
    let createdSupplier: { id: number; supplierCode: string; name: string } | null = null
    if (rawSupplierId < 0 && supplierName) {
      console.log('[Consignment Orders] Creating new supplier:', supplierName)

      // Generate supplier code: 3 initials from name + year (e.g., SRL2026)
      const year = new Date().getFullYear()
      // Get first 3 letters from name (uppercase, remove special chars)
      const initials = supplierName
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X') // Pad with X if less than 3 letters

      const baseCode = initials + year

      // Check if code already exists and add number if needed
      const existingResult = await db.query(
        'SELECT supplier_code FROM market_suppliers WHERE company_id = $1 AND supplier_code LIKE $2 ORDER BY supplier_code DESC LIMIT 1',
        [payload.companyId, baseCode + '%']
      )

      let supplierCode = baseCode
      if (existingResult.rows.length > 0) {
        const lastCode = existingResult.rows[0].supplier_code
        // Extract number suffix if exists (e.g., SRL2026-2 -> 2)
        const match = lastCode.match(new RegExp('^' + baseCode + '(?:-(\\\\d+))?$'))
        if (match) {
          const nextNum = match[1] ? parseInt(match[1]) + 1 : 2
          supplierCode = baseCode + '-' + nextNum
        }
      }

      const result = await db.query(`
        INSERT INTO market_suppliers (
          company_id, supplier_code, name, is_active, rating,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, true, 3, $4, NOW(), NOW())
        RETURNING id
      `, [payload.companyId, supplierCode, supplierName, payload.userId])

      supplierId = result.rows[0].id
      createdSupplier = { id: supplierId, supplierCode, name: supplierName }
      console.log('[Consignment Orders] Created supplier:', createdSupplier)
    }

    // Crear mapa para productos nuevos (tempId -> realId)
    const productIdMap = new Map<number, number>()
    const createdProducts: Array<{ tempId: number; id: number; name: string; sku: string; barcode: string; variantId?: number }> = []
    // Mapa para variantes: tempId de variante -> { productId, variantId }
    const variantIdMap = new Map<number, { productId: number; variantId: number }>()

    // Crear productos nuevos si existen
    if (newProducts && newProducts.length > 0) {
      console.log('[Consignment Orders] Creating', newProducts.length, 'new products')

      for (const newProduct of newProducts) {
        const sku = generateSku(newProduct.name, newProduct.sku || null)
        // Add small delay to ensure unique barcodes
        await new Promise(resolve => setTimeout(resolve, 10))
        const barcode = generateBarcode(newProduct.barcode || null)
        const sellingPrice = newProduct.sellingPrice || newProduct.unitCost * 1.3 // 30% margen por defecto
        const hasVariants = newProduct.hasVariants === true && newProduct.variants && newProduct.variants.length > 0

        console.log('[Consignment Orders] Creating product:', {
          name: newProduct.name,
          sku,
          barcode,
          costPrice: newProduct.unitCost,
          sellingPrice,
          hasVariants,
          variantsCount: newProduct.variants?.length || 0
        })

        const result = await db.query(`
          INSERT INTO market_products (
            company_id, name, sku, barcode, cost_price, selling_price,
            currency, quantity_on_hand, is_active, category, has_variants, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'USD', 0, true, $7, $8, NOW())
          RETURNING id
        `, [
          payload.companyId,
          newProduct.name,
          sku,
          barcode,
          newProduct.unitCost,
          sellingPrice,
          newProduct.category || 'General',
          hasVariants
        ])

        const realId = result.rows[0].id
        productIdMap.set(newProduct.tempId, realId)

        // Si hay imagen generada con IA, subirla a storage
        let productImageUrl: string | null = null
        if (newProduct.imageBase64 && barcode) {
          try {
            console.log('[Consignment Orders] Uploading AI-generated image for product:', newProduct.name)

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

            console.log('[Consignment Orders] Image uploaded successfully:', url)
          } catch (imgError) {
            console.error('[Consignment Orders] Error uploading image:', imgError)
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

        // Crear variantes si existen
        if (hasVariants && newProduct.variants) {
          console.log('[Consignment Orders] Creating', newProduct.variants.length, 'variants for product:', newProduct.name)

          for (const variant of newProduct.variants) {
            await new Promise(resolve => setTimeout(resolve, 10))
            const variantSku = generateSku(`${newProduct.name} ${variant.name}`, variant.sku || null)
            const variantBarcode = generateBarcode(variant.barcode || null)
            const variantSellingPrice = variant.sellingPrice || variant.unitCost * 1.3

            // Insert variant with correct column names (variant_name, selling_price)
            // Use variant's own image or inherit from parent product
            const variantImageUrl = variant.imageUrl || productImageUrl || null

            const variantResult = await db.query(`
              INSERT INTO market_product_variants (
                product_id, variant_name, sku, barcode, cost_price, selling_price,
                quantity_on_hand, image_url, is_active, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, true, NOW())
              RETURNING id
            `, [
              realId,
              variant.name,
              variantSku,
              variantBarcode,
              variant.unitCost,
              variantSellingPrice,
              variantImageUrl
            ])

            const variantId = variantResult.rows[0].id

            // Mapear el tempId de la variante
            variantIdMap.set(variant.tempId, { productId: realId, variantId })
            productIdMap.set(variant.tempId, realId) // También mapear al producto

            createdProducts.push({
              tempId: variant.tempId,
              id: realId,
              name: variant.name,
              sku: variantSku,
              barcode: variantBarcode,
              variantId
            })

            console.log('[Consignment Orders] Variant created:', {
              tempId: variant.tempId,
              productId: realId,
              variantId,
              name: variant.name
            })
          }
        }

        console.log('[Consignment Orders] Product created:', { tempId: newProduct.tempId, realId, imageUrl: productImageUrl })
      }
    }

    // Verificar proveedor existe (usando tabla unificada market_suppliers)
    const supplierCheck = await db.query(
      'SELECT id, supplier_code FROM market_suppliers WHERE id = $1 AND company_id = $2',
      [supplierId, payload.companyId]
    )
    if (supplierCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Verificar almacén existe
    const warehouseCheck = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )
    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Generar número de orden
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM consignment_orders WHERE company_id = $1 AND order_number LIKE $2`,
      [payload.companyId, `CONS-${year}-%`]
    )
    const count = parseInt(countResult.rows[0].count) + 1
    const orderNumber = `CONS-${year}-${count.toString().padStart(4, '0')}`

    // Calcular totales
    let totalItems = lines.length
    let totalUnits = 0
    let totalCost = 0

    for (const line of lines) {
      // Quantity puede venir con decimales del OCR (ej: 1631.8 libras)
      // Sumamos como está para el total de unidades
      totalUnits += parseFloat(String(line.quantity)) || 0
      totalCost += (parseFloat(String(line.quantity)) || 0) * (parseFloat(String(line.unitCost)) || 0)
    }

    // Redondear totalUnits si la columna es integer
    totalUnits = Math.round(totalUnits)

    // Crear orden
    const orderResult = await db.query(`
      INSERT INTO consignment_orders (
        company_id, order_number, supplier_id, warehouse_id,
        status, total_items, total_units, total_cost,
        consignment_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      payload.companyId,
      orderNumber,
      supplierId,
      warehouseId,
      totalItems,
      totalUnits,
      totalCost,
      consignmentDate || new Date().toISOString().split('T')[0],
      notes || null,
      payload.userId
    ])

    const orderId = orderResult.rows[0].id

    // Crear líneas
    for (const line of lines) {
      // Si es un producto nuevo (ID negativo), usar el ID real creado
      let productId = line.productId
      let variantId = line.variantId || null

      if (line.isNewProduct && line.productId < 0) {
        // Primero verificar si es una variante
        const variantInfo = variantIdMap.get(line.productId)
        if (variantInfo) {
          productId = variantInfo.productId
          variantId = variantInfo.variantId
        } else {
          // Si no es variante, buscar el producto
          const realId = productIdMap.get(line.productId)
          if (!realId) {
            console.error('[Order POST] Product ID not found in map:', line.productId)
            continue
          }
          productId = realId
        }
      }

      // Debug log to verify variant_id is being saved
      console.log('[Order POST] Saving line:', {
        originalProductId: line.productId,
        mappedProductId: productId,
        variantId,
        quantity: line.quantity,
        isNewProduct: line.isNewProduct
      })

      // Parsear y redondear cantidad si la columna es integer
      const quantity = Math.round(parseFloat(String(line.quantity)) || 0)
      const unitCost = parseFloat(String(line.unitCost)) || 0
      const unitPrice = line.unitPrice ? parseFloat(String(line.unitPrice)) : null

      await db.query(`
        INSERT INTO consignment_order_lines (
          order_id, product_id, variant_id, quantity_ordered, unit_cost, unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        orderId,
        productId,
        variantId,
        quantity,
        unitCost,
        unitPrice
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de consignación creada exitosamente',
      createdProducts: createdProducts.length > 0 ? createdProducts : undefined,
      createdSupplier: createdSupplier || undefined,
      data: {
        id: orderId,
        orderNumber,
        totalItems,
        totalUnits,
        totalCost
      }
    })

  } catch (error) {
    console.error('[Consignment Orders POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden'
    }, { status: 500 })
  }
}
