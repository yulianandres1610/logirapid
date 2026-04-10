import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/agent-sales
 * Report a sale made by an AI sales agent.
 * Body: { agentId, agentName?, channel?, customerPhone?, customerName?, totalAmount, currency?, items?, orderNumber? }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { agentId, agentName, channel, customerPhone, customerName, totalAmount, currency, items, orderNumber } = body

    if (!agentId || !totalAmount) {
      return NextResponse.json({ success: false, error: 'agentId y totalAmount requeridos' }, { status: 400 })
    }

    // Upsert agent
    const agentExists = await db.query(
      'SELECT id FROM mi_sales_agents WHERE company_id = $1 AND agent_id = $2',
      [auth.companyId, agentId]
    )

    if (agentExists.rows.length === 0) {
      await db.query(`
        INSERT INTO mi_sales_agents (company_id, agent_id, name, channel)
        VALUES ($1, $2, $3, $4)
      `, [auth.companyId, agentId, agentName || agentId, channel || 'whatsapp'])
    }

    // Record sale
    const saleAmount = parseFloat(String(totalAmount)) || 0
    const itemsArr = Array.isArray(items) ? items : []

    const saleResult = await db.query(`
      INSERT INTO mi_agent_sales (
        company_id, agent_id, customer_phone, customer_name,
        total_amount, currency, items_count, items, channel, order_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      auth.companyId, agentId, customerPhone || null, customerName || null,
      saleAmount, currency || 'USD', itemsArr.length, JSON.stringify(itemsArr),
      channel || 'whatsapp', orderNumber || null
    ])

    // Update agent stats
    await db.query(`
      UPDATE mi_sales_agents SET
        total_sales = COALESCE(total_sales, 0) + $1,
        total_orders = COALESCE(total_orders, 0) + 1,
        avg_order_value = (COALESCE(total_sales, 0) + $1) / (COALESCE(total_orders, 0) + 1),
        updated_at = NOW()
      WHERE company_id = $2 AND agent_id = $3
    `, [saleAmount, auth.companyId, agentId])

    return NextResponse.json({
      success: true,
      data: { saleId: saleResult.rows[0].id, agentId, amount: saleAmount }
    })
  } catch (error) {
    console.error('[MI External Agent Sales] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar venta' }, { status: 500 })
  }
}
