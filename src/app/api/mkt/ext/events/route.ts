import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()

    // Support single event or batch
    const events: Array<{
      type: string
      status?: string
      action?: string
      target?: string
      metadata?: Record<string, any>
    }> = Array.isArray(body.events) ? body.events : [body]

    if (events.length === 0) {
      return NextResponse.json({ success: false, error: 'Al menos un evento es requerido' }, { status: 400 })
    }

    if (events.length > 100) {
      return NextResponse.json({ success: false, error: 'Máximo 100 eventos por solicitud' }, { status: 400 })
    }

    // Build batch insert
    const values: any[] = []
    const placeholders: string[] = []
    let idx = 1

    for (const event of events) {
      if (!event.type) continue
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, NOW())`)
      values.push(
        auth.companyId,
        auth.agentId,
        event.type,
        event.status || null,
        event.action || null,
        event.target || null,
        event.metadata ? JSON.stringify(event.metadata) : null
      )
      idx += 7
    }

    if (placeholders.length === 0) {
      return NextResponse.json({ success: false, error: 'Ningún evento válido (se requiere type)' }, { status: 400 })
    }

    await db.query(`
      INSERT INTO mkt_agent_activity (company_id, agent_id, type, status, action, target, metadata, created_at)
      VALUES ${placeholders.join(', ')}
    `, values)

    // Auto-cleanup events older than 7 days (fire and forget)
    db.query(`
      DELETE FROM mkt_agent_activity
      WHERE company_id = $1 AND created_at < NOW() - INTERVAL '7 days'
    `, [auth.companyId]).catch(() => {})

    return NextResponse.json({
      success: true,
      data: { inserted: placeholders.length }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Events error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar eventos' }, { status: 500 })
  }
}
