-- Migración: Crear tabla vehicles
-- Fecha: 2025-11-26

-- Crear tabla vehicles si no existe
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vin VARCHAR(17) UNIQUE NOT NULL,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  body_type VARCHAR(50) DEFAULT 'Unknown',
  color VARCHAR(30) DEFAULT 'Unknown',
  nickname VARCHAR(100),
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'IN_TRANSIT')),
  availability VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (availability IN ('AVAILABLE', 'UNAVAILABLE', 'ASSIGNED')),
  capacity_weight_kg INTEGER DEFAULT 0,
  capacity_volume_m3 DECIMAL(10,2) DEFAULT 0,
  empty_boxes INTEGER DEFAULT 0,
  full_boxes INTEGER DEFAULT 0,
  driver_id INTEGER,
  current_route_id INTEGER,
  photos JSONB DEFAULT '[]',
  insurance_documents JSONB DEFAULT '[]',
  can_collect_durable BOOLEAN DEFAULT true,
  registration_date DATE,
  mileage INTEGER DEFAULT 0,
  insurance_expiry DATE,
  oil_change_frequency INTEGER DEFAULT 5000,
  next_oil_change DATE,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_availability ON vehicles(availability);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate);
