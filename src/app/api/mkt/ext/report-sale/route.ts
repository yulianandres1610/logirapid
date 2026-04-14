import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()
    const {
      customerPhone, customerName, channel,
      totalAmount, currency, items,
      campaignId, orderNumber
    } = body

    if (!channel || totalAmount === undefined) {
      return NextResponse.json({ success: false, error: 'channel y totalAmount son requeridos' }, { status: 400 })
    }

    // Insert sale
    const saleResult = await db.query(`
      INSERT INTO mkt_sales (
        company_id, agent_id, customer_phone, customer_name,
        channel, total_amount, currency, items,
        campaign_id, order_number, sale_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `, [
      auth.companyId,
      auth.agentId,
      customerPhone || null,
      customerName || null,
      channel,
      totalAmount,
      currency || 'USD',
      items ? JSON.stringify(items) : '[]',
      campaignId || null,
      orderNumber || null
    ])

    const saleId = saleResult.rows[0].id

    // Update agent stats (increment total sales + revenue)
    db.query(`
      UPDATE mkt_agents
      SET stats = jsonb_set(
            jsonb_set(
              COALESCE(stats, '{}'::jsonb),
              '{totalSales}',
              to_jsonb(COALESCE((stats->>'totalSales')::int, 0) + 1)
            ),
            '{totalRevenue}',
            to_jsonb(COALESCE((stats->>'totalRevenue')::numeric, 0) + $2::numeric)
          ),
          updated_at = NOW()
      WHERE agent_id = $1 AND company_id = $3
    `, [auth.agentId, totalAmount, auth.companyId]).catch(() => {})

    // Log event
    db.query(`
      INSERT INTO mkt_agent_activity (company_id, agent_id, type, status, action, target, metadata, created_at)
      VALUES ($1, $2, 'sale_reported', 'success', 'report_sale', $3, $4, NOW())
    `, [
      auth.companyId,
      auth.agentId,
      channel,
      JSON.stringify({ saleId, totalAmount, currency: currency || 'USD', campaignId })
    ]).catch(() => {})

    return NextResponse.json({
      success: true,
      data: { saleId }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Report sale error:', error)
    return NextResponse.json({ success: false, error: 'Error al reportar venta' }, { status: 500 })
  }
}
