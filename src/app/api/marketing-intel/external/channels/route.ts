import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * GET /api/marketing-intel/external/channels
 * OpenClaw reads assigned channels for scraping/publishing.
 * Query param: ?agentId=X to filter by assigned agent.
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_channels (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        platform VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        identifier VARCHAR(500),
        description TEXT,
        member_count INTEGER DEFAULT 0,
        assigned_agent_id VARCHAR(100),
        channel_type VARCHAR(30) DEFAULT 'research',
        status VARCHAR(30) DEFAULT 'active',
        posts_count INTEGER DEFAULT 0,
        last_scraped_at TIMESTAMP,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const agentId = request.nextUrl.searchParams.get('agentId')

    let query = `
      SELECT id, platform, name, identifier, description, member_count,
             assigned_agent_id, channel_type, status, posts_count, last_scraped_at
      FROM mi_channels
      WHERE company_id = $1 AND status = 'active'
    `
    const params: any[] = [auth.companyId]

    if (agentId) {
      query += ` AND assigned_agent_id = $2`
      params.push(agentId)
    }

    query += ` ORDER BY platform ASC, name ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(ch => ({
        id: ch.id,
        platform: ch.platform,
        name: ch.name,
        identifier: ch.identifier,
        description: ch.description,
        memberCount: ch.member_count || 0,
        assignedAgentId: ch.assigned_agent_id,
        channelType: ch.channel_type,
        postsCount: ch.posts_count || 0,
        lastScrapedAt: ch.last_scraped_at
      }))
    })
  } catch (error) {
    console.error('[MI External Channels GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener canales' }, { status: 500 })
  }
}
