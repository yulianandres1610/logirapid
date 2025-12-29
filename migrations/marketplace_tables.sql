-- =============================================
-- MARKETPLACE TABLES MIGRATION
-- Run this SQL in Supabase SQL Editor
-- =============================================

-- 1. Create marketplace_listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  listing_code VARCHAR(20) UNIQUE NOT NULL,

  -- References
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id) ON DELETE RESTRICT,

  -- Pricing
  price_marketplace DECIMAL(12,2) NOT NULL,
  original_product_price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Inventory
  quantity_listed INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,

  -- Status: pending, approved, rejected, inactive, suspended, sold_out
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Featured
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,

  -- Custom marketplace info (optional)
  marketplace_title VARCHAR(255),
  marketplace_description TEXT,

  -- Approval/Rejection
  submitted_at TIMESTAMP DEFAULT NOW(),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by INTEGER REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  rejection_category VARCHAR(50),

  -- Suspension
  suspended_by INTEGER REFERENCES users(id),
  suspended_at TIMESTAMP,
  suspension_reason TEXT,

  -- Audit
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity_listed >= 0 AND quantity_sold >= 0),
  CONSTRAINT valid_price CHECK (price_marketplace > 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'inactive', 'suspended', 'sold_out')),
  UNIQUE(company_id, product_id)
);

