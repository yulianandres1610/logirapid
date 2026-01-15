import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/whatsapp-sentby
 * Agrega campo sent_by a whatsapp_messages para identificar quién envía:
 * - 'customer': mensaje del cliente
 * - 'ai': mensaje de María (IA)
 * - 'agent': mensaje de agente humano desde CRM
 */
export async function POST() {
  try {
    // Agregar columna sent_by
    await db.query(`
      ALTER TABLE whatsapp_messages
      ADD COLUMN IF NOT EXISTS sent_by VARCHAR(20) DEFAULT 'ai'
    `)

    // Actualizar mensajes existentes basado en direction
    // inbound = customer, outbound = ai (por defecto, ya que fueron enviados por la IA)
    await db.query(`
      UPDATE whatsapp_messages
      SET sent_by = CASE
        WHEN direction = 'inbound' THEN 'customer'
        ELSE 'ai'
      END
      WHERE sent_by IS NULL OR sent_by = 'ai'
    `)

    // Crear índice para búsquedas rápidas
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_by
      ON whatsapp_messages(sent_by)
    `)

    return NextResponse.json({
      success: true,
      message: 'Migración completada: campo sent_by agregado a whatsapp_messages',
      changes: [
        'Campo sent_by agregado (customer | ai | agent)',
        'Mensajes existentes actualizados según direction',
        'Índice creado para sent_by'
      ]
    })
  } catch (error) {
    console.error('[Migration whatsapp-sentby] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error ejecutando migración',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
