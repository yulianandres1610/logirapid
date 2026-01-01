import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface SearchResult {
  id: number | string
  type: 'consignment' | 'purchase' | 'pickup_order' | 'office_order' | 'product' | 'customer'
  title: string
  subtitle: string
  status?: string
  date?: string
  amount?: number
  url: string
}

/**
 * GET /api/search?q=query&type=all|consignment|purchase|pickup_order|office_order|product|customer
 * Global search across company documents
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '20')

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          results: [],
          total: 0,
          query
        }
      })
    }

    const results: SearchResult[] = []
    const searchPattern = `%${query}%`

    // Determine base path based on role
    const rolePaths: Record<string, string> = {
      'SUPER_ADMIN': '/dashboard/admin',
      'ADMIN': '/dashboard/agency-admin',
      'AGENCY_ADMIN': '/dashboard/agency-admin',
      'MANAGER': '/dashboard/manager',
      'USER': '/dashboard/user',
      'MARKET': '/dashboard/market'
    }
    const basePath = rolePaths[payload.role] || '/dashboard'

    // Search Consignment Orders
    if (type === 'all' || type === 'consignment') {
      try {
        const consignmentQuery = `
          SELECT
            co.id,
            co.order_number,
            co.status,
            co.total_cost,
            co.consignment_date,
            cs.name as supplier_name
          FROM consignment_orders co
          LEFT JOIN consignment_suppliers cs ON co.supplier_id = cs.id
          WHERE co.company_id = $1
            AND (
              co.order_number ILIKE $2
              OR cs.name ILIKE $2
              OR co.notes ILIKE $2
            )
          ORDER BY co.created_at DESC
          LIMIT $3
        `
        const consignmentResult = await db.query(consignmentQuery, [payload.companyId, searchPattern, limit])

        for (const row of consignmentResult.rows) {
          results.push({
            id: row.id,
            type: 'consignment',
            title: `Consignacion ${row.order_number}`,
            subtitle: row.supplier_name || 'Sin proveedor',
            status: row.status,
            date: row.consignment_date,
            amount: parseFloat(row.total_cost) || 0,
            url: `/dashboard/market/consignments/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Consignment search skipped:', e)
      }
    }

    // Search Purchase Orders
    if (type === 'all' || type === 'purchase') {
      try {
        const purchaseQuery = `
          SELECT
            mp.id,
            mp.purchase_number,
            mp.status,
            mp.total_amount,
            mp.purchase_date,
            mp.supplier_name
          FROM market_purchases mp
          WHERE mp.company_id = $1
            AND (
              mp.purchase_number ILIKE $2
              OR mp.supplier_name ILIKE $2
              OR mp.notes ILIKE $2
            )
          ORDER BY mp.created_at DESC
          LIMIT $3
        `
        const purchaseResult = await db.query(purchaseQuery, [payload.companyId, searchPattern, limit])

        for (const row of purchaseResult.rows) {
          results.push({
            id: row.id,
            type: 'purchase',
            title: `Compra ${row.purchase_number}`,
            subtitle: row.supplier_name || 'Sin proveedor',
            status: row.status,
            date: row.purchase_date,
            amount: parseFloat(row.total_amount) || 0,
            url: `/dashboard/market/purchases/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Purchase search skipped:', e)
      }
    }

    // Search Pickup Orders
    if (type === 'all' || type === 'pickup_order') {
      try {
        const pickupQuery = `
          SELECT
            po.id,
            po.tracking_code,
            po.status,
            po.pickup_date,
            po.sender_name,
            po.recipient_name,
            po.total_amount
          FROM pickup_orders po
          WHERE po.company_id = $1
            AND (
              po.tracking_code ILIKE $2
              OR po.sender_name ILIKE $2
              OR po.recipient_name ILIKE $2
              OR po.sender_phone ILIKE $2
              OR po.recipient_phone ILIKE $2
            )
          ORDER BY po.created_at DESC
          LIMIT $3
        `
        const pickupResult = await db.query(pickupQuery, [payload.companyId, searchPattern, limit])

        for (const row of pickupResult.rows) {
          results.push({
            id: row.id,
            type: 'pickup_order',
            title: `Orden ${row.tracking_code}`,
            subtitle: `${row.sender_name} → ${row.recipient_name}`,
            status: row.status,
            date: row.pickup_date,
            amount: parseFloat(row.total_amount) || 0,
            url: `${basePath}/pickup-orders/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Pickup order search skipped:', e)
      }
    }

    // Search Office Orders
    if (type === 'all' || type === 'office_order') {
      try {
        const officeQuery = `
          SELECT
            oo.id,
            oo.tracking_code,
            oo.status,
            oo.created_at,
            oo.sender_name,
            oo.recipient_name,
            oo.total_amount
          FROM office_orders oo
          WHERE oo.company_id = $1
            AND (
              oo.tracking_code ILIKE $2
              OR oo.sender_name ILIKE $2
              OR oo.recipient_name ILIKE $2
              OR oo.sender_phone ILIKE $2
              OR oo.recipient_phone ILIKE $2
            )
          ORDER BY oo.created_at DESC
          LIMIT $3
        `
        const officeResult = await db.query(officeQuery, [payload.companyId, searchPattern, limit])

        for (const row of officeResult.rows) {
          results.push({
            id: row.id,
            type: 'office_order',
            title: `Orden ${row.tracking_code}`,
            subtitle: `${row.sender_name} → ${row.recipient_name}`,
            status: row.status,
            date: row.created_at,
            amount: parseFloat(row.total_amount) || 0,
            url: `${basePath}/office-orders/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Office order search skipped:', e)
      }
    }

    // Search Products
    if (type === 'all' || type === 'product') {
      try {
        const productQuery = `
          SELECT
            p.id,
            p.name,
            p.sku,
            p.barcode,
            p.base_price,
            p.stock_quantity
          FROM products p
          WHERE p.company_id = $1
            AND (
              p.name ILIKE $2
              OR p.sku ILIKE $2
              OR p.barcode ILIKE $2
              OR p.description ILIKE $2
            )
          ORDER BY p.name ASC
          LIMIT $3
        `
        const productResult = await db.query(productQuery, [payload.companyId, searchPattern, limit])

        for (const row of productResult.rows) {
          results.push({
            id: row.id,
            type: 'product',
            title: row.name,
            subtitle: `SKU: ${row.sku}${row.barcode ? ` | Codigo: ${row.barcode}` : ''}`,
            status: row.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
            amount: parseFloat(row.base_price) || 0,
            url: `/dashboard/market/inventory/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Product search skipped:', e)
      }
    }

    // Search Customers
    if (type === 'all' || type === 'customer') {
      try {
        const customerQuery = `
          SELECT
            c.id,
            c.name,
            c.phone,
            c.email,
            c.created_at
          FROM customers c
          WHERE c.company_id = $1
            AND (
              c.name ILIKE $2
              OR c.phone ILIKE $2
              OR c.email ILIKE $2
            )
          ORDER BY c.name ASC
          LIMIT $3
        `
        const customerResult = await db.query(customerQuery, [payload.companyId, searchPattern, limit])

        for (const row of customerResult.rows) {
          results.push({
            id: row.id,
            type: 'customer',
            title: row.name,
            subtitle: row.phone || row.email || 'Sin contacto',
            date: row.created_at,
            url: `${basePath}/crm/customers/${row.id}`
          })
        }
      } catch (e) {
        console.log('[Search] Customer search skipped:', e)
      }
    }

    // Sort results by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      return aExact - bExact
    })

    return NextResponse.json({
      success: true,
      data: {
        results: results.slice(0, limit),
        total: results.length,
        query
      }
    })

  } catch (error) {
    console.error('[Search] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en la busqueda'
    }, { status: 500 })
  }
}
