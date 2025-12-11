-- Migration 41: Company Product Services System
-- Creates tables for company-specific services attached to products
-- Services are add-ons that companies can create for their products (e.g., "Recogida a Domicilio", "Confección")
-- This prepares the structure for the commission system in FASE 3

-- ============================================================================
-- Table: company_product_services
-- Company-specific services attached to products
-- Each company can create their own custom services for products they sell
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_product_services (
  id SERIAL PRIMARY KEY,

  -- References
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,

  -- Service identification
  service_code VARCHAR(50),                           -- Optional unique code within company/product
  service_name VARCHAR(100) NOT NULL,                 -- "Recogida a Domicilio", "Entrega de Caja", "Confección"
  service_description TEXT,                           -- Detailed description

  -- Pricing
  cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,        -- What it costs the company to provide
  sell_price DECIMAL(15,2) NOT NULL DEFAULT 0,        -- What the company charges the customer

  -- Calculated margins (auto-updated by trigger)
  margin DECIMAL(15,2) DEFAULT 0,                     -- sell_price - cost_price
  margin_percentage DECIMAL(5,2) DEFAULT 0,           -- ((sell_price - cost_price) / cost_price) * 100

  -- Service behavior
  is_required BOOLEAN DEFAULT false,                  -- If true, always included with the product
  is_default_selected BOOLEAN DEFAULT false,          -- If true, pre-selected in UI but can be removed
  is_taxable BOOLEAN DEFAULT true,                    -- Whether tax applies to this service

  -- Commission settings (for FASE 3)
  commission_enabled BOOLEAN DEFAULT false,           -- Whether commission applies to this service
  commission_type VARCHAR(20),                        -- "percentage", "fixed", "tiered"
  commission_value DECIMAL(15,2) DEFAULT 0,           -- Commission rate or fixed amount
  max_commission DECIMAL(15,2),                       -- Maximum commission cap (optional)

  -- UI configuration
  display_order INTEGER DEFAULT 0,                    -- Order in service list
  icon_name VARCHAR(50),                              -- Icon identifier for UI
  color_code VARCHAR(20),                             -- Color for UI display

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id INTEGER,
  created_by_user_name VARCHAR(255)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cps_company ON company_product_services(company_id);
CREATE INDEX IF NOT EXISTS idx_cps_product ON company_product_services(product_id);
CREATE INDEX IF NOT EXISTS idx_cps_company_product ON company_product_services(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cps_active ON company_product_services(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cps_required ON company_product_services(is_required) WHERE is_required = true;

-- Unique constraint: same service name can't be duplicated for same company/product
CREATE UNIQUE INDEX IF NOT EXISTS idx_cps_unique_service
ON company_product_services(company_id, product_id, service_name);

-- ============================================================================
-- Function to update margin on insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION update_service_margin()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate margin
  NEW.margin := NEW.sell_price - NEW.cost_price;

  -- Calculate margin percentage (avoid division by zero)
  IF NEW.cost_price > 0 THEN
    NEW.margin_percentage := ROUND(((NEW.sell_price - NEW.cost_price) / NEW.cost_price * 100)::numeric, 2);
  ELSE
    NEW.margin_percentage := CASE WHEN NEW.sell_price > 0 THEN 100.00 ELSE 0 END;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_service_margin ON company_product_services;
CREATE TRIGGER trg_update_service_margin
  BEFORE INSERT OR UPDATE ON company_product_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_margin();

-- ============================================================================
-- Table: company_product_services_history
-- Audit trail for service changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_product_services_history (
  id SERIAL PRIMARY KEY,

  -- References
  service_id INTEGER,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES product_catalog(id) ON DELETE SET NULL,

  -- Type of change
  change_type VARCHAR(20) NOT NULL,                   -- "create", "update", "delete"

  -- Service name (for reference even if deleted)
  service_name VARCHAR(100),

  -- Previous values
  old_cost_price DECIMAL(15,2),
  old_sell_price DECIMAL(15,2),
  old_is_required BOOLEAN,
  old_is_active BOOLEAN,
  old_commission_enabled BOOLEAN,
  old_commission_value DECIMAL(15,2),

  -- New values
  new_cost_price DECIMAL(15,2),
  new_sell_price DECIMAL(15,2),
  new_is_required BOOLEAN,
  new_is_active BOOLEAN,
  new_commission_enabled BOOLEAN,
  new_commission_value DECIMAL(15,2),

  -- Audit info
  changed_by_user_id INTEGER,
  changed_by_user_name VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_cps_history_service ON company_product_services_history(service_id);
CREATE INDEX IF NOT EXISTS idx_cps_history_company ON company_product_services_history(company_id);
CREATE INDEX IF NOT EXISTS idx_cps_history_product ON company_product_services_history(product_id);
CREATE INDEX IF NOT EXISTS idx_cps_history_date ON company_product_services_history(changed_at DESC);

-- ============================================================================
-- Function to log service changes automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION log_service_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO company_product_services_history (
      service_id, company_id, product_id, change_type, service_name,
      new_cost_price, new_sell_price, new_is_required, new_is_active,
      new_commission_enabled, new_commission_value,
      changed_by_user_id, changed_by_user_name
    ) VALUES (
      NEW.id, NEW.company_id, NEW.product_id, 'create', NEW.service_name,
      NEW.cost_price, NEW.sell_price, NEW.is_required, NEW.is_active,
      NEW.commission_enabled, NEW.commission_value,
      NEW.created_by_user_id, NEW.created_by_user_name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO company_product_services_history (
      service_id, company_id, product_id, change_type, service_name,
      old_cost_price, old_sell_price, old_is_required, old_is_active,
      old_commission_enabled, old_commission_value,
      new_cost_price, new_sell_price, new_is_required, new_is_active,
      new_commission_enabled, new_commission_value
    ) VALUES (
      NEW.id, NEW.company_id, NEW.product_id, 'update', NEW.service_name,
      OLD.cost_price, OLD.sell_price, OLD.is_required, OLD.is_active,
      OLD.commission_enabled, OLD.commission_value,
      NEW.cost_price, NEW.sell_price, NEW.is_required, NEW.is_active,
      NEW.commission_enabled, NEW.commission_value
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO company_product_services_history (
      service_id, company_id, product_id, change_type, service_name,
      old_cost_price, old_sell_price, old_is_required, old_is_active,
      old_commission_enabled, old_commission_value
    ) VALUES (
      OLD.id, OLD.company_id, OLD.product_id, 'delete', OLD.service_name,
      OLD.cost_price, OLD.sell_price, OLD.is_required, OLD.is_active,
      OLD.commission_enabled, OLD.commission_value
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic history logging
DROP TRIGGER IF EXISTS trg_log_service_change ON company_product_services;
CREATE TRIGGER trg_log_service_change
  AFTER INSERT OR UPDATE OR DELETE ON company_product_services
  FOR EACH ROW
  EXECUTE FUNCTION log_service_change();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE company_product_services IS 'Company-specific services that can be attached to products. Each company creates their own services.';
COMMENT ON COLUMN company_product_services.service_name IS 'Name of the service like "Recogida a Domicilio", "Confección", "Entrega de Caja"';
COMMENT ON COLUMN company_product_services.cost_price IS 'What it costs the company to provide this service';
COMMENT ON COLUMN company_product_services.sell_price IS 'What the company charges the customer for this service';
COMMENT ON COLUMN company_product_services.is_required IS 'If true, this service is always included with the product';
COMMENT ON COLUMN company_product_services.commission_enabled IS 'Whether sales commission applies to this service (FASE 3)';
COMMENT ON COLUMN company_product_services.commission_type IS 'Commission calculation type: percentage, fixed, or tiered';
COMMENT ON COLUMN company_product_services.commission_value IS 'Commission rate (percentage) or fixed amount';
COMMENT ON COLUMN company_product_services.max_commission IS 'Optional cap on commission amount';
