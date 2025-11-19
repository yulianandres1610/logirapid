-- Migration: Add city, state, and country fields to package_orders table
-- This allows storing structured address data for better reporting and filtering

-- Add city column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'city'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN city VARCHAR(100);
    RAISE NOTICE 'Added city column to package_orders';
  ELSE
    RAISE NOTICE 'city column already exists in package_orders';
  END IF;
END $$;

-- Add state column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'state'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN state VARCHAR(100);
    RAISE NOTICE 'Added state column to package_orders';
  ELSE
    RAISE NOTICE 'state column already exists in package_orders';
  END IF;
END $$;

-- Add country column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'country'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN country VARCHAR(100) DEFAULT 'US';
    RAISE NOTICE 'Added country column to package_orders';
  ELSE
    RAISE NOTICE 'country column already exists in package_orders';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_package_orders_city ON package_orders(city);
CREATE INDEX IF NOT EXISTS idx_package_orders_state ON package_orders(state);
CREATE INDEX IF NOT EXISTS idx_package_orders_country ON package_orders(country);

-- Note: zipcode column already exists in package_orders table
