-- Migration 22: Add website field to companies
-- Purpose: Store the public website to surface it on labels and branding
-- Date: 2025-02-20

BEGIN;

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS website VARCHAR(255);

COMMENT ON COLUMN companies.website IS 'Public website URL for the company. Displayed on customer-facing labels and branding.';

CREATE INDEX IF NOT EXISTS idx_companies_website ON companies(website) WHERE website IS NOT NULL;

COMMIT;
