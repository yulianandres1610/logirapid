import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting support tables migration...')

    // 1. Create support_conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_conversations (
        id SERIAL PRIMARY KEY,
        conversation_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

        -- Usuario
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Mensajes (array JSONB)
        messages JSONB NOT NULL DEFAULT '[]',

        -- Metadata
        last_message_at TIMESTAMP DEFAULT NOW(),
        is_resolved BOOLEAN DEFAULT false,

        -- Auditoria
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created support_conversations table')

    // Create indexes for support_conversations
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_conv_user ON support_conversations(user_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_conv_company ON support_conversations(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_conv_date ON support_conversations(last_message_at DESC)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_conv_id ON support_conversations(conversation_id)
    `)
    console.log('[Migration] Created indexes for support_conversations')

    // 2. Create support_tickets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_code VARCHAR(20) UNIQUE NOT NULL,

        -- Usuario que reporta
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES support_conversations(conversation_id),

        -- Contenido
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        screenshots TEXT[] DEFAULT '{}',

        -- Estado: open, in_progress, resolved, closed
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',

        -- Asignacion
        assigned_to INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP,

        -- Resolucion
        resolution TEXT,
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,

        -- Auditoria
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Constraints
        CONSTRAINT valid_ticket_status CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        CONSTRAINT valid_ticket_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
      )
    `)
    console.log('[Migration] Created support_tickets table')

    // Create indexes for support_tickets
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_company ON support_tickets(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_code ON support_tickets(ticket_code)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_open
      ON support_tickets(created_at DESC)
      WHERE status IN ('open', 'in_progress')
    `)
    console.log('[Migration] Created indexes for support_tickets')

    // 3. Create trigger for updated_at on support_conversations
    await db.query(`
      CREATE OR REPLACE FUNCTION update_support_conversation_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    await db.query(`
      DROP TRIGGER IF EXISTS trg_support_conversations_updated ON support_conversations
    `)
    await db.query(`
      CREATE TRIGGER trg_support_conversations_updated
        BEFORE UPDATE ON support_conversations
        FOR EACH ROW
        EXECUTE FUNCTION update_support_conversation_timestamp()
    `)
    console.log('[Migration] Created trigger for support_conversations updated_at')

    // 4. Create trigger for updated_at on support_tickets
    await db.query(`
      CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    await db.query(`
      DROP TRIGGER IF EXISTS trg_support_tickets_updated ON support_tickets
    `)
    await db.query(`
      CREATE TRIGGER trg_support_tickets_updated
        BEFORE UPDATE ON support_tickets
        FOR EACH ROW
        EXECUTE FUNCTION update_support_ticket_timestamp()
    `)
    console.log('[Migration] Created trigger for support_tickets updated_at')

    // 5. Create trigger for ticket_code generation
    await db.query(`
      CREATE OR REPLACE FUNCTION generate_support_ticket_code()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
          NEW.ticket_code := 'SUP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    await db.query(`
      DROP TRIGGER IF EXISTS trg_generate_ticket_code ON support_tickets
    `)
    await db.query(`
      CREATE TRIGGER trg_generate_ticket_code
        BEFORE INSERT ON support_tickets
        FOR EACH ROW
        EXECUTE FUNCTION generate_support_ticket_code()
    `)
    console.log('[Migration] Created trigger for ticket_code generation')

    console.log('[Migration] Support tables migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Support tables migration completed successfully',
      tables: [
        'support_conversations',
        'support_tickets'
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
        'support_conversations',
        'support_tickets'
      )
    `)

    const existingTables = tablesCheck.rows.map(r => r.table_name)
    const allTables = [
      'support_conversations',
      'support_tickets'
    ]

    const missingTables = allTables.filter(t => !existingTables.includes(t))

    // Get counts if tables exist
    let stats: Record<string, unknown> = {}
    if (existingTables.includes('support_tickets')) {
      const ticketsCount = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'closed') as closed
        FROM support_tickets
      `)
      stats.tickets = ticketsCount.rows[0]
    }

    if (existingTables.includes('support_conversations')) {
      const convsCount = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
          COUNT(*) FILTER (WHERE is_resolved = false) as active
        FROM support_conversations
      `)
      stats.conversations = convsCount.rows[0]
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
