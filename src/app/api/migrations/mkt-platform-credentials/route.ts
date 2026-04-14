import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mkt_platform_credentials (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        platform VARCHAR(30) NOT NULL,
        credentials JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active',
        last_verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, platform)
      )
    `)

    return NextResponse.json({
      success: true,
      message: 'mkt_platform_credentials table created'
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
