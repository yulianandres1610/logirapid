-- Migration: Add company_id to routes table for multi-tenancy
-- Description: This migration adds company_id column to routes table to enable
--              company-specific route filtering
-- Date: 2025-11-21

-- Step 1: Add company_id column to routes table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'routes' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE routes
        ADD COLUMN company_id INTEGER REFERENCES companies(id);
    END IF;
END $$;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_routes_company_id ON routes(company_id);

-- Step 3: Set default company_id for existing routes
-- Assuming company_id = 1 is the default company
UPDATE routes
SET company_id = 1
WHERE company_id IS NULL;

-- Step 4: Make company_id required after migrating existing data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'routes'
        AND column_name = 'company_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE routes
        ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;