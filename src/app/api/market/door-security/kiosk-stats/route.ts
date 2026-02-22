import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/market/door-security/kiosk-stats?kioskId=X&guardId=Y
 * Returns statistics for the kiosk dashboard (guard view)
 * Uses kiosk authentication (kioskId + guardId) - no JWT required
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kioskIdParam = searchParams.get('kioskId')
    const guardIdParam = searchParams.get('guardId')

    if (!kioskIdParam || !guardIdParam) {
      return NextResponse.json({
        success: false,
        error: 'kioskId y guardId son requeridos'
      }, { status: 400 })
    }

    // Validate kiosk and guard
    const kioskResult = await db.query(
      'SELECT id, companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
      [kioskIdParam]
    )

    if (kioskResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado o inactivo'
      }, { status: 404 })
    }

    const companyId = kioskResult.rows[0].companyid

    // Validate guard
    const guardResult = await db.query(
      'SELECT id FROM market_door_guards WHERE employeeid = $1 AND isactive = true',
      [guardIdParam]
    )

    if (guardResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Guardia no autorizado'
      }, { status: 401 })
    }

    // Get today's date in company timezone
    const today = new Date().toISOString().split('T')[0]

    // 1. Visitor statistics
    let visitorsInside = 0
    let visitorsExitedToday = 0
    let totalVisitorsToday = 0
    let exitsWithoutValidation = 0

    try {
      const visitorStats = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as inside,
          COUNT(*) FILTER (WHERE status = 'completed' AND DATE(exittime AT TIME ZONE 'America/Havana') = $2) as exited_today,
          COUNT(*) as total_today,
          COUNT(*) FILTER (
            WHERE status = 'completed'
            AND haspendinginvoices = true
            AND (invoicesvalidated = false OR invoicesvalidated IS NULL)
            AND DATE(exittime AT TIME ZONE 'America/Havana') = $2
          ) as without_validation
        FROM market_visitor_logs
        WHERE companyid = $1
          AND DATE(entrytime AT TIME ZONE 'America/Havana') = $2
      `, [companyId, today])

      if (visitorStats.rows.length > 0) {
        const stats = visitorStats.rows[0]
        visitorsInside = parseInt(stats.inside || '0')
        visitorsExitedToday = parseInt(stats.exited_today || '0')
        totalVisitorsToday = parseInt(stats.total_today || '0')
        exitsWithoutValidation = parseInt(stats.without_validation || '0')
      }
    } catch (e) {
      console.log('[Kiosk Stats] Visitor stats error:', e)
    }

    // 2. POS orders created today
    let posOrdersToday = 0
    try {
      const posResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_pos_orders
        WHERE company_id = $1
          AND DATE(created_at AT TIME ZONE 'America/Havana') = $2
          AND status IN ('paid', 'completed', 'draft')
      `, [companyId, today])

      posOrdersToday = parseInt(posResult.rows[0]?.count || '0')
    } catch (e) {
      // Table might not exist, try receipts instead
      try {
        const receiptsResult = await db.query(`
          SELECT COUNT(*) as count
          FROM market_pos_receipts
          WHERE company_id = $1
            AND DATE(created_at AT TIME ZONE 'America/Havana') = $2
        `, [companyId, today])

        posOrdersToday = parseInt(receiptsResult.rows[0]?.count || '0')
      } catch {
        console.log('[Kiosk Stats] POS tables not available')
      }
    }

    // 3. Wholesale invoices created today
    let wholesaleInvoicesToday = 0
    try {
      const invoicesResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_wholesale_invoices
        WHERE companyid = $1
          AND DATE(createdat AT TIME ZONE 'America/Havana') = $2
          AND status IN ('pending', 'completed', 'paid')
      `, [companyId, today])

      wholesaleInvoicesToday = parseInt(invoicesResult.rows[0]?.count || '0')
    } catch (e) {
      console.log('[Kiosk Stats] Wholesale invoices table not available')
    }

    // 4. Validations at door today
    let validationsToday = 0
    try {
      const validationsResult = await db.query(`
        SELECT COUNT(DISTINCT documentid) as count
        FROM market_visitor_invoice_validations
        WHERE companyid = $1
          AND DATE(createdat AT TIME ZONE 'America/Havana') = $2
          AND validated = true
      `, [companyId, today])

      validationsToday = parseInt(validationsResult.rows[0]?.count || '0')
    } catch (e) {
      console.log('[Kiosk Stats] Validations table not available')
    }

    // Calculate totals
    const ordersCreatedToday = posOrdersToday + wholesaleInvoicesToday
    const ordersValidatedToday = validationsToday
    const validationRate = ordersCreatedToday > 0
      ? Math.round((ordersValidatedToday / ordersCreatedToday) * 100)
      : 100

    return NextResponse.json({
      success: true,
      data: {
        // Visitors
        visitorsInside,
        visitorsExitedToday,
        totalVisitorsToday,

        // Orders & Validation
        ordersCreatedToday,
        ordersValidatedToday,
        exitsWithoutValidation,
        validationRate,

        // Breakdown (for debugging/details)
        breakdown: {
          posOrders: posOrdersToday,
          wholesaleInvoices: wholesaleInvoicesToday
        }
      }
    })

  } catch (error) {
    console.error('[Kiosk Stats] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estadísticas'
    }, { status: 500 })
  }
}
