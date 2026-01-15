import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    // Crear tabla de conversaciones de WhatsApp
    await db.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL UNIQUE,

        -- Estado de la conversacion
        current_flow VARCHAR(50) DEFAULT 'idle',
        current_step VARCHAR(50),

        -- Datos recopilados (JSON)
        collected_data JSONB DEFAULT '{}',

        -- Contexto GPT (ultimos mensajes)
        messages_history JSONB DEFAULT '[]',

        -- Metadata
        customer_id INTEGER,
        customer_name VARCHAR(255),
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Crear indices para conversaciones
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_conversations(phone_number)`)
    } catch { /* Index may exist */ }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_last_msg ON whatsapp_conversations(last_message_at)`)
    } catch { /* Index may exist */ }

    // Crear tabla de mensajes de WhatsApp
    await db.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,

        direction VARCHAR(10) NOT NULL,
        message_sid VARCHAR(100),
        content TEXT NOT NULL,
        media_url TEXT,

        -- Analisis GPT
        detected_intent VARCHAR(50),
        extracted_data JSONB,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Crear indice para mensajes
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_conv ON whatsapp_messages(conversation_id)`)
    } catch { /* Index may exist */ }

    // Agregar columnas de estado de entrega (si no existen)
    try {
      await db.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20)`)
    } catch { /* Column may exist */ }

    try {
      await db.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_code VARCHAR(20)`)
    } catch { /* Column may exist */ }

    try {
      await db.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_message TEXT`)
    } catch { /* Column may exist */ }

    try {
      await db.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP`)
    } catch { /* Column may exist */ }

    // Indice para buscar por message_sid
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_sid ON whatsapp_messages(message_sid)`)
    } catch { /* Index may exist */ }

    // Crear tabla de links de pago
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_links (
        id SERIAL PRIMARY KEY,
        link_code VARCHAR(20) UNIQUE NOT NULL,

        -- Referencia a orden
        order_type VARCHAR(20) NOT NULL,
        order_id INTEGER NOT NULL,
        order_number VARCHAR(50),

        -- Monto y estado
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'pending',

        -- Stripe
        stripe_payment_intent_id VARCHAR(100),
        stripe_client_secret VARCHAR(200),

        -- Metadata
        customer_phone VARCHAR(20),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        description TEXT,
        expires_at TIMESTAMP,
        paid_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Crear indices para payment_links
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_link_code ON payment_links(link_code)`)
    } catch { /* Index may exist */ }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_link_status ON payment_links(status)`)
    } catch { /* Index may exist */ }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_link_order ON payment_links(order_type, order_id)`)
    } catch { /* Index may exist */ }

    return NextResponse.json({
      success: true,
      message: 'Tablas de WhatsApp y Payment Links creadas correctamente',
      tables: [
        'whatsapp_conversations',
        'whatsapp_messages',
        'payment_links'
      ],
      indexes: [
        'idx_whatsapp_phone',
        'idx_whatsapp_last_msg',
        'idx_whatsapp_msg_conv',
        'idx_payment_link_code',
        'idx_payment_link_status',
        'idx_payment_link_order'
      ]
    })
  } catch (error) {
    console.error('Error creating WhatsApp tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear tablas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
