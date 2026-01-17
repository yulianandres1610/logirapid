import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting voice_calls table migration...')

    // 1. Create voice_calls table
    await db.query(`
      CREATE TABLE IF NOT EXISTS voice_calls (
        id SERIAL PRIMARY KEY,
        callsid VARCHAR(100) UNIQUE NOT NULL,

        -- Informacion de la llamada
        fromnumber VARCHAR(50) NOT NULL,
        tonumber VARCHAR(50) NOT NULL,
        direction VARCHAR(20) DEFAULT 'inbound',

        -- Asociaciones
        companyid INTEGER REFERENCES companies(id),
        customerid INTEGER REFERENCES customers(id),

        -- Estado: initiated, ringing, in-progress, completed, busy, failed, no-answer
        status VARCHAR(50) DEFAULT 'initiated',
        durationseconds INTEGER,

        -- Contenido de la conversacion
        transcript TEXT,
        summary TEXT,
        intent VARCHAR(100),

        -- Orden creada (si aplica)
        orderid INTEGER REFERENCES package_orders(id),

        -- Auditoria
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        endedat TIMESTAMP,

        -- Metadata adicional (JSON)
        metadata JSONB DEFAULT '{}'
      )
    `)
    console.log('[Migration] Created voice_calls table')

    // 2. Create indexes for voice_calls
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_callsid ON voice_calls(callsid)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_fromnumber ON voice_calls(fromnumber)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_companyid ON voice_calls(companyid)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_customerid ON voice_calls(customerid)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_calls_createdat ON voice_calls(createdat DESC)
    `)
    console.log('[Migration] Created indexes for voice_calls')

    // 3. Create voice_call_events table for detailed call tracking
    await db.query(`
      CREATE TABLE IF NOT EXISTS voice_call_events (
        id SERIAL PRIMARY KEY,
        callid INTEGER NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,

        -- Tipo de evento: start, audio_in, audio_out, function_call, transcript, end
        eventtype VARCHAR(50) NOT NULL,

        -- Datos del evento
        eventdata JSONB DEFAULT '{}',

        -- Timestamp
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('[Migration] Created voice_call_events table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_call_events_callid ON voice_call_events(callid)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_call_events_type ON voice_call_events(eventtype)
    `)
    console.log('[Migration] Created indexes for voice_call_events')

    console.log('[Migration] Voice calls migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Voice calls migration completed successfully',
      tables: [
        'voice_calls',
        'voice_call_events'
      ]
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check if tables exist
    const tablesCheck = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'voice_calls',
        'voice_call_events'
      )
    `)

    const existingTables = tablesCheck.rows.map(r => r.table_name)
    const allTables = [
      'voice_calls',
      'voice_call_events'
    ]

    const missingTables = allTables.filter(t => !existingTables.includes(t))

    // Get counts if tables exist
    let stats: Record<string, unknown> = {}
    if (existingTables.includes('voice_calls')) {
      const callsCount = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(durationseconds) FILTER (WHERE durationseconds IS NOT NULL) as avg_duration
        FROM voice_calls
      `)
      stats.calls = callsCount.rows[0]
    }

    return NextResponse.json({
      success: true,
      migrated: missingTables.length === 0,
      existingTables,
      missingTables,
      stats
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
