-- Migration: Add company_id to customers table for multi-tenancy
-- Description: This migration adds company_id column to customers table to enable
--              company-specific customer filtering
-- Date: 2025-11-21

-- Step 1: Add company_id column to customers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE customers
        ADD COLUMN company_id INTEGER REFERENCES companies(id);
    END IF;
END $$;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- Step 3: Set default company_id for existing customers
-- Assuming company_id = 1 is the default company
UPDATE customers
SET company_id = 1
WHERE company_id IS NULL;

-- Step 4: Make company_id required after migrating existing data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'company_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE customers
        ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;

-- Step 5: Add company_id to customer_change_history for audit trail
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_change_history' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE customer_change_history
        ADD COLUMN company_id INTEGER REFERENCES companies(id);

        -- Update existing history records
        UPDATE customer_change_history
        SET company_id = (SELECT company_id FROM customers WHERE customers.id = customer_change_history.customer_id)
        WHERE company_id IS NULL;

        -- Make it required for future records
        ALTER TABLE customer_change_history
        ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;