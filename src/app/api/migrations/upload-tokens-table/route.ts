import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/migrations/upload-tokens-table
 * Create upload_tokens table for phone upload feature
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'No tiene permisos' }, { status: 403 })
    }

    const results: string[] = []

    // Create upload_tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS upload_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(128) NOT NULL UNIQUE,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        purpose VARCHAR(50) NOT NULL,
        reference_type VARCHAR(50),
        reference_id INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        file_url TEXT,
        file_name VARCHAR(255),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        uploaded_at TIMESTAMP
      )
    `)
    results.push('Table upload_tokens created')

    // Create index on token
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token)`)
      results.push('Index on token created')
    } catch { results.push('Index on token already exists') }

    // Create index on status + expires_at for cleanup
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_upload_tokens_status_expires ON upload_tokens(status, expires_at)`)
      results.push('Index on status+expires_at created')
    } catch { results.push('Index on status+expires_at already exists') }

    // Add file_size and file_type columns if they don't exist
    try {
      await db.query(`ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS file_size BIGINT`)
      results.push('Column file_size added')
    } catch { results.push('Column file_size already exists') }

    try {
      await db.query(`ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)`)
      results.push('Column file_type added')
    } catch { results.push('Column file_type already exists') }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      data: { results }
    })

  } catch (error) {
    console.error('[Migration upload-tokens-table] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en migracion'
    }, { status: 500 })
  }
}
