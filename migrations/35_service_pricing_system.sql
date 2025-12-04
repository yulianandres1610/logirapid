-- Migration 35: Service Pricing System
-- Creates tables for managing service pricing at platform and company levels

-- ============================================================================
-- Table: service_pricing
-- Platform-level pricing configuration for services
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_pricing (
  id SERIAL PRIMARY KEY,
  service_id VARCHAR(50) NOT NULL,              -- e.g., "paqueteria:pickup-orders", "recharge"

  -- Platform pricing
  provider_cost DECIMAL(15,2) DEFAULT 0,        -- What LogiRapid pays to the provider
  platform_price DECIMAL(15,2) DEFAULT 0,       -- What LogiRapid charges companies

  -- Provider-specific pricing (NULL = global default)
  provider_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,

  -- Pricing model
  pricing_model VARCHAR(20) DEFAULT 'fixed',    -- fixed, per_unit, percentage
  unit_type VARCHAR(50),                         -- per_package, per_lb, per_transaction, etc.

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure unique service per provider (NULL provider = global)
  CONSTRAINT unique_service_provider UNIQUE (service_id, provider_company_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_service_pricing_service_id ON service_pricing(service_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_provider ON service_pricing(provider_company_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_active ON service_pricing(is_active) WHERE is_active = true;

-- ============================================================================
-- Table: company_service_pricing
-- Company-specific pricing for services (buy and sell prices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_service_pricing (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id VARCHAR(50) NOT NULL,

  -- Pricing
  buy_price DECIMAL(15,2) DEFAULT 0,            -- What this company pays LogiRapid
  sell_price DECIMAL(15,2) DEFAULT 0,           -- What this company charges customers

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint per company and service
  CONSTRAINT unique_company_service UNIQUE (company_id, service_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_company_service_pricing_company ON company_service_pricing(company_id);
CREATE INDEX IF NOT EXISTS idx_company_service_pricing_service ON company_service_pricing(service_id);

-- ============================================================================
-- Table: service_pricing_history
-- Audit trail for all pricing changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_pricing_history (
  id SERIAL PRIMARY KEY,

  -- Reference to which pricing was changed
  service_pricing_id INTEGER REFERENCES service_pricing(id) ON DELETE SET NULL,
  company_service_pricing_id INTEGER REFERENCES company_service_pricing(id) ON DELETE SET NULL,

  -- Type of change
  change_type VARCHAR(20) NOT NULL,             -- 'create', 'update', 'delete'

  -- Service info (stored for reference even if original is deleted)
  service_id VARCHAR(50),
  company_id INTEGER,

  -- Previous values
  old_provider_cost DECIMAL(15,2),
  old_platform_price DECIMAL(15,2),
  old_buy_price DECIMAL(15,2),
  old_sell_price DECIMAL(15,2),

  -- New values
  new_provider_cost DECIMAL(15,2),
  new_platform_price DECIMAL(15,2),
  new_buy_price DECIMAL(15,2),
  new_sell_price DECIMAL(15,2),

  -- Audit info
  changed_by_user_id INTEGER,
  changed_by_user_name VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,

  -- Check constraint to ensure at least one reference exists
  CONSTRAINT check_pricing_reference CHECK (
    service_pricing_id IS NOT NULL OR company_service_pricing_id IS NOT NULL
  )
);

-- Create indexes for history queries
CREATE INDEX IF NOT EXISTS idx_pricing_history_service ON service_pricing_history(service_pricing_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_company ON service_pricing_history(company_service_pricing_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_date ON service_pricing_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_history_service_id ON service_pricing_history(service_id);

-- ============================================================================
-- Insert default platform pricing for all services
-- ============================================================================
INSERT INTO service_pricing (service_id, provider_cost, platform_price, pricing_model, is_active)
VALUES
  -- Main services
  ('wallet', 0, 0, 'percentage', true),
  ('recharge', 0, 0, 'fixed', true),
  ('remittance', 0, 0, 'fixed', true),
  ('tracker', 0, 0, 'fixed', true),
  ('exchange', 0, 0, 'percentage', true),
  ('marketplace', 0, 0, 'percentage', true),

  -- Paqueteria subservices
  ('paqueteria:pickup-orders', 0, 0, 'per_unit', true),
  ('paqueteria:office-orders', 0, 0, 'per_unit', true),
  ('paqueteria:warehouses', 0, 0, 'fixed', true),
  ('paqueteria:drivers', 0, 0, 'fixed', true),
  ('paqueteria:vehicles', 0, 0, 'fixed', true),
  ('paqueteria:routes', 0, 0, 'per_unit', true),
  ('paqueteria:package-route', 0, 0, 'per_unit', true)
ON CONFLICT (service_id, provider_company_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE service_pricing IS 'Platform-level pricing configuration. provider_company_id NULL = default global price';
COMMENT ON TABLE company_service_pricing IS 'Per-company pricing. buy_price = what company pays LogiRapid, sell_price = what company charges customers';
COMMENT ON TABLE service_pricing_history IS 'Audit trail for all pricing changes with before/after values';

COMMENT ON COLUMN service_pricing.provider_cost IS 'Cost that LogiRapid pays to the provider for this service';
COMMENT ON COLUMN service_pricing.platform_price IS 'Price that LogiRapid charges companies for this service';
COMMENT ON COLUMN company_service_pricing.buy_price IS 'Price that this company pays to LogiRapid (inherited from platform_price by default)';
COMMENT ON COLUMN company_service_pricing.sell_price IS 'Price that this company charges to end customers';
