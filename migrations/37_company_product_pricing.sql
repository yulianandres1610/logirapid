-- Migration 37: Company Product Pricing System
-- Creates tables for company-specific product pricing and history

-- ============================================================================
-- Table: company_product_pricing
-- Company-specific pricing for products (matrix companies and branches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_product_pricing (
  id SERIAL PRIMARY KEY,

  -- References
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,

  -- Pricing
  cost_price DECIMAL(15,2) NOT NULL,              -- What this company pays (platform_price or parent's sell_price)
  sell_price DECIMAL(15,2) NOT NULL,              -- What this company charges customers

  -- For branches: markup over parent company price
  markup_type VARCHAR(20),                         -- "percentage" or "fixed"
  markup_value DECIMAL(15,2) DEFAULT 0,            -- % or fixed amount

  -- Calculated margins (updated on insert/update)
  margin DECIMAL(15,2) DEFAULT 0,                  -- sell_price - cost_price
  margin_percentage DECIMAL(5,2) DEFAULT 0,        -- ((sell_price - cost_price) / cost_price) * 100

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT unique_company_product UNIQUE (company_id, product_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_company ON company_product_pricing(company_id);
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_product ON company_product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_active ON company_product_pricing(is_active) WHERE is_active = true;

-- Function to update margin on insert/update
CREATE OR REPLACE FUNCTION update_product_pricing_margin()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate margin
  NEW.margin := NEW.sell_price - NEW.cost_price;

  -- Calculate margin percentage (avoid division by zero)
  IF NEW.cost_price > 0 THEN
    NEW.margin_percentage := ROUND(((NEW.sell_price - NEW.cost_price) / NEW.cost_price * 100)::numeric, 2);
  ELSE
    NEW.margin_percentage := 0;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_product_pricing_margin ON company_product_pricing;
CREATE TRIGGER trg_update_product_pricing_margin
  BEFORE INSERT OR UPDATE ON company_product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_product_pricing_margin();

-- Comments
COMMENT ON TABLE company_product_pricing IS 'Per-company pricing for products. Branches inherit from parent and can add markup.';
COMMENT ON COLUMN company_product_pricing.cost_price IS 'What this company pays. For matrix: platform_price. For branch: parent sell_price.';
COMMENT ON COLUMN company_product_pricing.sell_price IS 'What this company charges customers. Must be >= cost_price.';
COMMENT ON COLUMN company_product_pricing.markup_type IS 'For branches: percentage or fixed amount markup over parent price.';
COMMENT ON COLUMN company_product_pricing.markup_value IS 'The markup value (% or $) added to cost_price for branches.';

-- ============================================================================
-- Table: product_pricing_history
-- Audit trail for all product pricing changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_pricing_history (
  id SERIAL PRIMARY KEY,

  -- References
  product_id INTEGER REFERENCES product_catalog(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,

  -- Type of change
  change_type VARCHAR(20) NOT NULL,                -- "create", "update", "delete"
  change_level VARCHAR(20) NOT NULL,               -- "platform", "company", "branch"

  -- Previous values
  old_provider_cost DECIMAL(15,2),
  old_platform_price DECIMAL(15,2),
  old_cost_price DECIMAL(15,2),
  old_sell_price DECIMAL(15,2),
  old_markup_type VARCHAR(20),
  old_markup_value DECIMAL(15,2),

  -- New values
  new_provider_cost DECIMAL(15,2),
  new_platform_price DECIMAL(15,2),
  new_cost_price DECIMAL(15,2),
  new_sell_price DECIMAL(15,2),
  new_markup_type VARCHAR(20),
  new_markup_value DECIMAL(15,2),

  -- Audit info
  changed_by_user_id INTEGER,
  changed_by_user_name VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_product_pricing_history_product ON product_pricing_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_history_company ON product_pricing_history(company_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_history_date ON product_pricing_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_pricing_history_type ON product_pricing_history(change_type);

-- Comments
COMMENT ON TABLE product_pricing_history IS 'Audit trail for all product pricing changes at platform and company levels.';

-- ============================================================================
-- Function to log pricing changes automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION log_product_pricing_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      new_cost_price, new_sell_price, new_markup_type, new_markup_value
    ) VALUES (
      NEW.product_id, NEW.company_id, 'create',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = NEW.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      NEW.cost_price, NEW.sell_price, NEW.markup_type, NEW.markup_value
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      old_cost_price, old_sell_price, old_markup_type, old_markup_value,
      new_cost_price, new_sell_price, new_markup_type, new_markup_value
    ) VALUES (
      NEW.product_id, NEW.company_id, 'update',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = NEW.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      OLD.cost_price, OLD.sell_price, OLD.markup_type, OLD.markup_value,
      NEW.cost_price, NEW.sell_price, NEW.markup_type, NEW.markup_value
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      old_cost_price, old_sell_price, old_markup_type, old_markup_value
    ) VALUES (
      OLD.product_id, OLD.company_id, 'delete',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = OLD.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      OLD.cost_price, OLD.sell_price, OLD.markup_type, OLD.markup_value
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic history logging
DROP TRIGGER IF EXISTS trg_log_product_pricing_change ON company_product_pricing;
CREATE TRIGGER trg_log_product_pricing_change
  AFTER INSERT OR UPDATE OR DELETE ON company_product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION log_product_pricing_change();
