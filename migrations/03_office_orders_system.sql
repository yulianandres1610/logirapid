-- =====================================================
-- Office Orders System Migration
-- =====================================================
-- Adds support for office orders with:
-- - Dynamic services configuration
-- - Configurable content types
-- - Split payment system
-- - Order type differentiation (recogida vs oficina)
-- =====================================================

-- 1. Modify package_orders table to support office orders
-- =====================================================
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'recogida' CHECK (order_type IN ('recogida', 'oficina')),
ADD COLUMN IF NOT EXISTS office_order_data JSON;

-- Add comment for new columns
COMMENT ON COLUMN package_orders.order_type IS 'Type of order: recogida (pickup) or oficina (office)';
COMMENT ON COLUMN package_orders.office_order_data IS 'JSON data specific to office orders including box details, content types, and dimensions';

-- 2. Create services table for dynamic service management
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  service_type VARCHAR(50) NOT NULL, -- 'caja', 'duradero', 'lb', 'custom'
  pricing_model VARCHAR(50) NOT NULL, -- 'fixed', 'by_weight', 'by_volume', 'fixed_plus_weight', 'fixed_plus_volume'
  base_price DECIMAL(10,2) DEFAULT 0,
  price_per_unit DECIMAL(10,2) DEFAULT 0,
  unit_type VARCHAR(20), -- 'lb', 'kg', 'm3', 'ft3', 'unit'
  requires_box_code BOOLEAN DEFAULT false,
  requires_dimensions BOOLEAN DEFAULT false,
  requires_weight BOOLEAN DEFAULT false,
  requires_recipient BOOLEAN DEFAULT true,
  requires_content_type BOOLEAN DEFAULT false,
  box_type VARCHAR(50), -- 'pequeña', 'mediana', 'grande' - for caja service type
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_code ON services(code);

-- Add comments
COMMENT ON TABLE services IS 'Dynamic service configuration for package orders';
COMMENT ON COLUMN services.pricing_model IS 'fixed: flat rate, by_weight: per unit weight, by_volume: per unit volume, fixed_plus_weight: base + weight, fixed_plus_volume: base + volume';
COMMENT ON COLUMN services.service_type IS 'Type of service: caja (box), duradero (durable), lb (per pound), custom';

-- 3. Create package_content_types table for content classification
-- =====================================================
CREATE TABLE IF NOT EXISTS package_content_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  description TEXT,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  color VARCHAR(20) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_content_types_active ON package_content_types(active);
CREATE INDEX IF NOT EXISTS idx_content_types_order ON package_content_types(display_order);

-- Add comment
COMMENT ON TABLE package_content_types IS 'Configurable content types for package classification (e.g., Food, Cleaning, Tools)';

-- 4. Create office_payments table for split payment tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS office_payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES package_orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'zelle', 'card', 'transfer', 'other')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reference_number VARCHAR(100),
  change_amount DECIMAL(10,2) DEFAULT 0 CHECK (change_amount >= 0),
  cash_received DECIMAL(10,2), -- Only for cash payments
  notes TEXT,
  processed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_office_payments_order ON office_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_office_payments_method ON office_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_office_payments_created ON office_payments(created_at);

-- Add comment
COMMENT ON TABLE office_payments IS 'Tracks individual payments for office orders, supports split payments';
COMMENT ON COLUMN office_payments.cash_received IS 'Amount of cash received from customer (for change calculation)';

-- 5. Insert initial content types
-- =====================================================
INSERT INTO package_content_types (name, icon, description, display_order, color) VALUES
('Comida', '🍱', 'Productos alimenticios y comestibles', 1, '#10B981'),
('Aseo', '🧼', 'Productos de higiene personal y limpieza', 2, '#3B82F6'),
('Ferretería', '🔧', 'Herramientas y materiales de construcción', 3, '#F59E0B'),
('Electrodomésticos', '📺', 'Equipos electrónicos y electrodomésticos', 4, '#8B5CF6'),
('Medicamentos', '💊', 'Medicinas y productos farmacéuticos', 5, '#EF4444'),
('Ropa y Calzado', '👕', 'Vestimenta, zapatos y accesorios', 6, '#EC4899'),
('Documentos', '📄', 'Papeles, documentos y material impreso', 7, '#6366F1')
ON CONFLICT (name) DO NOTHING;

-- 6. Insert initial service configurations
-- =====================================================
-- Envío de Caja Pequeña
INSERT INTO services (
  name, code, description, service_type, pricing_model,
  base_price, price_per_unit, unit_type,
  requires_box_code, requires_dimensions, requires_weight, requires_recipient, requires_content_type,
  box_type, active, display_order
) VALUES (
  'Envío de Caja Pequeña', 'CAJA_PEQUENA', 'Envío de caja pequeña estándar',
  'caja', 'fixed', 45.00, 0, 'unit',
  true, false, true, true, true,
  'pequeña', true, 1
) ON CONFLICT (code) DO NOTHING;

-- Envío de Caja Mediana
INSERT INTO services (
  name, code, description, service_type, pricing_model,
  base_price, price_per_unit, unit_type,
  requires_box_code, requires_dimensions, requires_weight, requires_recipient, requires_content_type,
  box_type, active, display_order
) VALUES (
  'Envío de Caja Mediana', 'CAJA_MEDIANA', 'Envío de caja mediana estándar',
  'caja', 'fixed', 65.00, 0, 'unit',
  true, false, true, true, true,
  'mediana', true, 2
) ON CONFLICT (code) DO NOTHING;

-- Envío de Duradero
INSERT INTO services (
  name, code, description, service_type, pricing_model,
  base_price, price_per_unit, unit_type,
  requires_box_code, requires_dimensions, requires_weight, requires_recipient, requires_content_type,
  box_type, active, display_order
) VALUES (
  'Envío de Duradero', 'DURADERO', 'Envío de artículos duraderos (electrodomésticos, muebles, etc.)',
  'duradero', 'by_weight', 0, 2.50, 'lb',
  false, true, true, true, true,
  null, true, 3
) ON CONFLICT (code) DO NOTHING;

-- Envío por Libra
INSERT INTO services (
  name, code, description, service_type, pricing_model,
  base_price, price_per_unit, unit_type,
  requires_box_code, requires_dimensions, requires_weight, requires_recipient, requires_content_type,
  box_type, active, display_order
) VALUES (
  'Envío por Libra', 'POR_LB', 'Envío calculado por peso en libras',
  'lb', 'by_weight', 0, 3.00, 'lb',
  true, false, true, true, false,
  null, true, 4
) ON CONFLICT (code) DO NOTHING;

-- 7. Create function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create triggers for updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_types_updated_at ON package_content_types;
CREATE TRIGGER update_content_types_updated_at
  BEFORE UPDATE ON package_content_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✓ Extended package_orders with order_type and office_order_data
-- ✓ Created services table for dynamic service configuration
-- ✓ Created package_content_types table for content classification
-- ✓ Created office_payments table for split payment tracking
-- ✓ Inserted initial content types (7 types)
-- ✓ Inserted initial services (4 services: 2 boxes, duradero, por lb)
-- ✓ Added indexes for query optimization
-- ✓ Added triggers for automatic timestamp updates
-- =====================================================
