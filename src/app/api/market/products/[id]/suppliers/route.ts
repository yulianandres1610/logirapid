import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

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

    // Get suppliers from purchase history for this product
    const suppliersResult = await db.query(`
      SELECT
        mp.supplier_name,
        mp.supplier_contact,
        mp.supplier_address,
        COUNT(DISTINCT mp.id) as purchase_count,
        SUM(mpl.quantity) as total_quantity_purchased,
        AVG(mpl.unit_price) as avg_price,
        MIN(mpl.unit_price) as min_price,
        MAX(mpl.unit_price) as max_price,
        MAX(mp.purchase_date) as last_purchase_date,
        mp.currency,
        -- Get last price
        (
          SELECT mpl2.unit_price
          FROM market_purchase_lines mpl2
          JOIN market_purchases mp2 ON mpl2.purchase_id = mp2.id
          WHERE mp2.supplier_name = mp.supplier_name
            AND mpl2.product_id = $1
            AND mp2.company_id = $2
          ORDER BY mp2.purchase_date DESC, mp2.created_at DESC
          LIMIT 1
        ) as last_price
      FROM market_purchase_lines mpl
      JOIN market_purchases mp ON mpl.purchase_id = mp.id
      WHERE mpl.product_id = $1
        AND mp.company_id = $2
        AND mp.status != 'cancelled'
      GROUP BY mp.supplier_name, mp.supplier_contact, mp.supplier_address, mp.currency
      ORDER BY MAX(mp.purchase_date) DESC
    `, [productId, parseInt(companyId)])

    // Format suppliers data
    const suppliers = suppliersResult.rows.map(row => ({
      supplierName: row.supplier_name,
      supplierContact: row.supplier_contact,
      supplierAddress: row.supplier_address,
      purchaseCount: parseInt(row.purchase_count) || 0,
      totalQuantityPurchased: parseInt(row.total_quantity_purchased) || 0,
      avgPrice: parseFloat(row.avg_price) || 0,
      minPrice: parseFloat(row.min_price) || 0,
      maxPrice: parseFloat(row.max_price) || 0,
      lastPrice: parseFloat(row.last_price) || 0,
      lastPurchaseDate: row.last_purchase_date,
      currency: row.currency || 'USD'
    }))

    // Get best price supplier
    const bestPrice = suppliers.length > 0
      ? suppliers.reduce((best, current) =>
          current.lastPrice < best.lastPrice ? current : best
        )
      : null

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        supplierCount: suppliers.length,
        bestPrice: bestPrice ? {
          supplierName: bestPrice.supplierName,
          price: bestPrice.lastPrice,
          currency: bestPrice.currency
        } : null
      }
    })
  } catch (error) {
    console.error('Error getting product suppliers:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener proveedores del producto'
    }, { status: 500 })
  }
}
