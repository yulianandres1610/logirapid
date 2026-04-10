import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/database'

interface ApiKeyPayload {
  valid: boolean
  companyId?: number
  agentType?: string
  permissions?: string[]
  keyId?: number
  error?: string
}

/**
 * Validate an OpenClaw API key from the x-api-key header.
 * Keys are stored as SHA-256 hashes in mi_api_keys.
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyPayload> {
  const apiKey = request.headers.get('x-api-key')

  if (!apiKey) {
    return { valid: false, error: 'API key requerida (header x-api-key)' }
  }

  if (!apiKey.startsWith('ocl_')) {
    return { valid: false, error: 'Formato de API key inválido' }
  }

  const keyHash = hashApiKey(apiKey)

  try {
    const result = await db.query(`
      SELECT id, company_id, agent_type, permissions, is_active, expires_at
      FROM mi_api_keys
      WHERE key_hash = $1
    `, [keyHash])

    if (result.rows.length === 0) {
      return { valid: false, error: 'API key no válida' }
    }

    const key = result.rows[0]

    if (!key.is_active) {
      return { valid: false, error: 'API key desactivada' }
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { valid: false, error: 'API key expirada' }
    }

    // Update last_used_at
    db.query('UPDATE mi_api_keys SET last_used_at = NOW() WHERE id = $1', [key.id])
      .catch(() => {}) // fire and forget

    return {
      valid: true,
      companyId: key.company_id,
      agentType: key.agent_type,
      permissions: key.permissions || [],
      keyId: key.id
    }
  } catch (error) {
    console.error('[MI Auth] Error validating API key:', error)
    return { valid: false, error: 'Error al validar API key' }
  }
}

/**
 * Generate a new API key.
 * Returns the raw key (shown once to user) and its hash (stored in DB).
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = randomBytes(32).toString('hex')
  const rawKey = `ocl_${randomPart}`
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = rawKey.substring(0, 12)

  return { rawKey, keyHash, keyPrefix }
}

/**
 * SHA-256 hash of an API key.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
