import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/marketing-intel-tables
 * Creates all Marketing Intelligence module tables
 */
export async function GET() {
  try {
    // API Keys for OpenClaw agents
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_api_keys (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        key_hash VARCHAR(128) NOT NULL,
        key_prefix VARCHAR(12) NOT NULL,
        name VARCHAR(100) NOT NULL,
        agent_type VARCHAR(50) NOT NULL,
        permissions JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Competitors
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_competitors (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        location TEXT,
        website_url TEXT,
        source VARCHAR(50) DEFAULT 'manual',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Competitor prices (core intelligence data)
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_competitor_prices (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        competitor_id INTEGER REFERENCES mi_competitors(id),
        product_id INTEGER,
        product_name VARCHAR(255) NOT NULL,
        product_sku VARCHAR(100),
        competitor_price DECIMAL(12,2) NOT NULL,
        our_price DECIMAL(12,2),
        currency VARCHAR(10) DEFAULT 'USD',
        price_difference DECIMAL(12,2),
        price_diff_percent DECIMAL(8,2),
        source_url TEXT,
        confidence_score DECIMAL(3,2),
        captured_by VARCHAR(100),
        captured_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Indexes for competitor prices
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_mi_cp_company_product ON mi_competitor_prices(company_id, product_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_mi_cp_company_competitor ON mi_competitor_prices(company_id, competitor_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_mi_cp_captured_at ON mi_competitor_prices(captured_at)`)
    } catch { /* indexes may already exist */ }

    // Marketing campaigns
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaigns (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'draft',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        target_products JSONB DEFAULT '[]',
        target_categories JSONB DEFAULT '[]',
        discount_type VARCHAR(20),
        discount_value DECIMAL(10,2),
        budget DECIMAL(10,2),
        spent DECIMAL(10,2) DEFAULT 0,
        suggested_by VARCHAR(100),
        suggestion_reason TEXT,
        metrics JSONB DEFAULT '{}',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // AI Sales agents
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_sales_agents (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'active',
        total_sales DECIMAL(12,2) DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        avg_order_value DECIMAL(10,2) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mi_agents_unique ON mi_sales_agents(company_id, agent_id)`)
    } catch { /* may exist */ }

    // Agent sales log
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_agent_sales (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        conversation_id INTEGER,
        order_id INTEGER,
        order_number VARCHAR(50),
        customer_phone VARCHAR(50),
        customer_name VARCHAR(255),
        total_amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        items_count INTEGER DEFAULT 0,
        items JSONB DEFAULT '[]',
        channel VARCHAR(50),
        status VARCHAR(30) DEFAULT 'completed',
        sale_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_mi_sales_company_agent ON mi_agent_sales(company_id, agent_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_mi_sales_at ON mi_agent_sales(sale_at)`)
    } catch { /* may exist */ }

    // AI promotion suggestions
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_suggestions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        suggested_by VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        products JSONB DEFAULT '[]',
        market_data JSONB DEFAULT '{}',
        estimated_impact JSONB DEFAULT '{}',
        status VARCHAR(30) DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Channels (social media groups, WhatsApp groups, Telegram, etc.)
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_channels (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        platform VARCHAR(30) NOT NULL,
        name VARCHAR(255) NOT NULL,
        identifier VARCHAR(500),
        description TEXT,
        member_count INTEGER DEFAULT 0,
        assigned_agent_id VARCHAR(100),
        channel_type VARCHAR(20) DEFAULT 'research',
        status VARCHAR(20) DEFAULT 'active',
        last_scraped_at TIMESTAMP,
        posts_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Campaign tasks (checklist)
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_tasks (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to VARCHAR(100) DEFAULT 'team',
        status VARCHAR(20) DEFAULT 'pending',
        sort_order INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        completed_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Campaign assets (videos, images, documents)
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_assets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        type VARCHAR(30) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER,
        platform VARCHAR(30),
        notes TEXT,
        uploaded_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Add match_type to competitor prices
    try {
      await db.query("ALTER TABLE mi_competitor_prices ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'exact'")
      await db.query("ALTER TABLE mi_campaigns ADD COLUMN IF NOT EXISTS sales_scripts JSONB DEFAULT '{}'")
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: 'Marketing Intelligence tables created successfully',
      tables: ['mi_api_keys', 'mi_competitors', 'mi_competitor_prices', 'mi_campaigns', 'mi_sales_agents', 'mi_agent_sales', 'mi_suggestions', 'mi_channels', 'mi_campaign_tasks', 'mi_campaign_assets']
    })
  } catch (error) {
    console.error('[MI Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
