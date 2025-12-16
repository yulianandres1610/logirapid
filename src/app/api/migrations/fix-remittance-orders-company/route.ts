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
}

/**
 * POST /api/migrations/fix-remittance-orders-company
 * Fix orders that have NULL or wrong selling_company_id
 * Associates orders with the company of the user who created them
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN can run this migration
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede ejecutar esta migración'
      }, { status: 403 })
    }

    // Find orders with NULL selling_company_id
    const ordersWithNullCompany = await db.query(`
      SELECT ro.id, ro.order_number, ro.sold_by_user_id, ro.selling_company_id
      FROM remittance_orders ro
      WHERE ro.selling_company_id IS NULL
    `)

    console.log(`[Migration] Found ${ordersWithNullCompany.rows.length} orders with NULL selling_company_id`)

    let fixed = 0
    const errors: string[] = []

    for (const order of ordersWithNullCompany.rows) {
      if (order.sold_by_user_id) {
        // Get the company for this user
        const userCompanyResult = await db.query(`
          SELECT uc.companyid
          FROM user_companies uc
          WHERE uc.userid = $1
          LIMIT 1
        `, [order.sold_by_user_id])

        if (userCompanyResult.rows.length > 0) {
          const companyId = userCompanyResult.rows[0].companyid

          await db.query(`
            UPDATE remittance_orders
            SET selling_company_id = $1
            WHERE id = $2
          `, [companyId, order.id])

          console.log(`[Migration] Fixed order ${order.order_number}: set selling_company_id = ${companyId}`)
          fixed++
        } else {
          errors.push(`Order ${order.order_number}: User ${order.sold_by_user_id} has no company`)
        }
      } else {
        errors.push(`Order ${order.order_number}: No sold_by_user_id`)
      }
    }

    // Also check the request body for a specific company to assign to all unassigned orders
    const body = await request.json().catch(() => ({}))
    if (body.assignToCompanyId) {
      const assignResult = await db.query(`
        UPDATE remittance_orders
        SET selling_company_id = $1
        WHERE selling_company_id IS NULL
        RETURNING id, order_number
      `, [body.assignToCompanyId])

      console.log(`[Migration] Assigned ${assignResult.rows.length} remaining orders to company ${body.assignToCompanyId}`)
      fixed += assignResult.rows.length
    }

    return NextResponse.json({
      success: true,
      data: {
        totalWithNullCompany: ordersWithNullCompany.rows.length,
        fixed,
        errors,
        message: `Se corrigieron ${fixed} órdenes`
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en la migración'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/fix-remittance-orders-company
 * Check status of orders without company
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

    // Get orders with issues
    const result = await db.query(`
      SELECT
        ro.id,
        ro.order_number,
        ro.selling_company_id,
        ro.sold_by_user_id,
        ro.created_at,
        u.email as created_by_email,
        uc.companyid as user_company_id,
        c.legalname as user_company_name
      FROM remittance_orders ro
      LEFT JOIN users u ON ro.sold_by_user_id = u.id
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      ORDER BY ro.created_at DESC
      LIMIT 20
    `)

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows,
        summary: {
          total: result.rows.length,
          withNullCompany: result.rows.filter(r => !r.selling_company_id).length,
          mismatchedCompany: result.rows.filter(r => r.selling_company_id && r.user_company_id && r.selling_company_id !== r.user_company_id).length
        }
      }
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar'
    }, { status: 500 })
  }
}