-- Create indexes for marketplace_listings
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_company ON marketplace_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_product ON marketplace_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_warehouse ON marketplace_listings(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_code ON marketplace_listings(listing_code);
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_pending ON marketplace_listings(submitted_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mktplace_listings_approved_active ON marketplace_listings(company_id, status) WHERE status = 'approved';

-- 2. Create marketplace_listing_history table
CREATE TABLE IF NOT EXISTS marketplace_listing_history (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,

  -- Type of change
  change_type VARCHAR(30) NOT NULL,

  -- Values (JSONB for flexibility)
  old_values JSONB,
  new_values JSONB,

  -- Specific fields for common changes
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2),
  old_quantity INTEGER,
  new_quantity INTEGER,

  -- Change reason
  change_reason TEXT,

  -- Audit
  changed_by_user_id INTEGER REFERENCES users(id),
  changed_by_user_name VARCHAR(255),
  changed_by_role VARCHAR(50),
  changed_at TIMESTAMP DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mktplace_history_listing ON marketplace_listing_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_mktplace_history_date ON marketplace_listing_history(changed_at DESC);

-- 3. Create marketplace_price_alerts table
CREATE TABLE IF NOT EXISTS marketplace_price_alerts (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,

  -- Alert type
  alert_type VARCHAR(30) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',

  -- Price data
  current_price DECIMAL(12,2) NOT NULL,
  reference_price DECIMAL(12,2),
  price_difference DECIMAL(12,2),
  price_difference_percent DECIMAL(5,2),

  -- Message and details
  alert_message TEXT NOT NULL,
  alert_details JSONB DEFAULT '{}',

  -- Status: active, acknowledged, resolved, dismissed
  status VARCHAR(20) DEFAULT 'active',

  -- Resolution
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_action VARCHAR(50),
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_alert_type CHECK (alert_type IN (
    'price_below_cost', 'price_above_threshold', 'price_below_threshold',
    'price_change_significant', 'price_variance'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_mktplace_alerts_listing ON marketplace_price_alerts(listing_id);
CREATE INDEX IF NOT EXISTS idx_mktplace_alerts_status ON marketplace_price_alerts(status);
CREATE INDEX IF NOT EXISTS idx_mktplace_alerts_active ON marketplace_price_alerts(created_at DESC) WHERE status = 'active';

-- 4. Create marketplace_price_config table
CREATE TABLE IF NOT EXISTS marketplace_price_config (
  id SERIAL PRIMARY KEY,

  -- Config by category (NULL = global)
  category VARCHAR(100),

  -- Margin thresholds
  min_margin_percent DECIMAL(5,2) DEFAULT 5.00,
  max_margin_percent DECIMAL(5,2) DEFAULT 200.00,

  -- Price variation thresholds
  max_price_increase_percent DECIMAL(5,2) DEFAULT 30.00,
  max_price_decrease_percent DECIMAL(5,2) DEFAULT 50.00,

  -- Variance between markets
  max_price_variance_percent DECIMAL(5,2) DEFAULT 40.00,

  -- Auto-actions
  auto_reject_if_below_cost BOOLEAN DEFAULT true,
  auto_alert_on_threshold BOOLEAN DEFAULT true,

  -- Active
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create marketplace_listing_stats table
CREATE TABLE IF NOT EXISTS marketplace_listing_stats (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER UNIQUE NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,

  -- View metrics
  view_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,

  -- Cart metrics
  add_to_cart_count INTEGER DEFAULT 0,

  -- Order metrics
  order_count INTEGER DEFAULT 0,
  total_quantity_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,

  -- Rating (for future)
  average_rating DECIMAL(3,2),
  review_count INTEGER DEFAULT 0,

  -- Last update
  last_order_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_marketplace_listing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_listings_updated ON marketplace_listings;
CREATE TRIGGER trg_marketplace_listings_updated
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_listing_timestamp();

-- 7. Create trigger for listing_code generation
CREATE OR REPLACE FUNCTION generate_marketplace_listing_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.listing_code IS NULL OR NEW.listing_code = '' THEN
    NEW.listing_code := 'MKP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_listing_code ON marketplace_listings;
CREATE TRIGGER trg_generate_listing_code
  BEFORE INSERT ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION generate_marketplace_listing_code();

-- 8. Create trigger for history logging
CREATE OR REPLACE FUNCTION log_marketplace_listing_change()
RETURNS TRIGGER AS $$
DECLARE
  v_change_type VARCHAR(30);
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine change type
  IF OLD.status != NEW.status THEN
    v_change_type := 'status_change';
  ELSIF OLD.price_marketplace != NEW.price_marketplace THEN
    v_change_type := 'price_change';
  ELSIF OLD.quantity_listed != NEW.quantity_listed THEN
    v_change_type := 'quantity_change';
  ELSE
    v_change_type := 'info_update';
  END IF;

  -- Build old_values and new_values
  v_old_values := jsonb_build_object(
    'status', OLD.status,
    'price_marketplace', OLD.price_marketplace,
    'quantity_listed', OLD.quantity_listed,
    'is_featured', OLD.is_featured
  );

  v_new_values := jsonb_build_object(
    'status', NEW.status,
    'price_marketplace', NEW.price_marketplace,
    'quantity_listed', NEW.quantity_listed,
    'is_featured', NEW.is_featured
  );

  -- Insert into history
  INSERT INTO marketplace_listing_history (
    listing_id, change_type,
    old_values, new_values,
    old_status, new_status,
    old_price, new_price,
    old_quantity, new_quantity,
    changed_at
  ) VALUES (
    NEW.id, v_change_type,
    v_old_values, v_new_values,
    OLD.status, NEW.status,
    OLD.price_marketplace, NEW.price_marketplace,
    OLD.quantity_listed, NEW.quantity_listed,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_marketplace_listing_change ON marketplace_listings;
CREATE TRIGGER trg_log_marketplace_listing_change
  AFTER UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION log_marketplace_listing_change();

-- 9. Insert default price config
INSERT INTO marketplace_price_config (
  category,
  min_margin_percent, max_margin_percent,
  max_price_increase_percent, max_price_decrease_percent,
  max_price_variance_percent,
  auto_reject_if_below_cost, auto_alert_on_threshold,
  is_active
) VALUES (
  NULL,
  5.00, 200.00,
  30.00, 50.00,
  40.00,
  true, true,
  true
) ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Marketplace tables migration completed successfully!' as result;
