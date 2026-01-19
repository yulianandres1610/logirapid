import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createClient } from '@supabase/supabase-js'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// Utility function to log product changes
async function logProductChange(
  productId: number,
  companyId: number,
  action: string,
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null,
  userId: number,
  userName: string,
  userEmail: string
) {
  try {
    // Ensure table exists with proper structure
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_product_change_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        user_id INTEGER,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        notes TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Create index if not exists
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_product_change_logs_product
      ON market_product_change_logs(product_id)
    `)

    console.log('[Product Change Log] Logging change:', {
      productId, action, fieldName, oldValue, newValue, userId, userName
    })

    const result = await db.query(`
      INSERT INTO market_product_change_logs (
        product_id, company_id, action, field_name, old_value, new_value,
        user_id, user_name, user_email, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `, [productId, companyId, action, fieldName, oldValue, newValue, userId, userName, userEmail])

    console.log('[Product Change Log] Inserted log with id:', result.rows[0]?.id)
  } catch (error) {
    console.error('[Product Change Log] Error logging product change:', error)
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        id,
        name,
        description,
        image_url as "imageUrl",
        category,
        cost_price as "costPrice",
        selling_price as "sellingPrice",
        currency,
        sku,
        barcode,
        supplier_name as "supplierName",
        supplier_contact as "supplierContact",
        supplier_reference as "supplierReference",
        quantity_on_hand as "quantityOnHand",
        quantity_expected as "quantityExpected",
        minimum_stock as "minimumStock",
        is_active as "isActive",
        unit_of_measure as "unitOfMeasure",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    // Get variants if any
    let variants: any[] = []
    try {
      const variantsResult = await db.query(`
        SELECT
          id,
          variant_name as "name",
          sku,
          barcode,
          cost_price as "costPrice",
          selling_price as "sellingPrice",
          quantity_on_hand as "quantityOnHand",
          image_url as "imageUrl",
          is_active as "isActive"
        FROM market_product_variants
        WHERE product_id = $1
        ORDER BY id
      `, [productId])
      variants = variantsResult.rows

      // Get options for each variant (color, size, etc.)
      for (const variant of variants) {
        try {
          const optionsResult = await db.query(`
            SELECT option_type as "type", option_value as "value"
            FROM market_variant_options
            WHERE variant_id = $1
          `, [variant.id])
          variant.options = optionsResult.rows
        } catch {
          variant.options = []
        }
      }
    } catch {
      // Variants table may not exist
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.rows[0],
        variants
      }
    })
  } catch (error) {
    console.error('Error getting product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener producto'
    }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value
    const authToken = cookieStore.get('auth-token')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    // Get user info from token
    let userId = 0
    let userName = 'Sistema'
    let userEmail = ''
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const payload = jwt.verify(authToken, secret) as JWTPayload
        userId = payload.userId
        userEmail = payload.email

        // Get user name from database
        const userResult = await db.query(
          'SELECT COALESCE(firstname || \' \' || lastname, email) as fullname FROM users WHERE id = $1',
          [userId]
        )
        userName = userResult.rows[0]?.fullname || payload.email
      } catch {
        // Token invalid, continue with default values
      }
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get current product state for change logging
    const currentResult = await db.query(`
      SELECT
        name, description, category, unit_of_measure,
        image_url, cost_price, selling_price, currency,
        sku, barcode, supplier_name, supplier_contact,
        supplier_reference, minimum_stock, is_active
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const current = currentResult.rows[0]

    const body = await request.json()
    const {
      name,
      description,
      category,
      unitOfMeasure,
      imageUrl,
      costPrice,
      sellingPrice,
      currency,
      sku,
      barcode,
      supplierName,
      supplierContact,
      supplierReference,
      minimumStock,
      isActive,
      hasVariants = false,
      variants = []
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es requerido' }, { status: 400 })
    }

    // Check for duplicate SKU (excluding current product)
    if (sku) {
      const skuCheck = await db.query(
        'SELECT id FROM market_products WHERE company_id = $1 AND sku = $2 AND id != $3',
        [parseInt(companyId), sku, productId]
      )
      if (skuCheck.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'El SKU ya existe' }, { status: 400 })
      }
    }

    // Check for duplicate barcode (excluding current product)
    if (barcode) {
      const barcodeCheck = await db.query(
        'SELECT id FROM market_products WHERE company_id = $1 AND barcode = $2 AND id != $3',
        [parseInt(companyId), barcode, productId]
      )
      if (barcodeCheck.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'El código de barras ya existe' }, { status: 400 })
      }
    }

    await db.query(`
      UPDATE market_products SET
        name = $1,
        description = $2,
        category = $3,
        unit_of_measure = $4,
        image_url = $5,
        cost_price = $6,
        selling_price = $7,
        currency = $8,
        sku = $9,
        barcode = $10,
        supplier_name = $11,
        supplier_contact = $12,
        supplier_reference = $13,
        minimum_stock = $14,
        is_active = $15,
        updated_at = NOW()
      WHERE id = $16 AND company_id = $17
    `, [
      name,
      description || null,
      category || null,
      unitOfMeasure || 'unidad',
      imageUrl || null,
      costPrice || 0,
      sellingPrice || 0,
      currency || 'USD',
      sku || null,
      barcode || null,
      supplierName || null,
      supplierContact || null,
      supplierReference || null,
      minimumStock || 5,
      isActive !== false,
      productId,
      parseInt(companyId)
    ])

    // Log changes for each modified field
    const fieldMappings: Record<string, { dbField: string, newValue: any }> = {
      name: { dbField: 'name', newValue: name },
      description: { dbField: 'description', newValue: description },
      category: { dbField: 'category', newValue: category },
      unit_of_measure: { dbField: 'unit_of_measure', newValue: unitOfMeasure },
      cost_price: { dbField: 'cost_price', newValue: costPrice },
      selling_price: { dbField: 'selling_price', newValue: sellingPrice },
      currency: { dbField: 'currency', newValue: currency },
      sku: { dbField: 'sku', newValue: sku },
      barcode: { dbField: 'barcode', newValue: barcode },
      supplier_name: { dbField: 'supplier_name', newValue: supplierName },
      minimum_stock: { dbField: 'minimum_stock', newValue: minimumStock },
      is_active: { dbField: 'is_active', newValue: isActive }
    }

    console.log('[Product Update] Current values from DB:', current)
    console.log('[Product Update] New values from request:', {
      name, description, category, unitOfMeasure, costPrice, sellingPrice,
      currency, sku, barcode, supplierName, minimumStock, isActive
    })

    const changedFields: string[] = []
    for (const [field, mapping] of Object.entries(fieldMappings)) {
      const oldVal = current[field]
      const newVal = mapping.newValue
      // Compare values (handle nulls and type differences)
      const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal)
      const newStr = newVal === null || newVal === undefined ? '' : String(newVal)

      console.log(`[Product Update] Comparing field "${field}": old="${oldStr}" vs new="${newStr}" -> changed: ${oldStr !== newStr}`)

      if (oldStr !== newStr) {
        changedFields.push(field)
        await logProductChange(
          productId,
          parseInt(companyId),
          'updated',
          field,
          oldStr || null,
          newStr || null,
          userId,
          userName,
          userEmail
        )
      }
    }

    console.log('[Product Update] Changed fields:', changedFields)

    // Check if image changed
    if ((current.image_url || '') !== (imageUrl || '')) {
      await logProductChange(
        productId,
        parseInt(companyId),
        'image_updated',
        'image_url',
        current.image_url ? 'Imagen anterior' : null,
        imageUrl ? 'Nueva imagen' : null,
        userId,
        userName,
        userEmail
      )
    }

    // Handle variants
    const savedVariants: { id: number; name: string; barcode: string; sku: string }[] = []

    if (hasVariants && variants.length > 0) {
      console.log('[Product Update] Processing', variants.length, 'variants')

      // Get existing variant IDs for this product
      const existingVariantsResult = await db.query(
        'SELECT id FROM market_product_variants WHERE product_id = $1',
        [productId]
      )
      const existingVariantIds = new Set<number>(existingVariantsResult.rows.map(r => r.id))
      const processedVariantIds = new Set<number>()

      for (const v of variants) {
        try {
          // Generate barcode if empty
          const variantBarcode = v.barcode || `${barcode || sku || productId}-V${Date.now()}`
          // Generate SKU if empty
          const variantSku = v.sku || `${sku || `PRD${productId}`}-${v.name?.replace(/\s+/g, '-').substring(0, 10) || 'VAR'}`
          const variantImageUrl = v.imageUrl || imageUrl || null

          // Check if this variant has a valid existing ID (not a temp ID like 'var-xxx')
          const isExistingVariant = v.id && typeof v.id === 'number' && existingVariantIds.has(v.id)

          if (isExistingVariant) {
            // Update existing variant
            await db.query(`
              UPDATE market_product_variants SET
                variant_name = $1,
                sku = $2,
                barcode = $3,
                cost_price = $4,
                selling_price = $5,
                image_url = $6,
                updated_at = NOW()
              WHERE id = $7 AND product_id = $8
            `, [
              v.name,
              variantSku,
              variantBarcode,
              v.costPrice || costPrice || 0,
              v.sellingPrice || sellingPrice || 0,
              variantImageUrl,
              v.id,
              productId
            ])

            // Update variant options - delete old and insert new
            if (v.options && Array.isArray(v.options)) {
              await db.query('DELETE FROM market_variant_options WHERE variant_id = $1', [v.id])
              for (const opt of v.options) {
                if (opt.type && opt.value) {
                  await db.query(`
                    INSERT INTO market_variant_options (variant_id, option_type, option_value)
                    VALUES ($1, $2, $3)
                  `, [v.id, opt.type, opt.value])
                }
              }
            }

            processedVariantIds.add(v.id)
            savedVariants.push({
              id: v.id,
              name: v.name,
              barcode: variantBarcode,
              sku: variantSku
            })
            console.log('[Product Update] Updated variant:', v.id, v.name)
          } else {
            // Insert new variant
            const insertResult = await db.query(`
              INSERT INTO market_product_variants (
                product_id, variant_name, sku, barcode, cost_price, selling_price,
                quantity_on_hand, image_url, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, true, NOW(), NOW())
              RETURNING id
            `, [
              productId,
              v.name,
              variantSku,
              variantBarcode,
              v.costPrice || costPrice || 0,
              v.sellingPrice || sellingPrice || 0,
              variantImageUrl
            ])

            const newVariantId = insertResult.rows[0].id
            savedVariants.push({
              id: newVariantId,
              name: v.name,
              barcode: variantBarcode,
              sku: variantSku
            })
            console.log('[Product Update] Inserted new variant:', newVariantId, v.name)

            // Save variant options if provided
            if (v.options && Array.isArray(v.options) && v.options.length > 0) {
              for (const opt of v.options) {
                if (opt.type && opt.value) {
                  await db.query(`
                    INSERT INTO market_variant_options (variant_id, option_type, option_value)
                    VALUES ($1, $2, $3)
                  `, [newVariantId, opt.type, opt.value])
                }
              }
            }
          }
        } catch (variantError) {
          console.error('[Product Update] Error processing variant:', v.name, variantError)
        }
      }

      // Delete variants that are no longer in the list
      const variantsToDelete = [...existingVariantIds].filter(id => !processedVariantIds.has(id))
      if (variantsToDelete.length > 0) {
        console.log('[Product Update] Deleting removed variants:', variantsToDelete)
        try {
          // First delete variant options
          const optionsDeleteResult = await db.query(
            'DELETE FROM market_variant_options WHERE variant_id = ANY($1)',
            [variantsToDelete]
          )
          console.log('[Product Update] Deleted', optionsDeleteResult.rowCount, 'variant options')

          // Then delete variants
          const variantsDeleteResult = await db.query(
            'DELETE FROM market_product_variants WHERE id = ANY($1)',
            [variantsToDelete]
          )
          console.log('[Product Update] Deleted', variantsDeleteResult.rowCount, 'variants')
        } catch (deleteError) {
          console.error('[Product Update] Error deleting old variants:', deleteError)
        }
      } else {
        console.log('[Product Update] No variants to delete. Existing:', existingVariantIds.size, 'Processed:', processedVariantIds.size)
      }

      // Log variant changes
      await logProductChange(
        productId,
        parseInt(companyId),
        'variants_updated',
        'variants',
        `${existingVariantIds.size} variantes`,
        `${savedVariants.length} variantes`,
        userId,
        userName,
        userEmail
      )
    } else if (!hasVariants) {
      // If product no longer has variants, delete all existing variants
      const existingVariantsResult = await db.query(
        'SELECT id FROM market_product_variants WHERE product_id = $1',
        [productId]
      )

      if (existingVariantsResult.rows.length > 0) {
        const variantIds = existingVariantsResult.rows.map(r => r.id)
        console.log('[Product Update] Removing all variants:', variantIds)

        // Delete variant options first
        await db.query(
          'DELETE FROM market_variant_options WHERE variant_id = ANY($1)',
          [variantIds]
        )
        // Then delete variants
        await db.query(
          'DELETE FROM market_product_variants WHERE product_id = $1',
          [productId]
        )

        await logProductChange(
          productId,
          parseInt(companyId),
          'variants_removed',
          'variants',
          `${variantIds.length} variantes`,
          null,
          userId,
          userName,
          userEmail
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: hasVariants
        ? `Producto actualizado con ${savedVariants.length} variantes`
        : 'Producto actualizado correctamente',
      changedFields,
      variants: savedVariants
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar producto'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value
    const authToken = cookieStore.get('auth-token')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Get user info from token and verify admin role
    let userId = 0
    let userName = 'Sistema'
    let userEmail = ''
    let userRole = ''

    try {
      // Use the same fallback as login route for consistency
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      const payload = jwt.verify(authToken, secret) as JWTPayload
      userId = payload.userId
      userEmail = payload.email
      userRole = payload.role

      const userResult = await db.query(
        'SELECT COALESCE(firstname || \' \' || lastname, email) as fullname FROM users WHERE id = $1',
        [userId]
      )
      userName = userResult.rows[0]?.fullname || payload.email
    } catch (err) {
      console.error('[Product Delete] JWT verification error:', err)
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can delete products
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo los administradores pueden eliminar productos'
      }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get product info before deleting (including image_url)
    const checkResult = await db.query(
      'SELECT id, name, image_url FROM market_products WHERE id = $1 AND company_id = $2',
      [productId, parseInt(companyId)]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const productName = checkResult.rows[0].name
    const imageUrl = checkResult.rows[0].image_url

    // Delete image from Supabase Storage if exists
    if (imageUrl && imageUrl.includes('supabase')) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          })

          // Extract the path from the URL
          // URL format: https://xxx.supabase.co/storage/v1/object/public/company-documents/images/img-xxx.jpg
          const urlParts = imageUrl.split('/storage/v1/object/public/')
          if (urlParts.length === 2) {
            const fullPath = urlParts[1] // e.g., "company-documents/images/img-xxx.jpg"
            const pathParts = fullPath.split('/')
            const bucket = pathParts[0] // "company-documents"
            const filePath = pathParts.slice(1).join('/') // "images/img-xxx.jpg"

            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([filePath])

            if (deleteError) {
              console.warn(`[Product Delete] Could not delete image from Supabase:`, deleteError.message)
            } else {
              console.log(`[Product Delete] Successfully deleted image from Supabase: ${filePath}`)
            }
          }
        }
      } catch (imageError) {
        console.warn('[Product Delete] Error deleting image from storage:', imageError)
        // Continue with product deletion even if image deletion fails
      }
    }

    // Log deletion before actually deleting
    await logProductChange(
      productId,
      parseInt(companyId),
      'deleted',
      null,
      productName,
      null,
      userId,
      userName,
      userEmail
    )

    // Delete related records first (handle foreign key constraints)
    // Order matters: delete from dependent tables first
    const relatedTables = [
      // Warehouse-related tables first
      { table: 'market_stock_movements', column: 'product_id' },
      { table: 'market_warehouse_operation_lines', column: 'product_id' },
      { table: 'market_warehouse_stock', column: 'product_id' },
      // Order and purchase lines
      { table: 'market_order_lines', column: 'product_id' },
      { table: 'market_purchase_lines', column: 'product_id' },
      // Inventory movements
      { table: 'market_inventory_movements', column: 'product_id' },
      // Product-specific tables
      { table: 'market_product_variants', column: 'product_id' },
      { table: 'market_product_suppliers', column: 'product_id' },
      { table: 'market_product_lots', column: 'product_id' },
      // Odoo mapping
      { table: 'odoo_product_mapping', column: 'local_product_id' },
      // Change logs (don't delete, but set product_id to NULL or skip)
      { table: 'market_product_change_logs', column: 'product_id', skipOnError: true }
    ]

    for (const { table, column, skipOnError } of relatedTables) {
      try {
        const result = await db.query(`DELETE FROM ${table} WHERE ${column} = $1`, [productId])
        if (result.rowCount && result.rowCount > 0) {
          console.log(`[Product Delete] Deleted ${result.rowCount} rows from ${table}`)
        }
      } catch (e: any) {
        // Table may not exist or other error
        if (!skipOnError) {
          console.warn(`[Product Delete] Could not delete from ${table}:`, e.message)
        }
      }
    }

    // Delete product
    await db.query(
      'DELETE FROM market_products WHERE id = $1 AND company_id = $2',
      [productId, parseInt(companyId)]
    )

    return NextResponse.json({
      success: true,
      message: 'Producto eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar producto'
    }, { status: 500 })
  }
}
