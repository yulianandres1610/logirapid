import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()
    const { campaignId, channel, platform, status, url, notes, metadata } = body

    if (!campaignId || !channel || !status) {
      return NextResponse.json({ success: false, error: 'campaignId, channel y status son requeridos' }, { status: 400 })
    }

    if (!['published', 'failed'].includes(status)) {
      return NextResponse.json({ success: false, error: 'status debe ser "published" o "failed"' }, { status: 400 })
    }

    // Verify campaign belongs to this company
    const campaignCheck = await db.query(`
      SELECT id, metrics FROM mkt_campaigns WHERE id = $1 AND company_id = $2
    `, [campaignId, auth.companyId])

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    // Update campaign metrics
    const currentMetrics = campaignCheck.rows[0].metrics || {}
    const publications = currentMetrics.publications || []
    publications.push({
      channel,
      platform: platform || channel,
      status,
      url: url || null,
      notes: notes || null,
      metadata: metadata || null,
      publishedAt: new Date().toISOString(),
      agentId: auth.agentId,
    })

    const publishedCount = publications.filter((p: any) => p.status === 'published').length
    const failedCount = publications.filter((p: any) => p.status === 'failed').length

    const updatedMetrics = {
      ...currentMetrics,
      publications,
      publishedCount,
      failedCount,
      lastPublishedAt: status === 'published' ? new Date().toISOString() : currentMetrics.lastPublishedAt,
    }

    await db.query(`
      UPDATE mkt_campaigns
      SET metrics = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2 AND company_id = $3
    `, [JSON.stringify(updatedMetrics), campaignId, auth.companyId])

    // Log event
    db.query(`
      INSERT INTO mkt_agent_activity (company_id, agent_id, type, status, action, target, metadata, created_at)
      VALUES ($1, $2, 'publish_result', $3, 'publish', $4, $5, NOW())
    `, [
      auth.companyId,
      auth.agentId,
      status,
      channel,
      JSON.stringify({ campaignId, platform: platform || channel, url, notes })
    ]).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        channel,
        status,
        publishedCount,
        failedCount
      }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Publish result error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar resultado de publicación' }, { status: 500 })
  }
}
