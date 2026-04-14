import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function GET(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    // Fetch active campaigns for this company
    const campaignsResult = await db.query(`
      SELECT
        id,
        name,
        description,
        type,
        status,
        target_products AS "targetProducts",
        target_channels AS "targetChannels",
        discount_type AS "discountType",
        discount_value AS "discountValue",
        start_date AS "startDate",
        end_date AS "endDate",
        scripts,
        schedule,
        metrics,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM mkt_campaigns
      WHERE company_id = $1
        AND status IN ('approved', 'in_progress', 'publishing')
      ORDER BY updated_at DESC
    `, [auth.companyId])

    const campaigns = campaignsResult.rows

    // Fetch tasks for all active campaigns
    if (campaigns.length > 0) {
      const campaignIds = campaigns.map((c: any) => c.id)
      const tasksResult = await db.query(`
        SELECT
          id,
          campaign_id AS "campaignId",
          title,
          description,
          type,
          status,
          assigned_to AS "assignedTo",
          created_at AS "createdAt"
        FROM mkt_campaign_tasks
        WHERE campaign_id = ANY($1::int[])
        ORDER BY created_at ASC
      `, [campaignIds])

      // Group tasks by campaign
      const tasksByC: Record<number, any[]> = {}
      for (const task of tasksResult.rows) {
        if (!tasksByC[task.campaignId]) tasksByC[task.campaignId] = []
        tasksByC[task.campaignId].push(task)
      }

      for (const campaign of campaigns) {
        // Parse JSON fields
        if (typeof campaign.targetProducts === 'string') campaign.targetProducts = JSON.parse(campaign.targetProducts)
        if (typeof campaign.targetChannels === 'string') campaign.targetChannels = JSON.parse(campaign.targetChannels)
        if (typeof campaign.scripts === 'string') campaign.scripts = JSON.parse(campaign.scripts)
        if (typeof campaign.schedule === 'string') campaign.schedule = JSON.parse(campaign.schedule)
        campaign.tasks = tasksByC[campaign.id] || []
      }
    }

    return NextResponse.json({
      success: true,
      data: { campaigns }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Active campaigns error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener campañas activas' }, { status: 500 })
  }
}
