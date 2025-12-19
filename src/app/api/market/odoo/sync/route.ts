import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { createOdooClient, transformOdooProduct } from '@/lib/odoo-client'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    const companyId = cookieStore.get('user-company-id')?.value

    if (!token || !companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { direction } = body // 'import' or 'export'

    // Get company's Odoo config
    const configResult = await db.query(`
      SELECT
        odoo_url as "odooUrl",
        odoo_database as "odooDatabase",
        odoo_api_key as "odooApiKey",
        odoo_enabled as "odooEnabled"
      FROM companies
      WHERE id = $1
    `, [parseInt(companyId)])

    if (configResult.rows.length === 0 || !configResult.rows[0].odooEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Odoo no está configurado o habilitado'
      }, { status: 400 })
    }

    const config = configResult.rows[0]

    // Create Odoo client
    const client = createOdooClient({
      url: config.odooUrl,
      database: config.odooDatabase,
      apiKey: config.odooApiKey
    })

    // Ensure mapping table exists
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS odoo_product_mapping (
          id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(id),
          local_product_id INTEGER REFERENCES market_products(id),
          odoo_product_id INTEGER NOT NULL,
          odoo_variant_id INTEGER,
          last_sync_at TIMESTAMP,
          sync_direction VARCHAR(20),
          sync_status VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(company_id, local_product_id),
          UNIQUE(company_id, odoo_product_id)
        )
      `)
    } catch {
      // Table may already exist
    }

    // Ensure logs table exists
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
          status VARCHAR(20),
          triggered_by VARCHAR(255)
        )
      `)
    } catch {
      // Table may already exist
    }

    // Create log entry
    const logResult = await db.query(`
      INSERT INTO odoo_sync_logs (company_id, sync_type, direction, started_at, status)
      VALUES ($1, 'manual', $2, NOW(), 'in_progress')
      RETURNING id
    `, [parseInt(companyId), direction])
    const logId = logResult.rows[0].id

    let imported = 0
    let exported = 0
    let updated = 0
    const errors: { id: number; error: string }[] = []

    try {
      if (direction === 'import') {
        // Import products from Odoo
        const odooProducts = await client.getProducts({ limit: 500 })

        for (const odooProduct of odooProducts) {
          try {
            const transformed = transformOdooProduct(odooProduct)

            // Check if product already exists (by SKU or mapping)
            const existingMapping = await db.query(`
              SELECT local_product_id FROM odoo_product_mapping
              WHERE company_id = $1 AND odoo_product_id = $2
            `, [parseInt(companyId), odooProduct.id])

            if (existingMapping.rows.length > 0) {
              // Update existing product
              await db.query(`
                UPDATE market_products SET
                  name = $1,
                  barcode = $2,
                  cost_price = $3,
                  selling_price = $4,
                  quantity_on_hand = $5,
                  updated_at = NOW()
                WHERE id = $6
              `, [
                transformed.name,
                transformed.barcode,
                transformed.costPrice,
                transformed.sellingPrice,
                transformed.quantityOnHand,
                existingMapping.rows[0].local_product_id
              ])
              updated++
            } else {
              // Check by SKU
              const existingSku = await db.query(`
                SELECT id FROM market_products
                WHERE company_id = $1 AND sku = $2
              `, [parseInt(companyId), transformed.sku])

              if (existingSku.rows.length > 0) {
                // Update and create mapping
                await db.query(`
                  UPDATE market_products SET
                    name = $1,
                    barcode = $2,
                    cost_price = $3,
                    selling_price = $4,
                    quantity_on_hand = $5,
                    updated_at = NOW()
                  WHERE id = $6
                `, [
                  transformed.name,
                  transformed.barcode,
                  transformed.costPrice,
                  transformed.sellingPrice,
                  transformed.quantityOnHand,
                  existingSku.rows[0].id
                ])

                await db.query(`
                  INSERT INTO odoo_product_mapping
                  (company_id, local_product_id, odoo_product_id, last_sync_at, sync_direction, sync_status)
                  VALUES ($1, $2, $3, NOW(), 'odoo_to_local', 'synced')
                  ON CONFLICT (company_id, local_product_id) DO UPDATE SET
                    odoo_product_id = $3,
                    last_sync_at = NOW(),
                    sync_status = 'synced'
                `, [parseInt(companyId), existingSku.rows[0].id, odooProduct.id])

                updated++
              } else {
                // Create new product
                const newProduct = await db.query(`
                  INSERT INTO market_products
                  (company_id, name, sku, barcode, cost_price, selling_price, quantity_on_hand, unit_of_measure, is_active)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                  RETURNING id
                `, [
                  parseInt(companyId),
                  transformed.name,
                  transformed.sku,
                  transformed.barcode,
                  transformed.costPrice,
                  transformed.sellingPrice,
                  transformed.quantityOnHand,
                  transformed.unitOfMeasure
                ])

                await db.query(`
                  INSERT INTO odoo_product_mapping
                  (company_id, local_product_id, odoo_product_id, last_sync_at, sync_direction, sync_status)
                  VALUES ($1, $2, $3, NOW(), 'odoo_to_local', 'synced')
                `, [parseInt(companyId), newProduct.rows[0].id, odooProduct.id])

                imported++
              }
            }
          } catch (err) {
            errors.push({
              id: odooProduct.id,
              error: err instanceof Error ? err.message : 'Error desconocido'
            })
          }
        }
      } else if (direction === 'export') {
        // Export products to Odoo
        const localProducts = await db.query(`
          SELECT
            mp.id,
            mp.name,
            mp.sku,
            mp.barcode,
            mp.cost_price,
            mp.selling_price,
            opm.odoo_product_id
          FROM market_products mp
          LEFT JOIN odoo_product_mapping opm ON mp.id = opm.local_product_id AND opm.company_id = mp.company_id
          WHERE mp.company_id = $1 AND mp.is_active = true
        `, [parseInt(companyId)])

        for (const product of localProducts.rows) {
          try {
            if (product.odoo_product_id) {
              // Update existing in Odoo
              await client.updateProduct(product.odoo_product_id, {
                name: product.name,
                default_code: product.sku,
                barcode: product.barcode,
                standard_price: parseFloat(product.cost_price) || 0,
                list_price: parseFloat(product.selling_price) || 0
              })

              await db.query(`
                UPDATE odoo_product_mapping SET
                  last_sync_at = NOW(),
                  sync_direction = 'local_to_odoo',
                  sync_status = 'synced'
                WHERE company_id = $1 AND local_product_id = $2
              `, [parseInt(companyId), product.id])

              updated++
            } else {
              // Create new in Odoo
              const odooId = await client.createProduct({
                name: product.name,
                default_code: product.sku,
                barcode: product.barcode,
                standard_price: parseFloat(product.cost_price) || 0,
                list_price: parseFloat(product.selling_price) || 0,
                type: 'product'
              })

              await db.query(`
                INSERT INTO odoo_product_mapping
                (company_id, local_product_id, odoo_product_id, last_sync_at, sync_direction, sync_status)
                VALUES ($1, $2, $3, NOW(), 'local_to_odoo', 'synced')
              `, [parseInt(companyId), product.id, odooId])

              exported++
            }
          } catch (err) {
            errors.push({
              id: product.id,
              error: err instanceof Error ? err.message : 'Error desconocido'
            })
          }
        }
      }

      // Update log
      await db.query(`
        UPDATE odoo_sync_logs SET
          products_imported = $1,
          products_exported = $2,
          products_updated = $3,
          errors = $4,
          completed_at = NOW(),
          status = 'completed'
        WHERE id = $5
      `, [imported, exported, updated, JSON.stringify(errors), logId])

      return NextResponse.json({
        success: true,
        data: {
          imported,
          exported,
          updated,
          errors: errors.length
        }
      })
    } catch (syncError) {
      // Update log with error
      await db.query(`
        UPDATE odoo_sync_logs SET
          products_imported = $1,
          products_exported = $2,
          products_updated = $3,
          errors = $4,
          completed_at = NOW(),
          status = 'error'
        WHERE id = $5
      `, [imported, exported, updated, JSON.stringify([...errors, { id: 0, error: syncError instanceof Error ? syncError.message : 'Error general' }]), logId])

      throw syncError
    }
  } catch (error) {
    console.error('Error syncing with Odoo:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en sincronización'
    }, { status: 500 })
  }
}
