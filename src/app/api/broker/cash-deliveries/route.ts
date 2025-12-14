import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// GET - List cash deliveries for broker
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const brokerCompanyId = parseInt(companyId)

    // Verify this is a broker company
    const companyResult = await db.query(`
      SELECT id, companytype FROM companies WHERE id = $1
    `, [brokerCompanyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Empresa no encontrada' }, { status: 404 })
    }

    if (companyResult.rows[0].companytype !== 'broker') {
      return NextResponse.json({ success: false, error: 'Esta función es solo para brokers' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const includeCompleted = searchParams.get('includeCompleted') === 'true'

    let whereClause = 'WHERE cdo.broker_company_id = $1'
    const params: any[] = [brokerCompanyId]
    let paramIndex = 2

    if (status) {
      whereClause += ` AND cdo.status = $${paramIndex++}`
      params.push(status)
    } else if (!includeCompleted) {
      // By default, exclude completed and cancelled orders
      whereClause += ` AND cdo.status NOT IN ('completed', 'cancelled')`
    }

    const result = await db.query(`
      SELECT
        cdo.id,
        cdo.order_number,
        cdo.delivery_user_name,
        cdo.delivery_user_phone,
        cdo.currency,
        cdo.total_amount,
        cdo.total_bills,
        cdo.deadline_date,
        cdo.status,
        cdo.created_at,
        cdo.reception_started_at,
        cdo.otp_attempts,
        cdo.otp_sent_at
      FROM cash_delivery_orders cdo
      ${whereClause}
      ORDER BY
        CASE cdo.status
          WHEN 'validating' THEN 1
          WHEN 'pending_reception' THEN 2
          WHEN 'in_transit' THEN 3
          WHEN 'pending' THEN 4
          ELSE 5
        END,
        cdo.deadline_date ASC,
        cdo.created_at DESC
    `, params)

    // Get summary counts
    const summaryResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending', 'in_transit')) as pending_count,
        COUNT(*) FILTER (WHERE status = 'pending_reception') as receiving_count,
        COUNT(*) FILTER (WHERE status = 'validating') as validating_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count
      FROM cash_delivery_orders
      WHERE broker_company_id = $1
    `, [brokerCompanyId])

    return NextResponse.json({
      success: true,
      data: {
        deliveries: result.rows.map(row => ({
          ...row,
          total_amount: parseFloat(row.total_amount)
        })),
        summary: {
          pending: parseInt(summaryResult.rows[0].pending_count) || 0,
          receiving: parseInt(summaryResult.rows[0].receiving_count) || 0,
          validating: parseInt(summaryResult.rows[0].validating_count) || 0,
          completed: parseInt(summaryResult.rows[0].completed_count) || 0
        }
      }
    })

  } catch (error: any) {
    console.error('[Broker Cash Deliveries API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener las entregas de efectivo'
    }, { status: 500 })
  }
}
