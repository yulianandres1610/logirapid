-- Migration 39: B2B/B2C Pricing Model Enhancement
-- Transforms the simple sell_price model to a full B2B/B2C pyramid system
--
-- Key changes:
-- 1. Add provider_b2b_price to product_catalog (price provider charges LogiRapid)
-- 2. Add platform_min_b2c to product_catalog (minimum B2C price allowed)
-- 3. Add b2b_price and b2c_price to company_product_pricing (replaces sell_price)
-- 4. Add min_b2b_price to company_product_pricing (B2B floor from parent level)
-- 5. Add price_source and parent_company_id for tracking price inheritance

-- ============================================================================
-- Step 1: Enhance product_catalog with B2B provider pricing
-- ============================================================================

-- Add provider_b2b_price column (what provider charges LogiRapid as B2B)
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS provider_b2b_price DECIMAL(15,2) DEFAULT 0;

-- Add platform_min_b2c column (minimum B2C price companies must charge)
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS platform_min_b2c DECIMAL(15,2) DEFAULT 0;

-- Comment updates
COMMENT ON COLUMN product_catalog.provider_cost IS 'Provider real cost of production/acquisition (their internal cost)';
COMMENT ON COLUMN product_catalog.provider_b2b_price IS 'B2B price provider charges to LogiRapid';
COMMENT ON COLUMN product_catalog.platform_price IS 'Default B2B price LogiRapid charges companies (can be customized per company)';
COMMENT ON COLUMN product_catalog.platform_min_b2c IS 'Minimum B2C price companies must charge to end customers';

-- Update existing data: set provider_b2b_price equal to provider_cost + 20% if not set
UPDATE product_catalog
SET provider_b2b_price = ROUND(provider_cost * 1.2, 2),
    platform_min_b2c = ROUND(platform_price * 0.9, 2)
WHERE provider_b2b_price = 0 OR provider_b2b_price IS NULL;

-- ============================================================================
-- Step 2: Enhance company_product_pricing with B2B/B2C fields
-- ============================================================================

-- Add b2b_price column (price this company gives to its branches/children)
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS b2b_price DECIMAL(15,2);

-- Add b2c_price column (price to end customers)
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS b2c_price DECIMAL(15,2);

-- Add min_b2b_price column (B2B floor - cannot assign B2B lower than this)
-- This is the B2B price the parent company received from its parent
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS min_b2b_price DECIMAL(15,2);

-- Add price_source column (where did this pricing come from)
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS price_source VARCHAR(30) DEFAULT 'platform';

-- Add parent_company_id column (for tracking inheritance chain)
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS parent_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

-- Add margin_b2b column
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS margin_b2b DECIMAL(15,2) DEFAULT 0;

-- Add margin_b2b_percentage column
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS margin_b2b_percentage DECIMAL(5,2) DEFAULT 0;

-- Comments for new columns
COMMENT ON COLUMN company_product_pricing.b2b_price IS 'B2B price for branches/children. Must be >= min_b2b_price';
COMMENT ON COLUMN company_product_pricing.b2c_price IS 'B2C price for end customers. Must be >= cost_price';
COMMENT ON COLUMN company_product_pricing.min_b2b_price IS 'Minimum B2B price floor inherited from parent. Cannot assign B2B lower than this.';
COMMENT ON COLUMN company_product_pricing.price_source IS 'Where pricing originated: platform, parent_company, custom';
COMMENT ON COLUMN company_product_pricing.parent_company_id IS 'ID of parent company for price inheritance tracking';
COMMENT ON COLUMN company_product_pricing.margin_b2b IS 'b2b_price - cost_price (margin on B2B sales)';
COMMENT ON COLUMN company_product_pricing.margin_b2b_percentage IS 'B2B margin as percentage';

-- Migrate existing sell_price to b2c_price and b2b_price
UPDATE company_product_pricing
SET b2c_price = sell_price,
    b2b_price = sell_price
WHERE b2c_price IS NULL;

-- Set min_b2b_price from platform_price for existing records
UPDATE company_product_pricing cpp
SET min_b2b_price = pc.platform_price,
    price_source = 'platform'
FROM product_catalog pc
WHERE cpp.product_id = pc.id
AND cpp.min_b2b_price IS NULL;

-- Create index for min_b2b_price lookups
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_min_b2b ON company_product_pricing(min_b2b_price);
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_source ON company_product_pricing(price_source);
CREATE INDEX IF NOT EXISTS idx_company_product_pricing_parent ON company_product_pricing(parent_company_id);

-- ============================================================================
-- Step 3: Update the margin calculation trigger to include B2B
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_pricing_margin()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate B2C margin (sell_price - cost_price for backward compatibility)
  NEW.margin := COALESCE(NEW.b2c_price, NEW.sell_price, 0) - NEW.cost_price;

  -- Calculate B2C margin percentage
  IF NEW.cost_price > 0 THEN
    NEW.margin_percentage := ROUND(((COALESCE(NEW.b2c_price, NEW.sell_price, 0) - NEW.cost_price) / NEW.cost_price * 100)::numeric, 2);
  ELSE
    NEW.margin_percentage := 0;
  END IF;

  -- Calculate B2B margin
  IF NEW.b2b_price IS NOT NULL THEN
    NEW.margin_b2b := NEW.b2b_price - NEW.cost_price;
    IF NEW.cost_price > 0 THEN
      NEW.margin_b2b_percentage := ROUND(((NEW.b2b_price - NEW.cost_price) / NEW.cost_price * 100)::numeric, 2);
    ELSE
      NEW.margin_b2b_percentage := 0;
    END IF;
  END IF;

  -- Keep sell_price in sync with b2c_price for backward compatibility
  IF NEW.b2c_price IS NOT NULL AND (NEW.sell_price IS NULL OR NEW.sell_price != NEW.b2c_price) THEN
    NEW.sell_price := NEW.b2c_price;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: Add constraint to enforce B2B floor rule
