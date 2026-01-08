import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * POST /api/migrations/cleanup-test-data
 * Elimina datos de prueba (consignaciones y producto coronita)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const results: string[] = []

    // 1. Eliminar líneas de órdenes de consignación
    const linesResult = await db.query(`
      DELETE FROM consignment_order_lines
      WHERE order_id IN (SELECT id FROM consignment_orders WHERE company_id = $1)
    `, [payload.companyId])
    results.push(`Líneas de consignación eliminadas: ${linesResult.rowCount}`)

    // 2. Eliminar órdenes de consignación
    const ordersResult = await db.query(`
      DELETE FROM consignment_orders WHERE company_id = $1
    `, [payload.companyId])
    results.push(`Órdenes de consignación eliminadas: ${ordersResult.rowCount}`)

    // 3. Eliminar producto "coronita" (case insensitive)
    const productResult = await db.query(`
      DELETE FROM market_products
      WHERE company_id = $1 AND LOWER(name) LIKE '%coronita%'
      RETURNING id, name
    `, [payload.companyId])
    results.push(`Productos eliminados: ${productResult.rowCount}`)
    if (productResult.rows.length > 0) {
      results.push(`Productos: ${productResult.rows.map(p => p.name).join(', ')}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Datos de prueba eliminados',
      results
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al limpiar datos'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/cleanup-test-data
 * Muestra qué datos se eliminarían
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Contar consignaciones
    const consignments = await db.query(`
      SELECT COUNT(*) as count FROM consignment_orders WHERE company_id = $1
    `, [payload.companyId])

    // Buscar producto coronita
    const products = await db.query(`
      SELECT id, name, sku, barcode FROM market_products
      WHERE company_id = $1 AND LOWER(name) LIKE '%coronita%'
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      preview: {
        consignments: parseInt(consignments.rows[0].count),
        products: products.rows
      },
      message: 'Ejecute POST para eliminar estos datos'
    })

  } catch (error) {
    console.error('[Cleanup Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener preview'
    }, { status: 500 })
  }
}
