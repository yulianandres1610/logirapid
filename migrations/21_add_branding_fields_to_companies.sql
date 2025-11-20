-- Migration 21: Add branding and additional fields to companies table
-- Purpose: Add logo, colors, subdomain, and missing contact fields for company branding
-- Date: 2025-01-19

BEGIN;

-- Add email field if not exists
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add state field if not exists
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- Add zipcode field if not exists
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS zipcode VARCHAR(20);

-- Add logo URL field for S3 storage
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add subdomain for custom branding (e.g., companyname.logirapid.com)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100) UNIQUE;

-- Add primary brand color (hex format: #RRGGBB)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#CC0A46';

-- Add secondary brand color (hex format: #RRGGBB)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#0A46CC';

-- Add comments to explain the columns
COMMENT ON COLUMN companies.email IS 'Company email for official communications';
COMMENT ON COLUMN companies.state IS 'State/Province where company is located';
COMMENT ON COLUMN companies.zipcode IS 'Postal/ZIP code of company address';
COMMENT ON COLUMN companies.logo_url IS 'Public URL to company logo stored in S3 bucket (company-documents)';
COMMENT ON COLUMN companies.subdomain IS 'Unique subdomain for company branding (e.g., acmelogistics.logirapid.com). Used for custom dashboards and white-label solutions.';
COMMENT ON COLUMN companies.primary_color IS 'Primary brand color in hex format (#RRGGBB). Used in dashboard theme and branding.';
COMMENT ON COLUMN companies.secondary_color IS 'Secondary brand color in hex format (#RRGGBB). Used for accents and highlights in UI.';

-- Create index for subdomain lookups
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain) WHERE subdomain IS NOT NULL;

-- Create index for email
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email) WHERE email IS NOT NULL;

COMMIT;
