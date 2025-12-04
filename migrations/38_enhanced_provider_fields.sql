-- Migration 38: Enhanced Provider Fields for Companies
-- Adds provider_type and provider_categories to companies table
-- Extends the basic is_provider field from migration 34

-- Add provider_type column (products, services, or both)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50);

-- Add provider_categories column (JSON array of categories this company provides)
-- Example: ["paqueteria", "remesa"]
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provider_categories JSON DEFAULT '[]';

-- Create index for faster provider lookups by type
CREATE INDEX IF NOT EXISTS idx_companies_provider_type ON companies(provider_type) WHERE is_provider = true;

-- Comments for documentation
COMMENT ON COLUMN companies.provider_type IS 'Type of provider: products (physical), services (shipping/delivery), both';
COMMENT ON COLUMN companies.provider_categories IS 'JSON array of service categories this company provides: paqueteria, remesa, recarga, mercado';

-- Update existing providers to have default values if they don't have them
UPDATE companies
SET provider_type = 'both',
    provider_categories = COALESCE(provider_services, '[]')
WHERE is_provider = true
  AND provider_type IS NULL;
