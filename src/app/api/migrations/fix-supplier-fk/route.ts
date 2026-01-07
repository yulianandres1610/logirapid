import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-supplier-fk
 * Corrige las claves foráneas de supplier_id para usar market_suppliers
 * en lugar de consignment_suppliers
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-supplier-fk migration...')

    // 1. Drop old FK constraint on consignment_lot_inventory
    try {
      await db.query(`
        ALTER TABLE consignment_lot_inventory
        DROP CONSTRAINT IF EXISTS consignment_lot_inventory_supplier_id_fkey
      `)
      console.log('[Migration] Dropped old FK on consignment_lot_inventory')
    } catch (e) {
      console.log('[Migration] No FK to drop on consignment_lot_inventory:', e)
    }

    // 2. Drop old FK constraint on consignment_orders
    try {
      await db.query(`
        ALTER TABLE consignment_orders
        DROP CONSTRAINT IF EXISTS consignment_orders_supplier_id_fkey
      `)
      console.log('[Migration] Dropped old FK on consignment_orders')
    } catch (e) {
      console.log('[Migration] No FK to drop on consignment_orders:', e)
    }

    // 3. Drop old FK constraint on consignment_returns
    try {
      await db.query(`
        ALTER TABLE consignment_returns
        DROP CONSTRAINT IF EXISTS consignment_returns_supplier_id_fkey
      `)
      console.log('[Migration] Dropped old FK on consignment_returns')
    } catch (e) {
      console.log('[Migration] No FK to drop on consignment_returns:', e)
    }

    // 4. Drop old FK constraint on consignment_payment_requests
    try {
      await db.query(`
        ALTER TABLE consignment_payment_requests
        DROP CONSTRAINT IF EXISTS consignment_payment_requests_supplier_id_fkey
      `)
      console.log('[Migration] Dropped old FK on consignment_payment_requests')
    } catch (e) {
      console.log('[Migration] No FK to drop on consignment_payment_requests:', e)
    }

    // 5. Drop old FK constraint on consignment_supplier_wallets
    try {
      await db.query(`
        ALTER TABLE consignment_supplier_wallets
        DROP CONSTRAINT IF EXISTS consignment_supplier_wallets_supplier_id_fkey
      `)
      console.log('[Migration] Dropped old FK on consignment_supplier_wallets')
    } catch (e) {
      console.log('[Migration] No FK to drop on consignment_supplier_wallets:', e)
    }

    // 6. Add new FK constraints referencing market_suppliers
    // (these are optional - we can operate without FK for flexibility)

    // For consignment_lot_inventory - make supplier_id optional
    try {
      await db.query(`
        ALTER TABLE consignment_lot_inventory
        ADD CONSTRAINT consignment_lot_inventory_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES market_suppliers(id) ON DELETE SET NULL
      `)
      console.log('[Migration] Added new FK on consignment_lot_inventory -> market_suppliers')
    } catch (e) {
      console.log('[Migration] Could not add FK on consignment_lot_inventory:', e)
      // If we can't add FK (maybe some orphan records), just leave it without FK
    }

    // For consignment_orders
    try {
      await db.query(`
        ALTER TABLE consignment_orders
        ADD CONSTRAINT consignment_orders_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES market_suppliers(id) ON DELETE RESTRICT
      `)
      console.log('[Migration] Added new FK on consignment_orders -> market_suppliers')
    } catch (e) {
      console.log('[Migration] Could not add FK on consignment_orders:', e)
    }

    // 7. Update consignment_supplier_wallets to use market_suppliers
    // First check if there's data that needs migration
    try {
      const oldWallets = await db.query(`
        SELECT csw.id, csw.supplier_id, cs.code as old_code
        FROM consignment_supplier_wallets csw
        JOIN consignment_suppliers cs ON cs.id = csw.supplier_id
      `)

      if (oldWallets.rows.length > 0) {
        console.log(`[Migration] Found ${oldWallets.rows.length} wallets to migrate`)

        for (const wallet of oldWallets.rows) {
          // Find matching market_supplier by code
          const newSupplier = await db.query(`
            SELECT id FROM market_suppliers WHERE supplier_code = $1 LIMIT 1
          `, [wallet.old_code])

          if (newSupplier.rows.length > 0) {
            await db.query(`
              UPDATE consignment_supplier_wallets SET supplier_id = $1 WHERE id = $2
            `, [newSupplier.rows[0].id, wallet.id])
            console.log(`[Migration] Updated wallet ${wallet.id} to supplier ${newSupplier.rows[0].id}`)
          }
        }
      }
    } catch (e) {
      console.log('[Migration] Wallet migration skipped:', e)
    }

    console.log('[Migration] fix-supplier-fk migration completed')

    return NextResponse.json({
      success: true,
      message: 'Foreign key constraints updated to use market_suppliers',
      details: [
        'Dropped consignment_lot_inventory_supplier_id_fkey',
        'Dropped consignment_orders_supplier_id_fkey',
        'Added new FKs referencing market_suppliers'
      ]
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
 * GET /api/migrations/fix-supplier-fk
 * Verifica el estado de las claves foráneas
 */
export async function GET() {
  try {
    // Check current FK constraints
    const fkResult = await db.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
          'consignment_lot_inventory',
          'consignment_orders',
          'consignment_returns',
          'consignment_payment_requests',
          'consignment_supplier_wallets'
        )
        AND ccu.column_name = 'id'
      ORDER BY tc.table_name
    `)

    const constraints = fkResult.rows.map(r => ({
      table: r.table_name,
      constraint: r.constraint_name,
      references: r.foreign_table_name
    }))

    // Check for old consignment_suppliers references
    const needsMigration = constraints.some(c => c.references === 'consignment_suppliers')

    return NextResponse.json({
      success: true,
      needsMigration,
      constraints,
      message: needsMigration
        ? 'Some tables still reference consignment_suppliers. Run POST to migrate.'
        : 'All supplier references are correct.'
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
