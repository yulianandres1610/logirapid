import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface SupplierJWTPayload {
  supplierId: number
  supplierCode: string
  companyId: number
  type: string
}

async function getSupplierPayload(): Promise<SupplierJWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('supplier-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const payload = jwt.verify(token, secret) as SupplierJWTPayload
    if (payload.type !== 'supplier') return null
    return payload
  } catch {
    return null
  }
}

/**
 * GET /api/supplier/payments
 * List payment requests for the supplier
 */
export async function GET() {
  try {
    const payload = await getSupplierPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // First get supplier info from consignment_suppliers
    const consignmentResult = await db.query(`
      SELECT id, code, name FROM consignment_suppliers WHERE id = $1
    `, [payload.supplierId])

    if (consignmentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const consignmentSupplier = consignmentResult.rows[0]

    // Get market_suppliers.id - try by code first, then by name
    let marketSupplierResult = await db.query(`
      SELECT id FROM market_suppliers
      WHERE supplier_code = $1 AND company_id = $2
    `, [consignmentSupplier.code, payload.companyId])

    if (marketSupplierResult.rows.length === 0) {
      marketSupplierResult = await db.query(`
        SELECT id FROM market_suppliers
        WHERE LOWER(name) = LOWER($1) AND company_id = $2
      `, [consignmentSupplier.name, payload.companyId])
    }

    const supplierId = marketSupplierResult.rows[0]?.id

    // Return empty list if no market supplier found (instead of 404)
    if (!supplierId) {
      return NextResponse.json({
        success: true,
        data: { requests: [] }
      })
    }

    // Get payment requests
    const result = await db.query(`
      SELECT
        id,
        request_number,
        amount_requested,
        amount_approved,
        amount_paid,
        status,
        notes,
        admin_notes,
        requested_at,
        approved_at,
        paid_at
      FROM consignment_payment_requests
      WHERE supplier_id = $1
      ORDER BY requested_at DESC
      LIMIT 50
    `, [supplierId])

    const requests = result.rows.map(row => ({
      id: row.id,
      requestNumber: row.request_number,
      amountRequested: parseFloat(row.amount_requested) || 0,
      amountApproved: row.amount_approved ? parseFloat(row.amount_approved) : null,
      amountPaid: row.amount_paid ? parseFloat(row.amount_paid) : 0,
      status: row.status,
      notes: row.notes,
      adminNotes: row.admin_notes,
      createdAt: row.requested_at,
      approvedAt: row.approved_at,
      paidAt: row.paid_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        requests
      }
    })

  } catch (error) {
    console.error('[Supplier Payments] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar pagos'
    }, { status: 500 })
  }
}