-- ============================================================================

-- Add check constraint: b2b_price must be >= min_b2b_price (if both are set)
-- This enforces the CRITICAL RULE: No company can give B2B lower than what they received
ALTER TABLE company_product_pricing DROP CONSTRAINT IF EXISTS chk_b2b_price_floor;
ALTER TABLE company_product_pricing ADD CONSTRAINT chk_b2b_price_floor
  CHECK (b2b_price IS NULL OR min_b2b_price IS NULL OR b2b_price >= min_b2b_price);

-- Add check constraint: b2c_price must be >= cost_price
ALTER TABLE company_product_pricing DROP CONSTRAINT IF EXISTS chk_b2c_price_floor;
ALTER TABLE company_product_pricing ADD CONSTRAINT chk_b2c_price_floor
  CHECK (b2c_price IS NULL OR b2c_price >= cost_price);

-- Add check constraint: b2b_price must be >= cost_price
ALTER TABLE company_product_pricing DROP CONSTRAINT IF EXISTS chk_b2b_cost_floor;
ALTER TABLE company_product_pricing ADD CONSTRAINT chk_b2b_cost_floor
  CHECK (b2b_price IS NULL OR b2b_price >= cost_price);

-- ============================================================================
-- Step 5: Update history table with B2B/B2C fields
-- ============================================================================

ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS old_b2b_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS new_b2b_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS old_b2c_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS new_b2c_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS old_min_b2b_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS new_min_b2b_price DECIMAL(15,2);
ALTER TABLE product_pricing_history ADD COLUMN IF NOT EXISTS change_source VARCHAR(30);

-- Update the history logging function to include B2B/B2C
CREATE OR REPLACE FUNCTION log_product_pricing_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level, change_source,
      new_cost_price, new_sell_price, new_b2b_price, new_b2c_price,
      new_min_b2b_price, new_markup_type, new_markup_value
    ) VALUES (
      NEW.product_id, NEW.company_id, 'create',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = NEW.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      NEW.price_source,
      NEW.cost_price, NEW.sell_price, NEW.b2b_price, NEW.b2c_price,
      NEW.min_b2b_price, NEW.markup_type, NEW.markup_value
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level, change_source,
      old_cost_price, old_sell_price, old_b2b_price, old_b2c_price,
      old_min_b2b_price, old_markup_type, old_markup_value,
      new_cost_price, new_sell_price, new_b2b_price, new_b2c_price,
      new_min_b2b_price, new_markup_type, new_markup_value
    ) VALUES (
      NEW.product_id, NEW.company_id, 'update',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = NEW.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      NEW.price_source,
      OLD.cost_price, OLD.sell_price, OLD.b2b_price, OLD.b2c_price,
      OLD.min_b2b_price, OLD.markup_type, OLD.markup_value,
      NEW.cost_price, NEW.sell_price, NEW.b2b_price, NEW.b2c_price,
      NEW.min_b2b_price, NEW.markup_type, NEW.markup_value
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level, change_source,
      old_cost_price, old_sell_price, old_b2b_price, old_b2c_price,
      old_min_b2b_price, old_markup_type, old_markup_value
    ) VALUES (
      OLD.product_id, OLD.company_id, 'delete',
      CASE WHEN EXISTS(SELECT 1 FROM companies WHERE id = OLD.company_id AND parentcompanyid IS NOT NULL)
           THEN 'branch' ELSE 'company' END,
      OLD.price_source,
      OLD.cost_price, OLD.sell_price, OLD.b2b_price, OLD.b2c_price,
      OLD.min_b2b_price, OLD.markup_type, OLD.markup_value
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 6: Create helper view for pricing pyramid visibility
-- ============================================================================

CREATE OR REPLACE VIEW v_company_pricing_pyramid AS
SELECT
  cpp.id,
  cpp.company_id,
  c.legalname as company_name,
  c.is_provider,
  c.parent_company_id,
  pc.parent_legalname as parent_company_name,
  cpp.product_id,
  p.code as product_code,
  p.name as product_name,
  p.service_category,

  -- Provider level
  p.provider_cost,
  p.provider_b2b_price,

  -- Platform level
  p.platform_price,
  p.platform_min_b2c,

  -- Company level
  cpp.cost_price,
  cpp.b2b_price,
  cpp.b2c_price,
  cpp.min_b2b_price,
  cpp.margin_b2b,
  cpp.margin_b2b_percentage,
  cpp.margin as margin_b2c,
  cpp.margin_percentage as margin_b2c_percentage,

  -- Metadata
  cpp.price_source,
  cpp.parent_company_id as pricing_parent_id,
  cpp.is_active,
  cpp.created_at,
  cpp.updated_at
FROM company_product_pricing cpp
JOIN companies c ON cpp.company_id = c.id
LEFT JOIN (
  SELECT id, legalname as parent_legalname FROM companies
) pc ON c.parent_company_id = pc.id
JOIN product_catalog p ON cpp.product_id = p.id
WHERE p.is_active = true;

COMMENT ON VIEW v_company_pricing_pyramid IS 'View showing complete pricing pyramid for all companies with their B2B/B2C prices and margins';
