-- Migration 19: Add customer_service_phone to companies table
-- Purpose: Add dedicated customer service phone field for company contact

-- Add customer_service_phone column
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS customer_service_phone VARCHAR(20);

-- Add comment to describe the column
COMMENT ON COLUMN companies.customer_service_phone IS 'Dedicated customer service phone number for the company. Used in shipping labels and customer communications. Falls back to main phone if not set.';
