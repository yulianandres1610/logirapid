import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface LotData {
  id: number
  lotNumber: string
  expirationDate: string | null
  manufacturingDate: string | null
  quantity: number
  quantityAvailable: number
  notes: string | null
  isActive: boolean
  createdAt: string
  purchaseNumber: string | null
  purchaseDate: string | null
  supplierName: string | null
  warehouseName: string | null
  unitCost: number
  source: 'consignment' | 'purchase' | 'manual'
}

/**
 * GET /api/market/products/[id]/lots
 * Get all lots for a product from all sources (consignment, purchase, manual)
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

    // Verify product belongs to company
    const productCheck = await db.query(`
      SELECT id FROM market_products WHERE id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    if (productCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const allLots: LotData[] = []

    // 1. Get lots from consignment_lot_inventory (consignment FIFO)
    try {
      const consignmentLots = await db.query(`
        SELECT
          cli.id,
          cli.lot_number,
          cli.expiration_date,
          NULL as manufacturing_date,
          cli.quantity_initial as quantity,
          cli.quantity_available,
          NULL as notes,
          (cli.quantity_available > 0) as is_active,
          cli.received_at as created_at,
          co.order_number as purchase_number,
          co.consignment_date as purchase_date,
          cs.name as supplier_name,
          mw.name as warehouse_name,
          cli.unit_cost
        FROM consignment_lot_inventory cli
        LEFT JOIN consignment_order_lines col ON col.id = cli.order_line_id
        LEFT JOIN consignment_orders co ON co.id = col.order_id
        LEFT JOIN market_suppliers cs ON cs.id = cli.supplier_id
        LEFT JOIN market_warehouses mw ON mw.id = cli.warehouse_id
        WHERE cli.product_id = $1 AND cli.company_id = $2
        ORDER BY cli.received_at DESC
      `, [productId, parseInt(companyId)])

      for (const lot of consignmentLots.rows) {
        allLots.push({
          id: lot.id,
          lotNumber: lot.lot_number,
          expirationDate: lot.expiration_date,
          manufacturingDate: lot.manufacturing_date,
          quantity: parseFloat(lot.quantity) || 0,
          quantityAvailable: parseFloat(lot.quantity_available) || 0,
          notes: lot.notes,
          isActive: lot.is_active,
          createdAt: lot.created_at,
          purchaseNumber: lot.purchase_number,
          purchaseDate: lot.purchase_date,
          supplierName: lot.supplier_name,
          warehouseName: lot.warehouse_name,
          unitCost: parseFloat(lot.unit_cost) || 0,
          source: 'consignment'
        })
      }
    } catch (err) {
      console.log('consignment_lot_inventory table may not exist:', err)
    }

    // 2. Get lots from purchase_lot_inventory (purchase FIFO) if exists
    try {
      const purchaseLots = await db.query(`
        SELECT
          pli.id,
          pli.lot_number,
          pli.expiration_date,
          NULL as manufacturing_date,
          pli.quantity_initial as quantity,
          pli.quantity_available,
          NULL as notes,
          (pli.quantity_available > 0) as is_active,
          pli.created_at,
          mp.purchase_number,
          mp.purchase_date,
          mp.supplier_name,
          mw.name as warehouse_name,
          pli.unit_cost
        FROM purchase_lot_inventory pli
        LEFT JOIN market_purchases mp ON mp.id = (
          SELECT mpl.purchase_id FROM market_purchase_lines mpl WHERE mpl.id = pli.purchase_line_id LIMIT 1
        )
        LEFT JOIN market_warehouses mw ON mw.id = pli.warehouse_id
        WHERE pli.product_id = $1 AND pli.company_id = $2
        ORDER BY pli.created_at DESC
      `, [productId, parseInt(companyId)])

      for (const lot of purchaseLots.rows) {
        allLots.push({
          id: lot.id + 1000000, // Offset to avoid ID collision
          lotNumber: lot.lot_number,
          expirationDate: lot.expiration_date,
          manufacturingDate: lot.manufacturing_date,
          quantity: parseFloat(lot.quantity) || 0,
          quantityAvailable: parseFloat(lot.quantity_available) || 0,
          notes: lot.notes,
          isActive: lot.is_active,
          createdAt: lot.created_at,
          purchaseNumber: lot.purchase_number,
          purchaseDate: lot.purchase_date,
          supplierName: lot.supplier_name,
          warehouseName: lot.warehouse_name,
          unitCost: parseFloat(lot.unit_cost) || 0,
          source: 'purchase'
        })
      }
    } catch (err) {
      console.log('purchase_lot_inventory table may not exist:', err)
    }

    // 3. Get lots from market_product_lots (manual lots) if exists
    try {
      const manualLots = await db.query(`
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
          mp.purchase_number,
          mp.purchase_date,
          mp.supplier_name,
          NULL as warehouse_name,
          NULL as unit_cost
        FROM market_product_lots mpl
        LEFT JOIN market_purchases mp ON mpl.purchase_id = mp.id
        WHERE mpl.product_id = $1 AND mpl.company_id = $2
        ORDER BY mpl.created_at DESC
      `, [productId, parseInt(companyId)])

      for (const lot of manualLots.rows) {
        allLots.push({
          id: lot.id + 2000000, // Offset to avoid ID collision
          lotNumber: lot.lot_number,
          expirationDate: lot.expiration_date,
          manufacturingDate: lot.manufacturing_date,
          quantity: parseFloat(lot.quantity) || 0,
          quantityAvailable: parseFloat(lot.quantity_available) || 0,
          notes: lot.notes,
          isActive: lot.is_active,
          createdAt: lot.created_at,
          purchaseNumber: lot.purchase_number,
          purchaseDate: lot.purchase_date,
          supplierName: lot.supplier_name,
          warehouseName: lot.warehouse_name,
          unitCost: parseFloat(lot.unit_cost) || 0,
          source: 'manual'
        })
      }
    } catch (err) {
      console.log('market_product_lots table may not exist:', err)
    }

    // Sort all lots by expiration date (FIFO - earliest first)
    allLots.sort((a, b) => {
      // Lots without expiration go last
      if (!a.expirationDate && !b.expirationDate) return 0
      if (!a.expirationDate) return 1
      if (!b.expirationDate) return -1
      return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
    })

    // Calculate stats
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const stats = {
      totalLots: allLots.length,
      activeLots: allLots.filter(l => l.isActive && l.quantityAvailable > 0).length,
      totalQuantity: allLots.reduce((sum, l) => sum + l.quantity, 0),
      availableQuantity: allLots.reduce((sum, l) => sum + l.quantityAvailable, 0),
      expiredLots: 0,
      criticalLots: 0,
      warningLots: 0,
      consignmentLots: allLots.filter(l => l.source === 'consignment').length,
      purchaseLots: allLots.filter(l => l.source === 'purchase').length
    }

    for (const lot of allLots) {
      if (lot.expirationDate) {
        const expDate = new Date(lot.expirationDate)
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
        lots: allLots,
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
