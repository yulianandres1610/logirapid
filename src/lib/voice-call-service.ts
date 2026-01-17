import { db } from './database'
import { TwilioMediaStreamHandler } from './twilio-media-stream'
import WebSocket from 'ws'

/**
 * Voice Call Service
 * Manages voice calls and provides utilities for call handling
 */

export interface VoiceCallRecord {
  id: number
  callsid: string
  fromnumber: string
  tonumber: string
  companyid: number
  customerid: number | null
  status: string
  durationseconds: number | null
  transcript: string | null
  summary: string | null
  createdat: Date
  endedat: Date | null
  metadata: Record<string, unknown>
}

// Store active call handlers
const activeHandlers = new Map<string, TwilioMediaStreamHandler>()

/**
 * Create a new media stream handler for a call
 */
export function createMediaStreamHandler(callSid: string, twilioWs: WebSocket): TwilioMediaStreamHandler {
  // Clean up any existing handler for this call
  if (activeHandlers.has(callSid)) {
    console.log(`[VoiceCallService] Cleaning up existing handler for ${callSid}`)
    activeHandlers.delete(callSid)
  }

  const handler = new TwilioMediaStreamHandler(twilioWs)

  // Store the handler
  activeHandlers.set(callSid, handler)

  // Clean up when call ends
  handler.on('ended', () => {
    activeHandlers.delete(callSid)
    console.log(`[VoiceCallService] Handler removed for ${callSid}`)
  })

  return handler
}

/**
 * Get the handler for an active call
 */
export function getMediaStreamHandler(callSid: string): TwilioMediaStreamHandler | undefined {
  return activeHandlers.get(callSid)
}

/**
 * Get a voice call record from the database
 */
export async function getVoiceCall(callSid: string): Promise<VoiceCallRecord | null> {
  try {
    const result = await db.query(`
      SELECT *
      FROM voice_calls
      WHERE callsid = $1
    `, [callSid])

    return result.rows[0] || null
  } catch (error) {
    console.error('[VoiceCallService] Error getting voice call:', error)
    return null
  }
}

/**
 * Get voice call history for a customer
 */
export async function getCustomerCallHistory(
  customerPhone: string,
  limit: number = 10
): Promise<VoiceCallRecord[]> {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10)

    const result = await db.query(`
      SELECT *
      FROM voice_calls
      WHERE fromnumber LIKE $1
      ORDER BY createdat DESC
      LIMIT $2
    `, [`%${cleanPhone}%`, limit])

    return result.rows
  } catch (error) {
    console.error('[VoiceCallService] Error getting call history:', error)
    return []
  }
}

/**
 * Get call statistics for a company
 */
export async function getCompanyCallStats(
  companyId: number,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number
  completedCalls: number
  failedCalls: number
  averageDuration: number
  ordersCreated: number
}> {
  try {
    let query = `
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status IN ('failed', 'no-answer', 'busy')) as failed_calls,
        AVG(durationseconds) FILTER (WHERE durationseconds IS NOT NULL) as avg_duration,
        COUNT(orderid) FILTER (WHERE orderid IS NOT NULL) as orders_created
      FROM voice_calls
      WHERE companyid = $1
    `

    const params: (number | Date)[] = [companyId]

    if (startDate) {
      query += ` AND createdat >= $${params.length + 1}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND createdat <= $${params.length + 1}`
      params.push(endDate)
    }

    const result = await db.query(query, params)
    const row = result.rows[0]

    return {
      totalCalls: parseInt(row.total_calls) || 0,
      completedCalls: parseInt(row.completed_calls) || 0,
      failedCalls: parseInt(row.failed_calls) || 0,
      averageDuration: parseFloat(row.avg_duration) || 0,
      ordersCreated: parseInt(row.orders_created) || 0
    }
  } catch (error) {
    console.error('[VoiceCallService] Error getting call stats:', error)
    return {
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
      ordersCreated: 0
    }
  }
}

/**
 * Generate a call summary using the transcript
 */
export async function generateCallSummary(callSid: string): Promise<string | null> {
  try {
    const call = await getVoiceCall(callSid)
    if (!call || !call.transcript) {
      return null
    }

    // For now, return a simple summary
    // In production, you could use GPT to generate a proper summary
    const lines = call.transcript.split('\n').filter(l => l.trim())
    const userLines = lines.filter(l => l.includes('[USER]')).length
    const assistantLines = lines.filter(l => l.includes('[ASSISTANT]')).length

    const summary = `Llamada de ${call.fromnumber}. Duracion: ${call.durationseconds || 0}s. ` +
      `Turnos: ${userLines} del usuario, ${assistantLines} del asistente.`

    // Save summary to database
    await db.query(`
      UPDATE voice_calls
      SET summary = $2
      WHERE callsid = $1
    `, [callSid, summary])

    return summary
  } catch (error) {
    console.error('[VoiceCallService] Error generating summary:', error)
    return null
  }
}

/**
 * Get recent calls with pagination
 */
export async function getRecentCalls(
  companyId: number,
  page: number = 1,
  limit: number = 20
): Promise<{
  calls: VoiceCallRecord[]
  total: number
  page: number
  totalPages: number
}> {
  try {
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM voice_calls
      WHERE companyid = $1
    `, [companyId])
    const total = parseInt(countResult.rows[0].total) || 0

    // Get calls
    const result = await db.query(`
      SELECT vc.*, c.firstname, c.lastname
      FROM voice_calls vc
      LEFT JOIN customers c ON vc.customerid = c.id
      WHERE vc.companyid = $1
      ORDER BY vc.createdat DESC
      LIMIT $2 OFFSET $3
    `, [companyId, limit, offset])

    return {
      calls: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  } catch (error) {
    console.error('[VoiceCallService] Error getting recent calls:', error)
    return {
      calls: [],
      total: 0,
      page: 1,
      totalPages: 0
    }
  }
}

/**
 * Get the agent company ID from environment configuration
 */
export async function getVoiceAgentCompanyId(): Promise<number> {
  const companyName = process.env.VOICE_AGENT_COMPANY_NAME || process.env.WHATSAPP_AGENT_COMPANY_NAME

  if (!companyName) {
    console.warn('[VoiceCallService] No company name configured, using fallback')
    const fallbackResult = await db.query(`SELECT id FROM companies ORDER BY id LIMIT 1`)
    return fallbackResult.rows[0]?.id || 1
  }

  const result = await db.query(
    `SELECT id FROM companies WHERE legalname ILIKE $1 LIMIT 1`,
    [`%${companyName}%`]
  )

  if (!result.rows[0]?.id) {
    console.warn(`[VoiceCallService] Company "${companyName}" not found, using fallback`)
    const fallbackResult = await db.query(`SELECT id FROM companies ORDER BY id LIMIT 1`)
    return fallbackResult.rows[0]?.id || 1
  }

  return result.rows[0].id
}

export default {
  createMediaStreamHandler,
  getMediaStreamHandler,
  getVoiceCall,
  getCustomerCallHistory,
  getCompanyCallStats,
  generateCallSummary,
  getRecentCalls,
  getVoiceAgentCompanyId
}
