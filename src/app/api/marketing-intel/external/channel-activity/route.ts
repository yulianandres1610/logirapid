import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/channel-activity
 * OpenClaw reports scraping/publishing activity on a channel.
 * Body: { channelId, agentId, activityType: 'scrape'|'publish'|'monitor', postsFound?, notes? }
 * Updates last_scraped_at and posts_count on mi_channels.
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure activity log table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_channel_activity (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        activity_type VARCHAR(30) NOT NULL DEFAULT 'scrape',
        posts_found INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_ch_activity_company ON mi_channel_activity(company_id, channel_id)')
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_ch_activity_created ON mi_channel_activity(created_at)')
    } catch { /* ignore */ }

    const body = await request.json()
    const { channelId, agentId, activityType, postsFound, notes } = body

    if (!channelId || !agentId) {
      return NextResponse.json({ success: false, error: 'channelId y agentId requeridos' }, { status: 400 })
    }

    const validTypes = ['scrape', 'publish', 'monitor']
    const type = validTypes.includes(activityType) ? activityType : 'scrape'

    // Log the activity
    await db.query(`
      INSERT INTO mi_channel_activity (company_id, channel_id, agent_id, activity_type, posts_found, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [auth.companyId, channelId, agentId, type, postsFound || 0, notes || null])

    // Update channel stats
    const updateParts: string[] = ['last_scraped_at = NOW()', 'updated_at = NOW()']
    const updateParams: any[] = []
    let idx = 1

    if (postsFound && postsFound > 0) {
      updateParts.push(`posts_count = COALESCE(posts_count, 0) + $${idx++}`)
      updateParams.push(postsFound)
    }

    await db.query(`
      UPDATE mi_channels SET ${updateParts.join(', ')}
      WHERE id = $${idx++} AND company_id = $${idx}
    `, [...updateParams, channelId, auth.companyId])

    return NextResponse.json({
      success: true,
      message: 'Actividad registrada'
    })
  } catch (error) {
    console.error('[MI External Channel Activity] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar actividad' }, { status: 500 })
  }
}
