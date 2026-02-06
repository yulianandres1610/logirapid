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
 * GET /api/supplier/profile
 * Get supplier profile with bank accounts
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

    // Get supplier info from consignment_suppliers using code
    const supplierResult = await db.query(`
      SELECT
        id, code, name, legal_name, email, phone, address
      FROM consignment_suppliers
      WHERE code = $1 AND company_id = $2
    `, [payload.supplierCode, payload.companyId])

    // Also get market_suppliers.id for bank accounts
    const marketSupplierResult = await db.query(`
      SELECT id FROM market_suppliers
      WHERE supplier_code = $1 AND company_id = $2
    `, [payload.supplierCode, payload.companyId])

    const marketSupplierId = marketSupplierResult.rows[0]?.id

    if (supplierResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const supplier = supplierResult.rows[0]

    // Get bank accounts (uses market_suppliers.id)
    let bankAccounts: Array<{ id: number; bankName: string; accountNumber: string; accountType: string }> = []
    try {
      const bankResult = await db.query(`
        SELECT id, bank_name, account_number, account_type
        FROM consignment_supplier_bank_accounts
        WHERE supplier_id = $1
        ORDER BY id
      `, [marketSupplierId])

      bankAccounts = bankResult.rows.map(row => ({
        id: row.id,
        bankName: row.bank_name,
        accountNumber: row.account_number,
        accountType: row.account_type
      }))
    } catch {
      // Table might not exist yet
    }

    return NextResponse.json({
      success: true,
      data: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        legalName: supplier.legal_name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        bankAccounts
      }
    })

  } catch (error) {
    console.error('[Supplier Profile] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar perfil'
    }, { status: 500 })
  }
}
