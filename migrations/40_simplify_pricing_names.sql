-- Migration 40: Simplify Pricing Field Names
-- This migration renames price fields to use clearer, more intuitive names in Spanish

-- ============================================================================
-- PHASE 1: Rename product_catalog columns
-- ============================================================================

-- Rename provider_cost -> mi_costo (Proveedor: Costo real de producción)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_catalog' AND column_name = 'provider_cost') THEN
    ALTER TABLE product_catalog RENAME COLUMN provider_cost TO mi_costo;
  END IF;
END $$;

-- Rename provider_b2b_price -> precio_mayorista (Precio que cobra a LogiRapid)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_catalog' AND column_name = 'provider_b2b_price') THEN
    ALTER TABLE product_catalog RENAME COLUMN provider_b2b_price TO precio_mayorista;
  END IF;
END $$;

-- Rename platform_min_b2c -> precio_publico (Precio de venta al cliente final)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_catalog' AND column_name = 'platform_min_b2c') THEN
    ALTER TABLE product_catalog RENAME COLUMN platform_min_b2c TO precio_publico;
  END IF;
END $$;

-- Drop redundant columns from product_catalog
DO $$
BEGIN
  -- platform_price was redundant (same as precio_mayorista in most cases)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_catalog' AND column_name = 'platform_price') THEN
    ALTER TABLE product_catalog DROP COLUMN platform_price;
  END IF;

  -- min_price is no longer used
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_catalog' AND column_name = 'min_price') THEN
    ALTER TABLE product_catalog DROP COLUMN min_price;
  END IF;
END $$;

-- ============================================================================
-- PHASE 2: Rename company_product_pricing columns
-- ============================================================================

-- Rename cost_price -> mi_costo (Costo heredado del nivel superior - NO EDITABLE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'cost_price') THEN
    ALTER TABLE company_product_pricing RENAME COLUMN cost_price TO mi_costo;
  END IF;
END $$;

-- Rename b2b_price -> precio_sucursales (Precio de venta a sucursales)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'b2b_price') THEN
    ALTER TABLE company_product_pricing RENAME COLUMN b2b_price TO precio_sucursales;
  END IF;
END $$;

-- Rename b2c_price -> precio_clientes (Precio de venta al cliente final)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'b2c_price') THEN
    ALTER TABLE company_product_pricing RENAME COLUMN b2c_price TO precio_clientes;
  END IF;
END $$;

-- Rename margin columns for clarity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'margin') THEN
    ALTER TABLE company_product_pricing RENAME COLUMN margin TO margen_clientes;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'margin_percentage') THEN
    ALTER TABLE company_product_pricing RENAME COLUMN margin_percentage TO margen_clientes_pct;
  END IF;
END $$;

-- Drop legacy/redundant columns from company_product_pricing
DO $$
BEGIN
  -- sell_price was legacy, replaced by precio_clientes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'sell_price') THEN
    -- First migrate any sell_price data to precio_clientes if precio_clientes is null
    UPDATE company_product_pricing
    SET precio_clientes = sell_price
    WHERE precio_clientes IS NULL AND sell_price IS NOT NULL;

    ALTER TABLE company_product_pricing DROP COLUMN sell_price;
  END IF;

  -- min_b2b_price is no longer needed with new logic
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'min_b2b_price') THEN
    ALTER TABLE company_product_pricing DROP COLUMN min_b2b_price;
  END IF;

  -- margin_b2b is no longer needed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'margin_b2b') THEN
    ALTER TABLE company_product_pricing DROP COLUMN margin_b2b;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_pricing' AND column_name = 'margin_b2b_percentage') THEN
    ALTER TABLE company_product_pricing DROP COLUMN margin_b2b_percentage;
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN product_catalog.mi_costo IS 'Costo real de producción/adquisición del proveedor';
COMMENT ON COLUMN product_catalog.precio_mayorista IS 'Precio que el proveedor cobra a LogiRapid (mayorista)';
COMMENT ON COLUMN product_catalog.precio_publico IS 'Precio sugerido de venta al cliente final';

COMMENT ON COLUMN company_product_pricing.mi_costo IS 'Costo heredado del nivel superior (NO EDITABLE por la empresa)';
COMMENT ON COLUMN company_product_pricing.precio_sucursales IS 'Precio de venta a las sucursales de esta empresa (solo matrices)';
COMMENT ON COLUMN company_product_pricing.precio_clientes IS 'Precio de venta al cliente final';
COMMENT ON COLUMN company_product_pricing.margen_clientes IS 'Margen de ganancia sobre precio a clientes ($)';
COMMENT ON COLUMN company_product_pricing.margen_clientes_pct IS 'Margen de ganancia sobre precio a clientes (%)';

-- ============================================================================
-- VERIFICATION: Check final structure
-- ============================================================================

-- This query can be run to verify the migration was successful
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'product_catalog' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'company_product_pricing' ORDER BY ordinal_position;
