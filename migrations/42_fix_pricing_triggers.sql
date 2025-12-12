-- Migration 42: Fix Pricing Triggers
-- Updates trigger functions to use new column names after migration 40

-- ============================================================================
-- Fix update_product_pricing_margin trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_product_pricing_margin()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate margin using new column names
  NEW.margen_clientes := COALESCE(NEW.precio_clientes, 0) - COALESCE(NEW.mi_costo, 0);

  -- Calculate margin percentage (avoid division by zero)
  IF COALESCE(NEW.mi_costo, 0) > 0 THEN
    NEW.margen_clientes_pct := ROUND(((COALESCE(NEW.precio_clientes, 0) - NEW.mi_costo) / NEW.mi_costo * 100)::numeric, 2);
  ELSE
    NEW.margen_clientes_pct := 0;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Fix log_product_pricing_change trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION log_product_pricing_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      new_cost_price, new_sell_price
    ) VALUES (
      NEW.product_id, NEW.company_id, 'create',
      CASE WHEN NEW.parent_company_id IS NOT NULL THEN 'branch' ELSE 'company' END,
      NEW.mi_costo, NEW.precio_clientes
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      old_cost_price, old_sell_price,
      new_cost_price, new_sell_price
    ) VALUES (
      NEW.product_id, NEW.company_id, 'update',
      CASE WHEN NEW.parent_company_id IS NOT NULL THEN 'branch' ELSE 'company' END,
      OLD.mi_costo, OLD.precio_clientes,
      NEW.mi_costo, NEW.precio_clientes
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO product_pricing_history (
      product_id, company_id, change_type, change_level,
      old_cost_price, old_sell_price
    ) VALUES (
      OLD.product_id, OLD.company_id, 'delete',
      CASE WHEN OLD.parent_company_id IS NOT NULL THEN 'branch' ELSE 'company' END,
      OLD.mi_costo, OLD.precio_clientes
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
