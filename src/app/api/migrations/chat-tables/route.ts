import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/chat-tables
 * Creates all tables needed for the internal chat system
 */
export async function POST() {
  try {
    // Create chat_conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        type VARCHAR(20) NOT NULL,
        name VARCHAR(100),
        description TEXT,
        avatar_url TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Chat Migration] chat_conversations table created')

    // Create chat_participants table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW(),
        last_read_at TIMESTAMP,
        is_muted BOOLEAN DEFAULT FALSE,
        UNIQUE(conversation_id, user_id)
      )
    `)
    console.log('[Chat Migration] chat_participants table created')

    // Create chat_messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT,
        message_type VARCHAR(20) DEFAULT 'text',
        file_url TEXT,
        file_name VARCHAR(255),
        file_size BIGINT,
        file_type VARCHAR(100),
        reply_to_id INTEGER REFERENCES chat_messages(id),
        is_pinned BOOLEAN DEFAULT FALSE,
        pinned_by INTEGER REFERENCES users(id),
        pinned_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        edited_at TIMESTAMP
      )
    `)
    console.log('[Chat Migration] chat_messages table created')

    // Create chat_reactions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      )
    `)
    console.log('[Chat Migration] chat_reactions table created')

    // Create chat_reminders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_reminders (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        remind_at TIMESTAMP NOT NULL,
        note TEXT,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Chat Migration] chat_reminders table created')

    // Create chat_presence table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_presence (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        company_id INTEGER NOT NULL REFERENCES companies(id),
        status VARCHAR(20) DEFAULT 'offline',
        custom_status TEXT,
        last_seen_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Chat Migration] chat_presence table created')

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
      ON chat_messages(conversation_id, created_at DESC)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_participants_user
      ON chat_participants(user_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_presence_company
      ON chat_presence(company_id, status)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_company
      ON chat_conversations(company_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
      ON chat_reactions(message_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_reminders_user
      ON chat_reminders(user_id, remind_at)
    `)

    console.log('[Chat Migration] All indexes created')

    return NextResponse.json({
      success: true,
      message: 'Chat tables created successfully',
      tables: [
        'chat_conversations',
        'chat_participants',
        'chat_messages',
        'chat_reactions',
        'chat_reminders',
        'chat_presence'
      ]
    })

  } catch (error) {
    console.error('[Chat Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error creating chat tables'
    }, { status: 500 })
  }
}
