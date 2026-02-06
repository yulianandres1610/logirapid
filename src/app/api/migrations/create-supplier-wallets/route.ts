import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/create-supplier-wallets
 * Check which suppliers are missing wallets
 */
export async function GET() {
  try {
    // Find suppliers without wallets
    const result = await db.query(`
      SELECT
        ms.id,
        ms.supplier_code,
        ms.name,
        ms.company_id,
        w.id as wallet_id,
        COALESCE((SELECT COUNT(*) FROM consignment_orders WHERE supplier_id = ms.id), 0) as orders_count,
        COALESCE((SELECT SUM(total_sold) FROM consignment_orders WHERE supplier_id = ms.id), 0) as total_sold
      FROM market_suppliers ms
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = ms.id
      WHERE ms.is_active = true
      ORDER BY ms.name
    `)

    const suppliers = result.rows.map(s => ({
      id: s.id,
      code: s.supplier_code,
      name: s.name,
      companyId: s.company_id,
      hasWallet: !!s.wallet_id,
      ordersCount: parseInt(s.orders_count) || 0,
      totalSold: parseFloat(s.total_sold) || 0
    }))

    const withoutWallet = suppliers.filter(s => !s.hasWallet)
    const withWallet = suppliers.filter(s => s.hasWallet)

    return NextResponse.json({
      success: true,
      data: {
        total: suppliers.length,
        withWallet: withWallet.length,
        withoutWallet: withoutWallet.length,
        suppliersNeedingWallet: withoutWallet
      }
    })

  } catch (error) {
    console.error('[Create Supplier Wallets GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/create-supplier-wallets
 * Create wallets for suppliers that don't have one
 */
export async function POST() {
  try {
    const results: string[] = []
    let created = 0

    // Find suppliers without wallets
    const suppliersResult = await db.query(`
      SELECT
        ms.id,
        ms.supplier_code,
        ms.name,
        ms.company_id,
        COALESCE((SELECT SUM(total_sold) FROM consignment_orders WHERE supplier_id = ms.id), 0) as total_sold,
        COALESCE((SELECT SUM(total_paid) FROM consignment_orders WHERE supplier_id = ms.id), 0) as total_paid
      FROM market_suppliers ms
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = ms.id
      WHERE ms.is_active = true AND w.id IS NULL
    `)

    for (const supplier of suppliersResult.rows) {
      const totalSold = parseFloat(supplier.total_sold) || 0
      const totalPaid = parseFloat(supplier.total_paid) || 0
      const balanceAvailable = totalSold - totalPaid

      // Create wallet
      await db.query(`
        INSERT INTO consignment_supplier_wallets (
          supplier_id, company_id, balance_available, balance_pending,
          total_earned, total_paid, total_returned, created_at, updated_at
        ) VALUES ($1, $2, $3, 0, $4, $5, 0, NOW(), NOW())
      `, [supplier.id, supplier.company_id, balanceAvailable, totalSold, totalPaid])

      results.push(`✓ ${supplier.name} (${supplier.supplier_code}): Wallet creado con saldo $${balanceAvailable.toFixed(2)}`)
      created++
    }

    if (created === 0) {
      results.push('Todos los proveedores ya tienen wallet')
    }

    return NextResponse.json({
      success: true,
      message: `${created} wallets creados`,
      results
    })

  } catch (error) {
    console.error('[Create Supplier Wallets POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
