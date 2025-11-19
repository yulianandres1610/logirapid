-- Migration: Add company_id to suppliers table for multi-tenancy
-- Description: This migration adds company_id column to suppliers table to enable
--              company-specific supplier filtering
-- Date: 2025-01-19

-- Step 1: Add company_id column to suppliers table
ALTER TABLE suppliers
ADD COLUMN company_id INTEGER REFERENCES companies(id);

-- Step 2: Create index for better query performance
CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);

-- Step 3: Update existing suppliers to assign them to default company (ID=1)
-- This ensures data integrity for existing records
UPDATE suppliers
SET company_id = 1
WHERE company_id IS NULL;

-- Step 4: Make company_id required after migrating existing data
ALTER TABLE suppliers
ALTER COLUMN company_id SET NOT NULL;

-- Verification query (commented out - for manual verification after migration)
-- SELECT id, name, company_id FROM suppliers ORDER BY company_id, name;
