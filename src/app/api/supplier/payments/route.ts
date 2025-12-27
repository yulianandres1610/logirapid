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

    const supplierId = payload.supplierId

    // Get payment requests
    const result = await db.query(`
      SELECT
        id,
        request_number,
        amount_requested,
        amount_approved,
        status,
        notes,
        admin_notes,
        created_at,
        processed_at
      FROM consignment_payment_requests
      WHERE supplier_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [supplierId])

    const requests = result.rows.map(row => ({
      id: row.id,
      requestNumber: row.request_number,
      amountRequested: parseFloat(row.amount_requested),
      amountApproved: row.amount_approved ? parseFloat(row.amount_approved) : null,
      status: row.status,
      notes: row.notes,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
      processedAt: row.processed_at
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
