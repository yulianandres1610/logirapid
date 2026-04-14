import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()
    const {
      name, description, type,
      targetProducts, targetChannels,
      discountType, discountValue,
      startDate, endDate,
      scripts, tasks, schedule
    } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'name y type son requeridos' }, { status: 400 })
    }

    const campaignResult = await db.query(`
      INSERT INTO mkt_campaigns (
        company_id, suggested_by, name, description, type, status,
        target_products, target_channels, discount_type, discount_value,
        start_date, end_date, scripts, schedule
      ) VALUES ($1, $2, $3, $4, $5, 'pending_approval', $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      auth.companyId, auth.agentId, name, description || null, type,
      JSON.stringify(targetProducts || []), JSON.stringify(targetChannels || []),
      discountType || null, discountValue || null,
      startDate || null, endDate || null,
      JSON.stringify(scripts || {}), JSON.stringify(schedule || {})
    ])

    const campaignId = campaignResult.rows[0].id

    // Insert tasks if provided
    let tasksInserted = 0
    if (Array.isArray(tasks) && tasks.length > 0) {
      const values: any[] = []
      const placeholders: string[] = []
      let idx = 1

      for (const task of tasks) {
        if (!task.title) continue
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 'pending', ${tasksInserted})`)
        values.push(campaignId, task.title, task.description || null, task.type || 'manual')
        idx += 4
        tasksInserted++
      }

      if (placeholders.length > 0) {
        await db.query(`
          INSERT INTO mkt_campaign_tasks (campaign_id, title, description, type, status, sort_order)
          VALUES ${placeholders.join(', ')}
        `, values)
      }
    }

    // Log event
    db.query(`
      INSERT INTO mkt_agent_activity (company_id, agent_id, type, status, action, target, metadata, created_at)
      VALUES ($1, $2, 'campaign_suggested', 'success', 'suggest', $3, $4, NOW())
    `, [
      auth.companyId,
      auth.agentId,
      name,
      JSON.stringify({ campaignId, type, tasksCount: tasksInserted })
    ]).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        status: 'pending_approval',
        tasksInserted
      }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Suggest campaign error:', error)
    return NextResponse.json({ success: false, error: 'Error al sugerir campaña' }, { status: 500 })
  }
}
