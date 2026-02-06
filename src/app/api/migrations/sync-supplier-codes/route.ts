import { NextResponse } from 'next/server'
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
 * GET /api/migrations/sync-supplier-codes
 * Check current state of supplier data sync
 */
export async function GET() {
  try {
    // Get all consignment_suppliers and their matching market_suppliers
    const result = await db.query(`
      SELECT
        cs.id as consignment_id,
        cs.code as consignment_code,
        cs.name as consignment_name,
        cs.company_id,
        cs.username,
        ms.id as market_id,
        ms.supplier_code as market_code,
        ms.name as market_name
      FROM consignment_suppliers cs
      LEFT JOIN market_suppliers ms ON (
        ms.supplier_code = cs.code AND ms.company_id = cs.company_id
      )
      ORDER BY cs.id
    `)

    // Also try to find by name for those without match
    const suppliers = await Promise.all(result.rows.map(async (row) => {
      let marketMatch = null
      let matchType = 'none'

      if (row.market_id) {
        marketMatch = { id: row.market_id, code: row.market_code, name: row.market_name }
        matchType = 'by_code'
      } else {
        // Try by name
        const nameMatch = await db.query(`
          SELECT id, supplier_code, name
          FROM market_suppliers
          WHERE LOWER(name) = LOWER($1) AND company_id = $2
        `, [row.consignment_name, row.company_id])

        if (nameMatch.rows.length > 0) {
          marketMatch = nameMatch.rows[0]
          matchType = 'by_name'
        }
      }

      return {
        consignment: {
          id: row.consignment_id,
          code: row.consignment_code,
          name: row.consignment_name,
          username: row.username
        },
        market: marketMatch,
        matchType,
        needsSync: matchType === 'by_name' || matchType === 'none'
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        total: suppliers.length,
        needsSync: suppliers.filter(s => s.needsSync).length,
        suppliers
      }
    })

  } catch (error) {
    console.error('[Sync Supplier Codes GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/sync-supplier-codes
 * Sync consignment_suppliers codes with market_suppliers
 */
export async function POST() {
  try {
    const payload = await getPayload()
    if (!payload || !['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const results: string[] = []
    let synced = 0

    // Get all consignment_suppliers that need syncing
    const consignmentResult = await db.query(`
      SELECT id, code, name, company_id, username
      FROM consignment_suppliers
    `)

    for (const cs of consignmentResult.rows) {
      // Check if code matches
      const codeMatch = await db.query(`
        SELECT id, supplier_code FROM market_suppliers
        WHERE supplier_code = $1 AND company_id = $2
      `, [cs.code, cs.company_id])

      if (codeMatch.rows.length > 0) {
        results.push(`✓ ${cs.name} (${cs.username}): código ya sincronizado`)
        continue
      }

      // Try to find by name
      const nameMatch = await db.query(`
        SELECT id, supplier_code, name FROM market_suppliers
        WHERE LOWER(name) = LOWER($1) AND company_id = $2
      `, [cs.name, cs.company_id])

      if (nameMatch.rows.length > 0) {
        const newCode = nameMatch.rows[0].supplier_code
        await db.query(`
          UPDATE consignment_suppliers SET code = $1 WHERE id = $2
        `, [newCode, cs.id])
        results.push(`✓ ${cs.name} (${cs.username}): código actualizado ${cs.code} → ${newCode}`)
        synced++
        continue
      }

      // Try partial name match
      const partialMatch = await db.query(`
        SELECT id, supplier_code, name FROM market_suppliers
        WHERE (LOWER(name) LIKE LOWER($1) OR LOWER($2) LIKE '%' || LOWER(name) || '%')
        AND company_id = $3
        LIMIT 1
      `, [`%${cs.name.split(' ')[0]}%`, cs.name, cs.company_id])

      if (partialMatch.rows.length > 0) {
        const newCode = partialMatch.rows[0].supplier_code
        await db.query(`
          UPDATE consignment_suppliers SET code = $1 WHERE id = $2
        `, [newCode, cs.id])
        results.push(`✓ ${cs.name} (${cs.username}): código actualizado por coincidencia parcial → ${newCode} (${partialMatch.rows[0].name})`)
        synced++
        continue
      }

      results.push(`✗ ${cs.name} (${cs.username}): no se encontró proveedor en market_suppliers`)
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización completada. ${synced} proveedores actualizados.`,
      results
    })

  } catch (error) {
    console.error('[Sync Supplier Codes POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
