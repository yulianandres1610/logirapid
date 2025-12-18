import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/purchases
 * List all purchases for a market company
 */
export async function GET(request: NextRequest) {
  try {
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        mp.id,
        mp.purchase_number,
        mp.supplier_name,
        mp.supplier_contact,
        mp.supplier_address,
        mp.subtotal,
        mp.tax_amount,
        mp.total_amount,
        mp.currency,
        mp.status,
        mp.purchase_date,
        mp.expected_date,
        mp.received_date,
        mp.notes,
        mp.created_at,
        mp.updated_at,
        u1.name as created_by_name,
        u2.name as confirmed_by_name,
        u3.name as received_by_name,
        (SELECT COUNT(*) FROM market_purchase_lines WHERE purchase_id = mp.id) as line_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM market_purchase_lines WHERE purchase_id = mp.id) as total_items
      FROM market_purchases mp
      LEFT JOIN users u1 ON mp.created_by = u1.id
      LEFT JOIN users u2 ON mp.confirmed_by = u2.id
      LEFT JOIN users u3 ON mp.received_by = u3.id
      WHERE mp.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND mp.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM market_purchases/, 'SELECT COUNT(*) as total FROM market_purchases')
    const countResult = await db.query(countQuery.replace(/LEFT JOIN[\s\S]+WHERE/, 'WHERE'), [companyId])
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY mp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'received') as received_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'received'), 0) as total_received_amount
      FROM market_purchases
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        purchases: result.rows.map(row => ({
          id: row.id,
          purchaseNumber: row.purchase_number,
          supplierName: row.supplier_name,
          supplierContact: row.supplier_contact,
          supplierAddress: row.supplier_address,
          subtotal: parseFloat(row.subtotal) || 0,
          taxAmount: parseFloat(row.tax_amount) || 0,
          totalAmount: parseFloat(row.total_amount) || 0,
          currency: row.currency || 'USD',
          status: row.status,
          purchaseDate: row.purchase_date,
          expectedDate: row.expected_date,
          receivedDate: row.received_date,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdByName: row.created_by_name,
          confirmedByName: row.confirmed_by_name,
          receivedByName: row.received_by_name,
          lineCount: parseInt(row.line_count) || 0,
          totalItems: parseInt(row.total_items) || 0
        })),
        stats: {
          draft: parseInt(stats.draft_count) || 0,
          confirmed: parseInt(stats.confirmed_count) || 0,
          received: parseInt(stats.received_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          totalReceivedAmount: parseFloat(stats.total_received_amount) || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Market Purchases API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener compras'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/purchases
 * Create a new purchase order
 */
export async function POST(request: NextRequest) {
  try {
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      supplierName,
      supplierContact,
      supplierAddress,
      purchaseDate,
      expectedDate,
      notes,
      currency = 'USD',
      lines = []
    } = body

    if (!supplierName) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del proveedor es requerido'
      }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos un producto'
      }, { status: 400 })
    }

    // Validate lines
    for (const line of lines) {
      if (!line.productId || !line.quantity || !line.unitPrice) {
        return NextResponse.json({
          success: false,
          error: 'Cada linea debe tener producto, cantidad y precio unitario'
        }, { status: 400 })
      }
    }

    // Generate purchase number
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM market_purchases
      WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
    `, [companyId, year])
    const count = parseInt(countResult.rows[0]?.count || '0') + 1
    const purchaseNumber = `PUR-${year}-${count.toString().padStart(4, '0')}`

    // Calculate totals
    let subtotal = 0
    for (const line of lines) {
      const lineTotal = line.quantity * line.unitPrice
      subtotal += lineTotal
    }
    const taxAmount = 0 // No tax for now
    const totalAmount = subtotal + taxAmount

    // Create purchase and lines in transaction
    const result = await db.transaction(async (client) => {
      // Create purchase
      const purchaseResult = await client.query(`
        INSERT INTO market_purchases (
          company_id,
          purchase_number,
          supplier_name,
          supplier_contact,
          supplier_address,
          subtotal,
          tax_amount,
          total_amount,
          currency,
          status,
          purchase_date,
          expected_date,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12, $13, NOW(), NOW())
        RETURNING id
      `, [
        companyId,
        purchaseNumber,
        supplierName,
        supplierContact || null,
        supplierAddress || null,
        subtotal,
        taxAmount,
        totalAmount,
        currency,
        purchaseDate || new Date().toISOString().split('T')[0],
        expectedDate || null,
        notes || null,
        userId
      ])

      const purchaseId = purchaseResult.rows[0].id

      // Create lines
      for (const line of lines) {
        const lineTotal = line.quantity * line.unitPrice
        await client.query(`
          INSERT INTO market_purchase_lines (
            purchase_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            quantity_received,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
        `, [purchaseId, line.productId, line.quantity, line.unitPrice, lineTotal])

        // Update product expected quantity
        await client.query(`
          UPDATE market_products
          SET quantity_expected = COALESCE(quantity_expected, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [line.quantity, line.productId])
      }

      return { purchaseId, purchaseNumber }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.purchaseId,
        purchaseNumber: result.purchaseNumber,
        totalAmount,
        currency
      },
      message: 'Orden de compra creada exitosamente'
    })

  } catch (error) {
    console.error('[Market Purchases API] Error creating purchase:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden de compra'
    }, { status: 500 })
  }
}
