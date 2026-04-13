import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS mkt_agents (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL, type VARCHAR(30) NOT NULL,
      token_hash VARCHAR(128) NOT NULL, token_prefix VARCHAR(12) NOT NULL,
      description TEXT, channels JSONB DEFAULT '[]', capabilities JSONB DEFAULT '[]',
      config JSONB DEFAULT '{}', status VARCHAR(20) DEFAULT 'active',
      is_online BOOLEAN DEFAULT false, last_heartbeat_at TIMESTAMP,
      stats JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(company_id, agent_id)
    )`)

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_price_findings (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
      product_id INTEGER, search_term VARCHAR(255) NOT NULL, found_name VARCHAR(255),
      found_price DECIMAL(12,4), currency VARCHAR(10) DEFAULT 'USD',
      source_platform VARCHAR(30), source_name VARCHAR(255), source_url TEXT,
      match_confidence DECIMAL(3,2), match_type VARCHAR(20),
      our_price DECIMAL(12,4), price_diff DECIMAL(12,4), price_diff_pct DECIMAL(8,2),
      metadata JSONB DEFAULT '{}', captured_at TIMESTAMP DEFAULT NOW()
    )`)
    try { await db.query('CREATE INDEX IF NOT EXISTS idx_mkt_findings_company ON mkt_price_findings(company_id, captured_at DESC)') } catch {}

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_campaigns (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, name VARCHAR(255) NOT NULL,
      description TEXT, type VARCHAR(30) NOT NULL, status VARCHAR(20) DEFAULT 'draft',
      suggested_by VARCHAR(100), approved_by INTEGER, approved_at TIMESTAMP,
      target_products JSONB DEFAULT '[]', target_channels JSONB DEFAULT '[]',
      discount_type VARCHAR(20), discount_value DECIMAL(10,2),
      start_date TIMESTAMP, end_date TIMESTAMP,
      scripts JSONB DEFAULT '{}', schedule JSONB DEFAULT '{}', metrics JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`)

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_campaign_tasks (
      id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL, title VARCHAR(255) NOT NULL,
      description TEXT, type VARCHAR(30) DEFAULT 'manual', assigned_to VARCHAR(100) DEFAULT 'team',
      status VARCHAR(20) DEFAULT 'pending', sort_order INTEGER DEFAULT 0,
      file_url TEXT, file_type VARCHAR(30), completed_by INTEGER, completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`)

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_agent_activity (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
      type VARCHAR(30) NOT NULL, status VARCHAR(30), action TEXT, target VARCHAR(500),
      progress INTEGER DEFAULT 0, items_processed INTEGER DEFAULT 0, items_found INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW()
    )`)
    try { await db.query('CREATE INDEX IF NOT EXISTS idx_mkt_activity_company ON mkt_agent_activity(company_id, created_at DESC)') } catch {}

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_channels (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, platform VARCHAR(30) NOT NULL,
      name VARCHAR(255) NOT NULL, identifier VARCHAR(500), purpose VARCHAR(20) DEFAULT 'research',
      assigned_agent_id VARCHAR(100), member_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active', last_activity_at TIMESTAMP,
      metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW()
    )`)

    await db.query(`CREATE TABLE IF NOT EXISTS mkt_sales (
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
      customer_phone VARCHAR(50), customer_name VARCHAR(255), channel VARCHAR(30),
      total_amount DECIMAL(12,4) NOT NULL, currency VARCHAR(10) DEFAULT 'USD',
      items JSONB DEFAULT '[]', campaign_id INTEGER, order_number VARCHAR(50),
      status VARCHAR(20) DEFAULT 'completed', sale_at TIMESTAMP DEFAULT NOW()
    )`)
    try { await db.query('CREATE INDEX IF NOT EXISTS idx_mkt_sales_company ON mkt_sales(company_id, sale_at DESC)') } catch {}

    return NextResponse.json({
      success: true,
      message: 'Marketing tables created',
      tables: ['mkt_agents', 'mkt_price_findings', 'mkt_campaigns', 'mkt_campaign_tasks', 'mkt_agent_activity', 'mkt_channels', 'mkt_sales']
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
