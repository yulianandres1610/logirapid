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
 * GET /api/market/suppliers/[id]
 * Get supplier details with statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const supplierId = parseInt(id)
    const companyId = payload.companyId

    if (isNaN(supplierId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de proveedor inválido'
      }, { status: 400 })
    }

    // Get supplier with stats
    const result = await db.query(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM market_purchases WHERE supplier_id = s.id) as purchase_count,
        (SELECT SUM(total_amount) FROM market_purchases WHERE supplier_id = s.id AND status != 'cancelled') as total_spent,
        (SELECT MAX(purchase_date) FROM market_purchases WHERE supplier_id = s.id) as last_purchase_date,
        (SELECT MIN(purchase_date) FROM market_purchases WHERE supplier_id = s.id) as first_purchase_date
      FROM market_suppliers s
      WHERE s.id = $1 AND s.company_id = $2
    `, [supplierId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get recent purchases
    const purchasesResult = await db.query(`
      SELECT
        id, purchase_number, total_amount, currency, status, purchase_date,
        (SELECT COUNT(*) FROM market_purchase_lines WHERE purchase_id = market_purchases.id) as line_count
      FROM market_purchases
      WHERE supplier_id = $1
      ORDER BY purchase_date DESC
      LIMIT 10
    `, [supplierId])

    // Get frequently purchased products
    const productsResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.image_url,
        COUNT(pl.id) as times_purchased,
        SUM(pl.quantity) as total_quantity,
        AVG(pl.unit_price) as avg_price,
        MAX(pl.unit_price) as max_price,
        MIN(pl.unit_price) as min_price
      FROM market_purchase_lines pl
      JOIN market_products p ON pl.product_id = p.id
      JOIN market_purchases pur ON pl.purchase_id = pur.id
      WHERE pur.supplier_id = $1
      GROUP BY p.id, p.name, p.sku, p.image_url
      ORDER BY times_purchased DESC
      LIMIT 10
    `, [supplierId])

    return NextResponse.json({
      success: true,
      data: {
        supplier: {
          id: row.id,
          supplierCode: row.supplier_code,
          name: row.name,
          legalName: row.legal_name,
          taxId: row.tax_id,
          contactPerson: row.contact_person,
          email: row.email,
          phone: row.phone,
          mobile: row.mobile,
          address: row.address,
          city: row.city,
          state: row.state,
          country: row.country,
          postalCode: row.postal_code,
          paymentTerms: row.payment_terms,
          creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : null,
          currency: row.currency,
          categories: row.categories || [],
          isActive: row.is_active,
          rating: row.rating,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        },
        stats: {
          purchaseCount: parseInt(row.purchase_count) || 0,
          totalSpent: parseFloat(row.total_spent) || 0,
          lastPurchaseDate: row.last_purchase_date,
          firstPurchaseDate: row.first_purchase_date
        },
        recentPurchases: purchasesResult.rows.map(p => ({
          id: p.id,
          purchaseNumber: p.purchase_number,
          totalAmount: parseFloat(p.total_amount) || 0,
          currency: p.currency,
          status: p.status,
          purchaseDate: p.purchase_date,
          lineCount: parseInt(p.line_count) || 0
        })),
        frequentProducts: productsResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          imageUrl: p.image_url,
          timesPurchased: parseInt(p.times_purchased) || 0,
          totalQuantity: parseInt(p.total_quantity) || 0,
          avgPrice: parseFloat(p.avg_price) || 0,
          maxPrice: parseFloat(p.max_price) || 0,
          minPrice: parseFloat(p.min_price) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Market Suppliers API] Error getting supplier:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proveedor'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/suppliers/[id]
 * Update supplier
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const supplierId = parseInt(id)
    const companyId = payload.companyId

    if (isNaN(supplierId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de proveedor inválido'
      }, { status: 400 })
    }

    // Check supplier exists and belongs to company
    const existsResult = await db.query(`
      SELECT id FROM market_suppliers
      WHERE id = $1 AND company_id = $2
    `, [supplierId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      legalName,
      taxId,
      contactPerson,
      email,
      phone,
      mobile,
      address,
      city,
      state,
      country,
      postalCode,
      paymentTerms,
      creditLimit,
      currency,
      categories,
      isActive,
      rating,
      notes
    } = body

    // Build update query dynamically
    const updates: string[] = []
    const values: (string | number | boolean | string[] | null)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (legalName !== undefined) {
      updates.push(`legal_name = $${paramIndex++}`)
      values.push(legalName || null)
    }
    if (taxId !== undefined) {
      updates.push(`tax_id = $${paramIndex++}`)
      values.push(taxId || null)
    }
    if (contactPerson !== undefined) {
      updates.push(`contact_person = $${paramIndex++}`)
      values.push(contactPerson || null)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(email || null)
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`)
      values.push(phone || null)
    }
    if (mobile !== undefined) {
      updates.push(`mobile = $${paramIndex++}`)
      values.push(mobile || null)
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`)
      values.push(address || null)
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`)
      values.push(city || null)
    }
    if (state !== undefined) {
      updates.push(`state = $${paramIndex++}`)
      values.push(state || null)
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`)
      values.push(country || null)
    }
    if (postalCode !== undefined) {
      updates.push(`postal_code = $${paramIndex++}`)
      values.push(postalCode || null)
    }
    if (paymentTerms !== undefined) {
      updates.push(`payment_terms = $${paramIndex++}`)
      values.push(paymentTerms || null)
    }
    if (creditLimit !== undefined) {
      updates.push(`credit_limit = $${paramIndex++}`)
      values.push(creditLimit || null)
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`)
      values.push(currency)
    }
    if (categories !== undefined) {
      updates.push(`categories = $${paramIndex++}`)
      values.push(categories && categories.length > 0 ? categories : null)
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(isActive)
    }
    if (rating !== undefined) {
      updates.push(`rating = $${paramIndex++}`)
      values.push(Math.min(5, Math.max(1, rating)))
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(notes || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(supplierId)

    await db.query(`
      UPDATE market_suppliers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values)

    console.log('[Market Suppliers] Updated supplier:', supplierId)

    return NextResponse.json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Market Suppliers API] Error updating supplier:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar proveedor'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/suppliers/[id]
 * Soft delete (deactivate) supplier
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const supplierId = parseInt(id)
    const companyId = payload.companyId

    if (isNaN(supplierId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de proveedor inválido'
      }, { status: 400 })
    }

    // Check supplier exists and belongs to company
    const existsResult = await db.query(`
      SELECT id, name FROM market_suppliers
      WHERE id = $1 AND company_id = $2
    `, [supplierId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Soft delete - just deactivate
    await db.query(`
      UPDATE market_suppliers
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [supplierId])

    console.log('[Market Suppliers] Deactivated supplier:', supplierId, existsResult.rows[0].name)

    return NextResponse.json({
      success: true,
      message: 'Proveedor desactivado exitosamente'
    })

  } catch (error) {
    console.error('[Market Suppliers API] Error deleting supplier:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desactivar proveedor'
    }, { status: 500 })
  }
}
