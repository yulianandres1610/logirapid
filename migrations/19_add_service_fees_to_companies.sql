-- Migration: Add service_fees column to companies table
-- Description: Stores platform fees (percentage and fixed) for each service
-- Date: 2025-01-19

BEGIN;

-- Add service_fees column to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS service_fees JSONB DEFAULT '{
  "wallet": {"percentage": 0, "fixed": 0},
  "recharge": {"percentage": 0, "fixed": 0},
  "remittance": {"percentage": 0, "fixed": 0},
  "paqueteria": {"percentage": 0, "fixed": 0},
  "tracker": {"percentage": 0, "fixed": 0},
  "exchange": {"percentage": 0, "fixed": 0},
  "marketplace": {"percentage": 0, "fixed": 0}
}'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN companies.service_fees IS 'Platform fees per service. Each service has percentage (%) and fixed ($) fee. Example: {"wallet": {"percentage": 2.5, "fixed": 0}} means 2.5% fee for wallet transactions.';

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_companies_service_fees ON companies USING gin(service_fees);

COMMIT;
