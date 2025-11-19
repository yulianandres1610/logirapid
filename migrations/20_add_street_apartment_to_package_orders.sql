-- Migration: Add street and apartment fields to package_orders table
-- This allows storing complete structured address data

-- Add street column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'street'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN street VARCHAR(255);
    RAISE NOTICE 'Added street column to package_orders';
  ELSE
    RAISE NOTICE 'street column already exists in package_orders';
  END IF;
END $$;

-- Add apartment column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'apartment'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN apartment VARCHAR(50);
    RAISE NOTICE 'Added apartment column to package_orders';
  ELSE
    RAISE NOTICE 'apartment column already exists in package_orders';
  END IF;
END $$;

-- Create index for street for better query performance
CREATE INDEX IF NOT EXISTS idx_package_orders_street ON package_orders(street);
