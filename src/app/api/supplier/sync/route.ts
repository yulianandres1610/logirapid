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
 * POST /api/supplier/sync
 * Sync consignment_suppliers code with market_suppliers
 */
export async function POST() {
  try {
    const payload = await getSupplierPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Get consignment_suppliers data
    const consignmentResult = await db.query(`
      SELECT id, code, name, company_id
      FROM consignment_suppliers
      WHERE id = $1
    `, [payload.supplierId])

    if (consignmentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado en consignment_suppliers'
      }, { status: 404 })
    }

    const consignmentSupplier = consignmentResult.rows[0]

    // Try to find market_suppliers by name
    const marketResult = await db.query(`
      SELECT id, supplier_code, name
      FROM market_suppliers
      WHERE LOWER(name) = LOWER($1) AND company_id = $2
    `, [consignmentSupplier.name, payload.companyId])

    if (marketResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró proveedor en market_suppliers con nombre: ' + consignmentSupplier.name
      }, { status: 404 })
    }

    const marketSupplier = marketResult.rows[0]

    // Update consignment_suppliers code to match market_suppliers
    if (consignmentSupplier.code !== marketSupplier.supplier_code) {
      await db.query(`
        UPDATE consignment_suppliers
        SET code = $1
        WHERE id = $2
      `, [marketSupplier.supplier_code, consignmentSupplier.id])

      return NextResponse.json({
        success: true,
        message: 'Código sincronizado exitosamente',
        data: {
          oldCode: consignmentSupplier.code,
          newCode: marketSupplier.supplier_code,
          marketSupplierId: marketSupplier.id,
          note: 'Por favor cierra sesión y vuelve a iniciar para aplicar los cambios'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Los códigos ya están sincronizados',
      data: {
        code: consignmentSupplier.code,
        marketSupplierId: marketSupplier.id
      }
    })

  } catch (error) {
    console.error('[Supplier Sync] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
