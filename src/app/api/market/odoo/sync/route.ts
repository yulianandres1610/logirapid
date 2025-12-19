import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// Direct Odoo API calls without the client to have more control
async function odooRpc(url: string, db: string, uid: number, apiKey: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [db, uid, apiKey, model, method, args, kwargs]
      },
      id: Date.now()
    }),
    signal: AbortSignal.timeout(120000) // 2 minute timeout for large queries
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Odoo error')
  }
  return data.result
}

async function odooAuthenticate(url: string, database: string, username: string, apiKey: string): Promise<number> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [database, username, apiKey, {}]
      },
      id: Date.now()
    }),
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json()
  if (data.error || !data.result || data.result <= 0) {
    throw new Error('Authentication failed')
  }
  return data.result
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    const companyId = cookieStore.get('user-company-id')?.value

    if (!token || !companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { direction } = body

    // Get company's Odoo config
    const configResult = await db.query(`
      SELECT
        odoo_url as "odooUrl",
        odoo_database as "odooDatabase",
        odoo_username as "odooUsername",
        odoo_api_key as "odooApiKey",
        odoo_enabled as "odooEnabled"
      FROM companies
      WHERE id = $1
    `, [parseInt(companyId)])

    if (configResult.rows.length === 0 || !configResult.rows[0].odooEnabled) {
      return NextResponse.json({ success: false, error: 'Odoo no está configurado o habilitado' }, { status: 400 })
    }

    const config = configResult.rows[0]
    const odooUrl = config.odooUrl.replace(/\/$/, '')

    // Authenticate with Odoo
    console.log('[Odoo Sync] Authenticating...')
    const uid = await odooAuthenticate(odooUrl, config.odooDatabase, config.odooUsername || 'admin', config.odooApiKey)
    console.log('[Odoo Sync] Authenticated, UID:', uid)

    // Ensure tables have all necessary columns
    await ensureTablesExist(parseInt(companyId))

    // Create log entry
    const logResult = await db.query(`
      INSERT INTO odoo_sync_logs (company_id, sync_type, direction, started_at, status)
      VALUES ($1, 'manual', $2, NOW(), 'in_progress')
      RETURNING id
    `, [parseInt(companyId), direction])
    const logId = logResult.rows[0].id

    let imported = 0
    let updated = 0
    const errors: { id: number; error: string }[] = []

    if (direction === 'import') {
      // Count total products
      const totalCount = await odooRpc(odooUrl, config.odooDatabase, uid, config.odooApiKey,
        'product.product', 'search_count', [[['active', '=', true]]])
      console.log('[Odoo Sync] Total products to import:', totalCount)

      // Import in batches of 100
      const batchSize = 100
      for (let offset = 0; offset < totalCount; offset += batchSize) {
        console.log(`[Odoo Sync] Importing batch ${offset}-${offset + batchSize}...`)

        try {
          // Get products with ALL fields
          const products = await odooRpc(odooUrl, config.odooDatabase, uid, config.odooApiKey,
            'product.product', 'search_read',
            [[['active', '=', true]]],
            {
              fields: [
                'id', 'name', 'default_code', 'barcode', 'type', 'active',
                'list_price', 'standard_price',
                'categ_id', 'uom_id',
                'description', 'description_sale', 'description_purchase',
                'image_1920',
                'qty_available', 'free_qty', 'incoming_qty', 'outgoing_qty',
                'weight', 'volume',
                'seller_ids',
                'create_date', 'write_date'
              ],
              limit: batchSize,
              offset: offset,
              order: 'id asc'
            }
          )

          for (const product of products) {
            try {
              const result = await importProduct(parseInt(companyId), product)
              if (result === 'imported') imported++
              else if (result === 'updated') updated++
            } catch (err) {
              errors.push({ id: product.id, error: err instanceof Error ? err.message : 'Unknown error' })
            }
          }

          // Get supplier info for products that have sellers
          const productsWithSellers = products.filter((p: any) => p.seller_ids && p.seller_ids.length > 0)
          if (productsWithSellers.length > 0) {
            const allSellerIds = productsWithSellers.flatMap((p: any) => p.seller_ids)
            if (allSellerIds.length > 0) {
              try {
                const suppliers = await odooRpc(odooUrl, config.odooDatabase, uid, config.odooApiKey,
                  'product.supplierinfo', 'search_read',
                  [[['id', 'in', allSellerIds]]],
                  { fields: ['id', 'partner_id', 'product_id', 'product_tmpl_id', 'min_qty', 'price', 'currency_id', 'delay'] }
                )

                for (const supplier of suppliers) {
                  try {
                    await importSupplier(parseInt(companyId), supplier, productsWithSellers)
                  } catch (err) {
                    console.error('[Odoo Sync] Supplier import error:', err)
                  }
                }
              } catch (err) {
                console.error('[Odoo Sync] Failed to get suppliers:', err)
              }
            }
          }
        } catch (batchError) {
          console.error(`[Odoo Sync] Batch ${offset} failed:`, batchError)
          errors.push({ id: offset, error: `Batch failed: ${batchError instanceof Error ? batchError.message : 'Unknown'}` })
        }
      }
    }

    // Update log
    await db.query(`
      UPDATE odoo_sync_logs SET
        products_imported = $1,
        products_updated = $2,
        errors = $3,
        completed_at = NOW(),
        status = 'completed'
      WHERE id = $4
    `, [imported, updated, JSON.stringify(errors), logId])

    return NextResponse.json({
      success: true,
      data: { imported, updated, errors: errors.length, total: imported + updated }
    })

  } catch (error) {
    console.error('[Odoo Sync] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en sincronización'
    }, { status: 500 })
  }
}

