-- Migration: 32_delivery_proofs.sql
-- Description: Create delivery_proofs table for storing signatures and photos
-- Date: 2024-11-28

-- Create delivery_proofs table
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  order_number VARCHAR(100) NOT NULL,

  -- Firma electronica
  signature_data TEXT,                      -- Base64 de la firma PNG
  signature_storage_path VARCHAR(500),      -- Path en Supabase Storage
  signer_name VARCHAR(255),                 -- Nombre de quien firma
  signer_relation VARCHAR(100),             -- Relacion: recipient, neighbor, guard, other

  -- Fotos de entrega (array de objetos JSON)
  photos JSONB DEFAULT '[]',                -- [{path, uploadedAt, type}]

  -- Geolocalizacion de la entrega
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),

  -- Metadata
  notes TEXT,
  created_by INTEGER,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Multi-tenant
  company_id INTEGER NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_order ON delivery_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_order_number ON delivery_proofs(order_number);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_company ON delivery_proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_created_at ON delivery_proofs(created_at DESC);

-- Add proof_status column to package_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'proof_status'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN proof_status VARCHAR(20) DEFAULT 'none';
  END IF;
END $$;

-- Add delivered_at column to package_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN delivered_at TIMESTAMP;
  END IF;
END $$;

-- Add delivery_proof_id column to package_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'package_orders' AND column_name = 'delivery_proof_id'
  ) THEN
    ALTER TABLE package_orders ADD COLUMN delivery_proof_id INTEGER;
  END IF;
END $$;

-- Create index on proof_status for filtering
CREATE INDEX IF NOT EXISTS idx_package_orders_proof_status ON package_orders(proof_status);

-- Comments for documentation
COMMENT ON TABLE delivery_proofs IS 'Stores delivery proof data including signatures and photos for package orders';
COMMENT ON COLUMN delivery_proofs.signature_data IS 'Base64 encoded PNG signature image';
COMMENT ON COLUMN delivery_proofs.signature_storage_path IS 'Path to signature file in Supabase Storage';
COMMENT ON COLUMN delivery_proofs.signer_relation IS 'Relationship of signer to recipient: recipient, neighbor, guard, family, other';
COMMENT ON COLUMN delivery_proofs.photos IS 'JSON array of photo objects with path, uploadedAt, and type fields';
COMMENT ON COLUMN delivery_proofs.delivery_latitude IS 'GPS latitude at time of delivery proof creation';
COMMENT ON COLUMN delivery_proofs.delivery_longitude IS 'GPS longitude at time of delivery proof creation';
