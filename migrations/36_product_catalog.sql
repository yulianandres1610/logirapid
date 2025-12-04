-- Migration 36: Product Catalog System
-- Creates the product_catalog table for sellable products across all service categories
-- This is DIFFERENT from service modules (enabledServices) - these are physical products for sale

-- ============================================================================
-- Table: product_catalog
-- Platform-level catalog of all sellable products
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_catalog (
  id SERIAL PRIMARY KEY,

  -- Product identification
  code VARCHAR(50) UNIQUE NOT NULL,              -- "CAJA_15X15X15", "RECARGA_CUBACEL_10"
  name VARCHAR(255) NOT NULL,                     -- "Caja 15x15x15"
  description TEXT,

  -- Categorization
  service_category VARCHAR(50) NOT NULL,          -- "paqueteria", "remesa", "recarga", "mercado"
  product_type VARCHAR(50) NOT NULL,              -- "caja", "duradero", "por_libra", "transferencia", "recarga_movil"

  -- Product attributes (for physical products)
  dimensions VARCHAR(50),                         -- "15x15x15" (for boxes)
  weight_capacity DECIMAL(10,2),                  -- Max weight in lbs (for boxes)
  unit_type VARCHAR(20) DEFAULT 'unit',           -- "unit", "lb", "kg", "usd"

  -- Platform pricing (LogiRapid)
  provider_cost DECIMAL(15,2) DEFAULT 0,          -- What LogiRapid pays to the provider
  platform_price DECIMAL(15,2) DEFAULT 0,         -- What LogiRapid charges companies

  -- Pricing model
  pricing_model VARCHAR(30) DEFAULT 'fixed',      -- "fixed", "by_weight", "by_volume", "percentage"
  min_price DECIMAL(15,2) DEFAULT 0,              -- Minimum allowed price

  -- Provider company (optional - for specific providers)
  provider_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,

  -- Status and ordering
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(service_category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_type ON product_catalog(product_type);
CREATE INDEX IF NOT EXISTS idx_product_catalog_provider ON product_catalog(provider_company_id);
CREATE INDEX IF NOT EXISTS idx_product_catalog_active ON product_catalog(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_catalog_code ON product_catalog(code);

-- Comments for documentation
COMMENT ON TABLE product_catalog IS 'Catalog of sellable products across all service categories (Paqueteria, Remesa, Recarga, Mercado)';
COMMENT ON COLUMN product_catalog.code IS 'Unique product code for identification';
COMMENT ON COLUMN product_catalog.service_category IS 'Service category: paqueteria, remesa, recarga, mercado';
COMMENT ON COLUMN product_catalog.provider_cost IS 'What LogiRapid pays to acquire/provide this product';
COMMENT ON COLUMN product_catalog.platform_price IS 'Price LogiRapid charges companies (their cost_price)';
COMMENT ON COLUMN product_catalog.pricing_model IS 'How the product is priced: fixed, by_weight, by_volume, percentage';

-- ============================================================================
-- Insert initial product catalog data
-- ============================================================================

-- Paqueteria products (boxes and shipping)
INSERT INTO product_catalog (code, name, description, service_category, product_type, dimensions, weight_capacity, unit_type, provider_cost, platform_price, pricing_model, display_order) VALUES
('CAJA_PEQUENA', 'Caja Pequena 15x15x15', 'Caja pequena para envios ligeros', 'paqueteria', 'caja', '15x15x15', 10.00, 'unit', 8.00, 15.00, 'fixed', 1),
('CAJA_MEDIANA', 'Caja Mediana 20x20x20', 'Caja mediana para envios estandar', 'paqueteria', 'caja', '20x20x20', 25.00, 'unit', 12.00, 22.00, 'fixed', 2),
('CAJA_GRANDE', 'Caja Grande 30x30x30', 'Caja grande para envios voluminosos', 'paqueteria', 'caja', '30x30x30', 50.00, 'unit', 18.00, 32.00, 'fixed', 3),
('DURADERO', 'Envio Duradero', 'Envio de articulos duraderos por peso', 'paqueteria', 'duradero', NULL, NULL, 'lb', 1.50, 2.50, 'by_weight', 4),
('POR_LIBRA', 'Envio por Libra', 'Envio general cobrado por peso', 'paqueteria', 'por_libra', NULL, NULL, 'lb', 2.00, 3.00, 'by_weight', 5),
('MISCELANEO', 'Miscelaneo', 'Articulos miscelaneos', 'paqueteria', 'miscelaneo', NULL, NULL, 'unit', 1.00, 2.00, 'fixed', 6)
ON CONFLICT (code) DO NOTHING;

-- Remesa products (money transfers)
INSERT INTO product_catalog (code, name, description, service_category, product_type, unit_type, provider_cost, platform_price, pricing_model, display_order) VALUES
('REMESA_CUBA_CUP', 'Remesa Cuba CUP', 'Transferencia de dinero a Cuba en CUP', 'remesa', 'transferencia', 'usd', 1.50, 2.50, 'percentage', 1),
('REMESA_CUBA_USD', 'Remesa Cuba USD', 'Transferencia de dinero a Cuba en USD', 'remesa', 'transferencia', 'usd', 1.00, 2.00, 'percentage', 2),
('REMESA_CUBA_MLC', 'Remesa Cuba MLC', 'Transferencia de dinero a Cuba en MLC', 'remesa', 'transferencia', 'usd', 1.20, 2.20, 'percentage', 3)
ON CONFLICT (code) DO NOTHING;

-- Recarga products (mobile top-ups)
INSERT INTO product_catalog (code, name, description, service_category, product_type, unit_type, provider_cost, platform_price, pricing_model, display_order) VALUES
('RECARGA_CUBACEL', 'Recarga Cubacel', 'Recarga de saldo movil Cubacel', 'recarga', 'recarga_movil', 'usd', 0.90, 1.00, 'fixed', 1),
('RECARGA_NAUTA', 'Recarga Nauta', 'Recarga de internet Nauta', 'recarga', 'recarga_movil', 'usd', 0.92, 1.00, 'fixed', 2),
('RECARGA_NAUTA_HOGAR', 'Recarga Nauta Hogar', 'Recarga de internet Nauta Hogar', 'recarga', 'recarga_movil', 'usd', 0.95, 1.05, 'fixed', 3)
ON CONFLICT (code) DO NOTHING;

-- Mercado products (marketplace fees)
INSERT INTO product_catalog (code, name, description, service_category, product_type, unit_type, provider_cost, platform_price, pricing_model, display_order) VALUES
('MERCADO_COMISION', 'Comision por Venta', 'Comision cobrada por venta en marketplace', 'mercado', 'comision', 'usd', 2.00, 5.00, 'percentage', 1),
('MERCADO_PUBLICACION', 'Fee de Publicacion', 'Costo por publicar un producto', 'mercado', 'publicacion', 'usd', 0.50, 1.00, 'fixed', 2)
ON CONFLICT (code) DO NOTHING;