async function ensureTablesExist(companyId: number) {
  // Add new columns to market_products if they don't exist
  const newColumns = [
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS description_sale TEXT",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS description_purchase TEXT",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,4) DEFAULT 0",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS volume DECIMAL(10,4) DEFAULT 0",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS odoo_product_id INTEGER",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS odoo_type VARCHAR(50)",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS qty_free DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS qty_incoming DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS qty_outgoing DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE market_products ADD COLUMN IF NOT EXISTS last_odoo_sync TIMESTAMP"
  ]

  for (const sql of newColumns) {
    try {
      await db.query(sql)
    } catch {
      // Column may already exist
    }
  }

  // Create suppliers table
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_product_suppliers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        product_id INTEGER REFERENCES market_products(id) ON DELETE CASCADE,
        odoo_supplier_id INTEGER,
        supplier_name VARCHAR(255),
        supplier_code VARCHAR(100),
        min_qty DECIMAL(10,2) DEFAULT 0,
        price DECIMAL(10,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        lead_time_days INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, product_id, odoo_supplier_id)
      )
    `)
  } catch {
    // Table may exist
  }

  // Create mapping table
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS odoo_product_mapping (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        local_product_id INTEGER REFERENCES market_products(id) ON DELETE CASCADE,
        odoo_product_id INTEGER NOT NULL,
        last_sync_at TIMESTAMP,
        sync_status VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, odoo_product_id)
      )
    `)
  } catch {
    // Table may exist
  }

  // Create sync logs table
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS odoo_sync_logs (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        sync_type VARCHAR(50),
        direction VARCHAR(20),
        products_imported INTEGER DEFAULT 0,
        products_exported INTEGER DEFAULT 0,
        products_updated INTEGER DEFAULT 0,
        errors JSONB,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(20)
      )
    `)
  } catch {
    // Table may exist
  }
}

async function importProduct(companyId: number, product: any): Promise<'imported' | 'updated'> {
  const sku = product.default_code || `ODOO-${product.id}`
  const categoryName = product.categ_id ? product.categ_id[1] : null
  const uomName = product.uom_id ? product.uom_id[1] : 'Unidad'

  // Check if product exists by odoo_product_id or SKU
  const existing = await db.query(`
    SELECT id FROM market_products
    WHERE company_id = $1 AND (odoo_product_id = $2 OR sku = $3)
    LIMIT 1
  `, [companyId, product.id, sku])

  if (existing.rows.length > 0) {
    // Update existing product
    await db.query(`
      UPDATE market_products SET
        name = $1,
        barcode = $2,
        cost_price = $3,
        selling_price = $4,
        quantity_on_hand = $5,
        description = $6,
        description_sale = $7,
        description_purchase = $8,
        weight = $9,
        volume = $10,
        category = $11,
        unit_of_measure = $12,
        image_url = $13,
        odoo_product_id = $14,
        odoo_type = $15,
        qty_free = $16,
        qty_incoming = $17,
        qty_outgoing = $18,
        last_odoo_sync = NOW(),
        updated_at = NOW()
      WHERE id = $19
    `, [
      product.name,
      product.barcode || null,
      product.standard_price || 0,
      product.list_price || 0,
      product.qty_available || 0,
      stripHtml(product.description) || null,
      product.description_sale || null,
      product.description_purchase || null,
      product.weight || 0,
      product.volume || 0,
      categoryName,
      uomName,
      product.image_1920 ? `data:image/png;base64,${product.image_1920}` : null,
      product.id,
      product.type,
      product.free_qty || 0,
      product.incoming_qty || 0,
      product.outgoing_qty || 0,
      existing.rows[0].id
    ])

    // Update mapping
    await db.query(`
      INSERT INTO odoo_product_mapping (company_id, local_product_id, odoo_product_id, last_sync_at, sync_status)
      VALUES ($1, $2, $3, NOW(), 'synced')
      ON CONFLICT (company_id, odoo_product_id) DO UPDATE SET
        local_product_id = $2,
        last_sync_at = NOW(),
        sync_status = 'synced'
    `, [companyId, existing.rows[0].id, product.id])

    return 'updated'
  } else {
    // Create new product
    const result = await db.query(`
      INSERT INTO market_products (
        company_id, name, sku, barcode, cost_price, selling_price, quantity_on_hand,
        description, description_sale, description_purchase, weight, volume,
        category, unit_of_measure, image_url, odoo_product_id, odoo_type,
        qty_free, qty_incoming, qty_outgoing, last_odoo_sync, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), true, NOW())
      RETURNING id
    `, [
      companyId,
      product.name,
      sku,
      product.barcode || null,
      product.standard_price || 0,
      product.list_price || 0,
      product.qty_available || 0,
      stripHtml(product.description) || null,
      product.description_sale || null,
      product.description_purchase || null,
      product.weight || 0,
      product.volume || 0,
      categoryName,
      uomName,
      product.image_1920 ? `data:image/png;base64,${product.image_1920}` : null,
      product.id,
      product.type,
      product.free_qty || 0,
      product.incoming_qty || 0,
      product.outgoing_qty || 0
    ])

    // Create mapping
    await db.query(`
      INSERT INTO odoo_product_mapping (company_id, local_product_id, odoo_product_id, last_sync_at, sync_status)
      VALUES ($1, $2, $3, NOW(), 'synced')
      ON CONFLICT (company_id, odoo_product_id) DO UPDATE SET
        local_product_id = $2,
        last_sync_at = NOW()
    `, [companyId, result.rows[0].id, product.id])

    return 'imported'
  }
}

async function importSupplier(companyId: number, supplier: any, products: any[]) {
  // Find which product this supplier belongs to
  const product = products.find((p: any) => p.seller_ids?.includes(supplier.id))
  if (!product) return

  // Get local product ID
  const localProduct = await db.query(`
    SELECT id FROM market_products WHERE company_id = $1 AND odoo_product_id = $2
  `, [companyId, product.id])

  if (localProduct.rows.length === 0) return

  const supplierName = supplier.partner_id ? supplier.partner_id[1] : 'Unknown'
  const currency = supplier.currency_id ? supplier.currency_id[1] : 'USD'

  await db.query(`
    INSERT INTO market_product_suppliers (
      company_id, product_id, odoo_supplier_id, supplier_name, min_qty, price, currency, lead_time_days, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (company_id, product_id, odoo_supplier_id) DO UPDATE SET
      supplier_name = $4,
      min_qty = $5,
      price = $6,
      currency = $7,
      lead_time_days = $8,
      updated_at = NOW()
  `, [
    companyId,
    localProduct.rows[0].id,
    supplier.id,
    supplierName,
    supplier.min_qty || 0,
    supplier.price || 0,
    currency,
    supplier.delay || 0
  ])
}

function stripHtml(html: string | false | null): string | null {
  if (!html) return null
  return html.replace(/<[^>]*>/g, '').trim() || null
}
