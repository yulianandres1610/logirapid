import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Run migrations once per process to fix missing data
let migrationRan = false
async function runValidationsMigration() {
  if (migrationRan) return
  try {
    // Add companyid column if missing
    await db.query(`ALTER TABLE market_visitor_invoice_validations ADD COLUMN IF NOT EXISTS companyid INTEGER`)
    // Add createdat column if missing
    await db.query(`ALTER TABLE market_visitor_invoice_validations ADD COLUMN IF NOT EXISTS createdat TIMESTAMP`)
    // Populate missing companyid from visitor_logs
    await db.query(`
      UPDATE market_visitor_invoice_validations v
      SET companyid = vl.companyid
      FROM market_visitor_logs vl
      WHERE v.visitorlogid = vl.id AND v.companyid IS NULL
    `)
    // Populate missing createdat from validatedat
    await db.query(`
      UPDATE market_visitor_invoice_validations
      SET createdat = validatedat
      WHERE createdat IS NULL AND validatedat IS NOT NULL
    `)
    migrationRan = true
    console.log('[Kiosk Stats] Validations migration completed')
  } catch (err) {
    console.warn('[Kiosk Stats] Migration error (non-fatal):', err)
    migrationRan = true
  }
}

/**
 * GET /api/market/door-security/kiosk-stats?kioskId=X&guardId=Y
 * Returns statistics for the kiosk dashboard (guard view)
 * Uses kiosk authentication (kioskId + guardId) - no JWT required
 */
export async function GET(request: NextRequest) {
  try {
    // Run migrations on first request
    await runValidationsMigration()
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

    // Get today's date in Cuba timezone (America/Havana)
    // Use PostgreSQL to get the correct date - NOW() converted to Cuba timezone
    const todayResult = await db.query(`SELECT (NOW() AT TIME ZONE 'America/Havana')::date as today`)
    const today = todayResult.rows[0].today.toISOString().split('T')[0]

    console.log('[Kiosk Stats] Today in Cuba timezone:', today, 'companyId:', companyId)

    // 1. Visitor statistics
    let visitorsInside = 0
    let visitorsExitedToday = 0
    let totalVisitorsToday = 0
    let exitsWithoutValidation = 0

    try {
      // Count visitors currently inside (ALL active, regardless of entry date)
      const insideResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_visitor_logs
        WHERE companyid = $1 AND status = 'active'
      `, [companyId])
      visitorsInside = parseInt(insideResult.rows[0]?.count || '0')

      // Count visitors who entered today (UTC timestamp converted to Cuba timezone)
      const enteredTodayResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_visitor_logs
        WHERE companyid = $1
          AND DATE(entrytime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
      `, [companyId, today])
      totalVisitorsToday = parseInt(enteredTodayResult.rows[0]?.count || '0')

      // Count visitors who exited today
      const exitedTodayResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_visitor_logs
        WHERE companyid = $1
          AND status = 'completed'
          AND DATE(exittime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
      `, [companyId, today])
      visitorsExitedToday = parseInt(exitedTodayResult.rows[0]?.count || '0')

      // Count exits without validation today
      const withoutValidationResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_visitor_logs
        WHERE companyid = $1
          AND status = 'completed'
          AND haspendinginvoices = true
          AND (invoicesvalidated = false OR invoicesvalidated IS NULL)
          AND DATE(exittime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
      `, [companyId, today])
      exitsWithoutValidation = parseInt(withoutValidationResult.rows[0]?.count || '0')

      console.log('[Kiosk Stats] Visitors - Inside:', visitorsInside, 'Entered today:', totalVisitorsToday, 'Exited today:', visitorsExitedToday)
    } catch (e) {
      console.log('[Kiosk Stats] Visitor stats error:', e)
    }

    // 2. POS orders created today (UTC timestamp converted to Cuba timezone)
    let posOrdersToday = 0
    try {
      const posResult = await db.query(`
        SELECT COUNT(*) as count
        FROM market_pos_orders
        WHERE company_id = $1
          AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
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
            AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
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
          AND DATE(createdat AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
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
          AND DATE(createdat AT TIME ZONE 'UTC' AT TIME ZONE 'America/Havana') = $2
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
