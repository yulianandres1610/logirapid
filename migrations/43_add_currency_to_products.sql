-- Migration 43: Add currency field to product_catalog for remesa products
-- This allows specifying the target currency for money transfer products

-- Add currency column to product_catalog
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN product_catalog.currency IS 'Target currency for remesa products (USD, EUR, MLC, CUP, etc.)';

-- Create index for currency queries
CREATE INDEX IF NOT EXISTS idx_product_catalog_currency ON product_catalog(currency) WHERE currency IS NOT NULL;

-- Update existing remesa products with their currencies based on name
UPDATE product_catalog SET currency = 'CUP' WHERE code LIKE 'REMESA%CUP%' AND currency IS NULL;
UPDATE product_catalog SET currency = 'USD' WHERE code LIKE 'REMESA%USD%' AND currency IS NULL;
UPDATE product_catalog SET currency = 'MLC' WHERE code LIKE 'REMESA%MLC%' AND currency IS NULL;
