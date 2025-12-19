import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/market/products/[id]/lots
 * Get all lots for a product
 */
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

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_product_lots (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Lot identification
        lot_number VARCHAR(100) NOT NULL,

        -- Dates
        expiration_date DATE,
        manufacturing_date DATE,

        -- Quantities
        quantity INTEGER NOT NULL DEFAULT 0,
        quantity_available INTEGER NOT NULL DEFAULT 0,

        -- Purchase reference
        purchase_id INTEGER REFERENCES market_purchases(id) ON DELETE SET NULL,

        -- Notes
        notes TEXT,

        -- Status
        is_active BOOLEAN DEFAULT true,

        -- Audit
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Create indexes if they don't exist
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_market_product_lots_product ON market_product_lots(product_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_market_product_lots_company ON market_product_lots(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_market_product_lots_expiration ON market_product_lots(expiration_date)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_market_product_lots_lot_number ON market_product_lots(lot_number)`)
    } catch {
      // Indexes may already exist
    }

    // Verify product belongs to company
    const productCheck = await db.query(`
      SELECT id FROM market_products WHERE id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    if (productCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    // Get lots with purchase info
    const lotsResult = await db.query(`
      SELECT
        mpl.id,
        mpl.lot_number,
        mpl.expiration_date,
        mpl.manufacturing_date,
        mpl.quantity,
        mpl.quantity_available,
        mpl.notes,
        mpl.is_active,
        mpl.created_at,
        mpl.updated_at,
        mp.purchase_number,
        mp.purchase_date,
        mp.supplier_name
      FROM market_product_lots mpl
      LEFT JOIN market_purchases mp ON mpl.purchase_id = mp.id
      WHERE mpl.product_id = $1 AND mpl.company_id = $2
      ORDER BY
        CASE WHEN mpl.expiration_date IS NULL THEN 1 ELSE 0 END,
        mpl.expiration_date ASC,
        mpl.created_at DESC
    `, [productId, parseInt(companyId)])

    // Calculate stats
    const stats = {
      totalLots: lotsResult.rows.length,
      activeLots: lotsResult.rows.filter(l => l.is_active && l.quantity_available > 0).length,
      totalQuantity: lotsResult.rows.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0),
      availableQuantity: lotsResult.rows.reduce((sum, l) => sum + (parseInt(l.quantity_available) || 0), 0),
      expiredLots: 0,
      criticalLots: 0,
      warningLots: 0
    }

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    for (const lot of lotsResult.rows) {
      if (lot.expiration_date) {
        const expDate = new Date(lot.expiration_date)
        if (expDate < now) {
          stats.expiredLots++
        } else if (expDate < sevenDaysFromNow) {
          stats.criticalLots++
        } else if (expDate < thirtyDaysFromNow) {
          stats.warningLots++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lots: lotsResult.rows.map(lot => ({
          id: lot.id,
          lotNumber: lot.lot_number,
          expirationDate: lot.expiration_date,
          manufacturingDate: lot.manufacturing_date,
          quantity: parseInt(lot.quantity) || 0,
          quantityAvailable: parseInt(lot.quantity_available) || 0,
          notes: lot.notes,
          isActive: lot.is_active,
          createdAt: lot.created_at,
          updatedAt: lot.updated_at,
          purchaseNumber: lot.purchase_number,
          purchaseDate: lot.purchase_date,
          supplierName: lot.supplier_name
        })),
        stats
      }
    })
  } catch (error) {
    console.error('Error getting product lots:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener lotes del producto'
    }, { status: 500 })
  }
}
