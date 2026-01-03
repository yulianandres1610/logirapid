import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/unify-suppliers
 * Migra los foreign keys de consignment_orders y market_purchases
 * para que apunten a market_suppliers (tabla unificada)
 */
export async function POST() {
  try {
    console.log('[Migration] Starting supplier unification migration...')
    const results: string[] = []

    // 1. Migrar datos de consignment_suppliers a market_suppliers si existen
    try {
      const existingConsignmentSuppliers = await db.query(`
        SELECT cs.*, c.id as company_id
        FROM consignment_suppliers cs
        JOIN companies c ON c.id = cs.company_id
        WHERE NOT EXISTS (
          SELECT 1 FROM market_suppliers ms
          WHERE ms.company_id = cs.company_id
          AND (ms.name = cs.name OR ms.supplier_code = cs.code)
        )
      `)

      if (existingConsignmentSuppliers.rows.length > 0) {
        for (const cs of existingConsignmentSuppliers.rows) {
          await db.query(`
            INSERT INTO market_suppliers (
              company_id, supplier_code, name, legal_name, tax_id, contact_name,
              email, phone, address, is_active, rating, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 3, NOW(), NOW())
          `, [
            cs.company_id,
            cs.code || `SUP-MIG-${cs.id}`,
            cs.name,
            cs.legal_name,
            cs.tax_id,
            cs.contact_name,
            cs.email,
            cs.phone,
            cs.address,
            cs.is_active ?? true
          ])
        }
        results.push(`Migrated ${existingConsignmentSuppliers.rows.length} suppliers from consignment_suppliers`)
      }
    } catch (e) {
      console.log('[Migration] consignment_suppliers table may not exist, skipping data migration')
    }

    // 2. Drop old foreign key on consignment_orders if exists
    try {
      await db.query(`
        ALTER TABLE consignment_orders
        DROP CONSTRAINT IF EXISTS consignment_orders_supplier_id_fkey
      `)
      results.push('Dropped consignment_orders_supplier_id_fkey')
    } catch (e) {
      console.log('[Migration] Could not drop consignment FK:', e)
    }

    // 3. Drop old foreign key on market_purchases if exists
    try {
      await db.query(`
        ALTER TABLE market_purchases
        DROP CONSTRAINT IF EXISTS market_purchases_supplier_id_fkey
      `)
      results.push('Dropped market_purchases_supplier_id_fkey')
    } catch (e) {
      console.log('[Migration] Could not drop purchases FK:', e)
    }

    // 4. Add new foreign key on consignment_orders pointing to market_suppliers
    try {
      await db.query(`
        ALTER TABLE consignment_orders
        ADD CONSTRAINT consignment_orders_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES market_suppliers(id)
      `)
      results.push('Added consignment_orders FK to market_suppliers')
    } catch (e) {
      console.log('[Migration] Could not add consignment FK:', e)
      results.push('FK consignment_orders already exists or error: ' + (e as Error).message)
    }

    // 5. Add new foreign key on market_purchases pointing to market_suppliers
    try {
      await db.query(`
        ALTER TABLE market_purchases
        ADD CONSTRAINT market_purchases_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES market_suppliers(id)
      `)
      results.push('Added market_purchases FK to market_suppliers')
    } catch (e) {
      console.log('[Migration] Could not add purchases FK:', e)
      results.push('FK market_purchases already exists or error: ' + (e as Error).message)
    }

    // 6. Create index on market_suppliers for faster lookups
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_suppliers_company_name
        ON market_suppliers(company_id, name)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_suppliers_company_code
        ON market_suppliers(company_id, supplier_code)
      `)
      results.push('Created indexes on market_suppliers')
    } catch (e) {
      console.log('[Migration] Index creation:', e)
    }

    console.log('[Migration] Supplier unification complete:', results)

    return NextResponse.json({
      success: true,
      message: 'Supplier unification migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/unify-suppliers
 * Verificar estado de la migración
 */
export async function GET() {
  try {
    // Check current FK on consignment_orders
    const consignmentFk = await db.query(`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'consignment_orders'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%supplier%'
    `)

    // Check current FK on market_purchases
    const purchasesFk = await db.query(`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'market_purchases'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%supplier%'
    `)

    // Count suppliers in each table
    let consignmentSuppliersCount = 0
    let marketSuppliersCount = 0

    try {
      const cs = await db.query('SELECT COUNT(*) as count FROM consignment_suppliers')
      consignmentSuppliersCount = parseInt(cs.rows[0]?.count || '0')
    } catch {
      // Table doesn't exist
    }

    try {
      const ms = await db.query('SELECT COUNT(*) as count FROM market_suppliers')
      marketSuppliersCount = parseInt(ms.rows[0]?.count || '0')
    } catch {
      // Table doesn't exist
    }

    return NextResponse.json({
      success: true,
      data: {
        consignmentOrders: {
          foreignKey: consignmentFk.rows[0] || null,
          pointsTo: consignmentFk.rows[0]?.foreign_table_name || 'none'
        },
        marketPurchases: {
          foreignKey: purchasesFk.rows[0] || null,
          pointsTo: purchasesFk.rows[0]?.foreign_table_name || 'none'
        },
        supplierCounts: {
          consignment_suppliers: consignmentSuppliersCount,
          market_suppliers: marketSuppliersCount
        },
        migrationNeeded:
          consignmentFk.rows[0]?.foreign_table_name !== 'market_suppliers' ||
          purchasesFk.rows[0]?.foreign_table_name !== 'market_suppliers'
      }
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
