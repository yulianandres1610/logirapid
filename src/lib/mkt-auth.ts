import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/database'

interface AgentAuthResult {
  valid: boolean
  companyId?: number
  agentId?: string
  agentType?: string
  agentName?: string
  error?: string
}

/**
 * Validate an agent token from the x-agent-token header.
 * Tokens are stored as SHA-256 hashes in mkt_agents.
 */
export async function validateAgentToken(request: NextRequest): Promise<AgentAuthResult> {
  const token = request.headers.get('x-agent-token')
  if (!token) return { valid: false, error: 'Token requerido (header x-agent-token)' }
  if (!token.startsWith('mkt_')) return { valid: false, error: 'Formato de token inválido' }

  const hash = hashToken(token)

  try {
    const result = await db.query(`
      SELECT id, company_id, agent_id, name, type, status
      FROM mkt_agents WHERE token_hash = $1
    `, [hash])

    if (result.rows.length === 0) return { valid: false, error: 'Token no válido' }

    const agent = result.rows[0]
    if (agent.status !== 'active') return { valid: false, error: 'Agente desactivado' }

    // Update heartbeat + online status
    db.query('UPDATE mkt_agents SET is_online = true, last_heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1', [agent.id]).catch(() => {})

    return {
      valid: true,
      companyId: agent.company_id,
      agentId: agent.agent_id,
      agentType: agent.type,
      agentName: agent.name
    }
  } catch (error) {
    console.error('[MKT Auth] Error:', error)
    return { valid: false, error: 'Error al validar token' }
  }
}

/**
 * Generate a new agent token.
 * Returns raw token (shown once) and hash (stored in DB).
 */
export function generateAgentToken(): { rawToken: string; tokenHash: string; tokenPrefix: string } {
  const raw = `mkt_${randomBytes(32).toString('hex')}`
  return { rawToken: raw, tokenHash: hashToken(raw), tokenPrefix: raw.substring(0, 12) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
