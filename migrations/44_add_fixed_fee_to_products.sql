-- Migration 44: Add fixed fee fields to product_catalog for remesa products
-- Remesa pricing model: percentage + fixed fee (e.g., 3% + $3 delivery fee)

-- Add fixed fee columns to product_catalog
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS mi_costo_fijo DECIMAL(15,2) DEFAULT 0;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS precio_mayorista_fijo DECIMAL(15,2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN product_catalog.mi_costo_fijo IS 'Fixed transaction fee cost (e.g., $3 delivery fee that provider charges)';
COMMENT ON COLUMN product_catalog.precio_mayorista_fijo IS 'Fixed transaction fee to charge companies (e.g., $5 delivery fee)';

-- Also add to company_product_pricing for company-specific fixed fees
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS mi_costo_fijo DECIMAL(15,2) DEFAULT NULL;
ALTER TABLE company_product_pricing ADD COLUMN IF NOT EXISTS precio_clientes_fijo DECIMAL(15,2) DEFAULT NULL;

COMMENT ON COLUMN company_product_pricing.mi_costo_fijo IS 'Company-specific fixed fee cost override';
COMMENT ON COLUMN company_product_pricing.precio_clientes_fijo IS 'Company-specific fixed fee to charge customers';
