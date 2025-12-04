-- Migration 34: Add provider fields to companies table
-- Adds is_provider and provider_services fields to identify provider companies

-- Add is_provider column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_provider BOOLEAN DEFAULT false;

-- Add provider_services column (JSON array of service IDs this company provides)
-- Example: ["paqueteria", "recharge", "remittance"]
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provider_services JSON DEFAULT '[]';

-- Create index for faster provider lookups
CREATE INDEX IF NOT EXISTS idx_companies_is_provider ON companies(is_provider) WHERE is_provider = true;

-- Add comment for documentation
COMMENT ON COLUMN companies.is_provider IS 'Indicates if this company is a service provider for LogiRapid';
COMMENT ON COLUMN companies.provider_services IS 'JSON array of service IDs that this company provides. Only relevant when is_provider = true';
