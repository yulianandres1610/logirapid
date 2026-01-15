import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    // Agregar columna conversation_status
    try {
      await db.query(`
        ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS conversation_status VARCHAR(20) DEFAULT 'active'
      `)
    } catch { /* Column may exist */ }

    // Agregar columna completed_order_id
    try {
      await db.query(`
        ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS completed_order_id INTEGER
      `)
    } catch { /* Column may exist */ }

    // Agregar columna completed_order_type
    try {
      await db.query(`
        ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS completed_order_type VARCHAR(50)
      `)
    } catch { /* Column may exist */ }

    // Agregar columna completed_at
    try {
      await db.query(`
        ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
      `)
    } catch { /* Column may exist */ }

    // Crear indice para buscar por status
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_status
        ON whatsapp_conversations(conversation_status)
      `)
    } catch { /* Index may exist */ }

    // Crear indice para buscar por customer_id
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_customer
        ON whatsapp_conversations(customer_id)
      `)
    } catch { /* Index may exist */ }

    // Actualizar conversaciones existentes sin status
    await db.query(`
      UPDATE whatsapp_conversations
      SET conversation_status = 'active'
      WHERE conversation_status IS NULL
    `)

    return NextResponse.json({
      success: true,
      message: 'Columnas de status agregadas a whatsapp_conversations',
      columns: [
        'conversation_status (active/completed/abandoned)',
        'completed_order_id',
        'completed_order_type',
        'completed_at'
      ],
      indexes: [
        'idx_whatsapp_conv_status',
        'idx_whatsapp_conv_customer'
      ]
    })
  } catch (error) {
    console.error('Error adding WhatsApp status columns:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al agregar columnas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
