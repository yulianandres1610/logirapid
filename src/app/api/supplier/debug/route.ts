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
 * GET /api/supplier/debug
 * Debug endpoint to check supplier data consistency
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

    // Get token data
    const tokenData = {
      supplierId: payload.supplierId,
      supplierCode: payload.supplierCode,
      companyId: payload.companyId
    }

    // Get consignment_suppliers data
    const consignmentResult = await db.query(`
      SELECT id, code, name, company_id, username, is_active
      FROM consignment_suppliers
      WHERE id = $1
    `, [payload.supplierId])

    const consignmentSupplier = consignmentResult.rows[0] || null

    // Get market_suppliers data by code
    let marketSupplierByCode = null
    if (consignmentSupplier?.code) {
      const marketResult = await db.query(`
        SELECT id, supplier_code, name, company_id, is_active
        FROM market_suppliers
        WHERE supplier_code = $1 AND company_id = $2
      `, [consignmentSupplier.code, payload.companyId])
      marketSupplierByCode = marketResult.rows[0] || null
    }

    // Get market_suppliers data by name
    let marketSupplierByName = null
    if (consignmentSupplier?.name) {
      const marketResult = await db.query(`
        SELECT id, supplier_code, name, company_id, is_active
        FROM market_suppliers
        WHERE LOWER(name) = LOWER($1) AND company_id = $2
      `, [consignmentSupplier.name, payload.companyId])
      marketSupplierByName = marketResult.rows[0] || null
    }

    // Get orders count
    const marketSupplierId = marketSupplierByCode?.id || marketSupplierByName?.id
    let ordersCount = 0
    let walletData = null

    if (marketSupplierId) {
      const ordersResult = await db.query(`
        SELECT COUNT(*) as count FROM consignment_orders WHERE supplier_id = $1
      `, [marketSupplierId])
      ordersCount = parseInt(ordersResult.rows[0]?.count) || 0

      const walletResult = await db.query(`
        SELECT * FROM consignment_supplier_wallets WHERE supplier_id = $1
      `, [marketSupplierId])
      walletData = walletResult.rows[0] || null
    }

    return NextResponse.json({
      success: true,
      data: {
        tokenData,
        consignmentSupplier,
        marketSupplierByCode,
        marketSupplierByName,
        marketSupplierId,
        ordersCount,
        walletData,
        issue: !marketSupplierByCode && !marketSupplierByName
          ? 'No se encontró market_suppliers con ese código o nombre'
          : marketSupplierByCode
            ? 'OK - Encontrado por código'
            : 'Encontrado por nombre (código no coincide)'
      }
    })

  } catch (error) {
    console.error('[Supplier Debug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
