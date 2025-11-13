-- ====================================
-- TABLAS PARA RUTAS DE ALMACENES
-- ====================================
-- Estas tablas gestionan rutas específicas para recolección de paquetes en almacenes
-- Separadas de las rutas de órdenes (tabla 'routes')

-- Tabla principal de rutas de almacenes
CREATE TABLE IF NOT EXISTS warehouse_routes (
  id SERIAL PRIMARY KEY,
  routenumber VARCHAR(50) UNIQUE NOT NULL, -- RUT-WH-2025-0001
  name VARCHAR(255) NOT NULL,

  -- Asignación de recursos
  driverid INTEGER,
  drivername VARCHAR(255),
  vehicleid VARCHAR(50),
  vehicleplate VARCHAR(20),

  -- Estado de la ruta
  status VARCHAR(50) DEFAULT 'planning', -- planning, active, completed, cancelled

  -- Almacén de origen
  warehouseid INTEGER NOT NULL,
  warehousename VARCHAR(255),

  -- Métricas de la ruta
  totalstops INTEGER DEFAULT 0, -- Número de almacenes a visitar
  completedstops INTEGER DEFAULT 0, -- Paradas completadas
  totaldistance DECIMAL(10, 2) DEFAULT 0, -- Millas totales
  estimatedduration INTEGER DEFAULT 0, -- Minutos estimados
  actualduration INTEGER DEFAULT 0, -- Minutos reales

  -- Paquetes y bultos
  totalpackages INTEGER DEFAULT 0, -- Total de paquetes a recoger
  scannedpackages INTEGER DEFAULT 0, -- Paquetes escaneados

  -- Fechas y tiempos
  date DATE NOT NULL,
  starttime TIMESTAMP,
  endtime TIMESTAMP,

  -- Información adicional
  notes TEXT,

  -- Datos de optimización de Mapbox
  geometry JSONB, -- GeoJSON de la ruta completa
  coordinates JSONB, -- Array de coordenadas de la ruta

  -- Metadata
  createdat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW(),

  -- Índices para búsquedas rápidas
  CONSTRAINT fk_warehouse FOREIGN KEY (warehouseid) REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_warehouse_routes_status ON warehouse_routes(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_routes_date ON warehouse_routes(date);
CREATE INDEX IF NOT EXISTS idx_warehouse_routes_driver ON warehouse_routes(driverid);
CREATE INDEX IF NOT EXISTS idx_warehouse_routes_warehouse ON warehouse_routes(warehouseid);

-- Tabla de paradas en rutas de almacenes
CREATE TABLE IF NOT EXISTS warehouse_route_stops (
  id SERIAL PRIMARY KEY,
  routeid INTEGER NOT NULL,

  -- Información del almacén
  warehouseid INTEGER NOT NULL,
  warehousename VARCHAR(255) NOT NULL,
  warehousecode VARCHAR(50),

  -- Ubicación
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  zipcode VARCHAR(20),

  -- Secuencia en la ruta
  sequence INTEGER NOT NULL, -- Orden de visita

  -- Estado de la parada
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, skipped, failed

  -- Información de paquetes
  expectedpackages INTEGER DEFAULT 0, -- Paquetes esperados en este almacén
  scannedpackages INTEGER DEFAULT 0, -- Paquetes ya escaneados
  packageids JSONB DEFAULT '[]', -- Array de IDs de paquetes escaneados

  -- Información del manager/contacto
  managername VARCHAR(255),
  managerphone VARCHAR(20),

  -- Capacidad del almacén
  warehousecapacity INTEGER,
  availablecapacity INTEGER,
  warehousetype VARCHAR(50),

  -- Tiempos
  arrivaltime TIMESTAMP, -- Hora de llegada real
  departuretime TIMESTAMP, -- Hora de salida real
  estimatedarrival TIMESTAMP, -- ETA calculado
  duration INTEGER DEFAULT 0, -- Minutos en la parada

  -- Notas y observaciones
  notes TEXT,
  scannotes TEXT, -- Notas del escaneo (problemas, faltantes, etc)

  -- Metadata
  createdat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_warehouse_route FOREIGN KEY (routeid) REFERENCES warehouse_routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_stop_warehouse FOREIGN KEY (warehouseid) REFERENCES warehouses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warehouse_stops_route ON warehouse_route_stops(routeid);
CREATE INDEX IF NOT EXISTS idx_warehouse_stops_warehouse ON warehouse_route_stops(warehouseid);
CREATE INDEX IF NOT EXISTS idx_warehouse_stops_status ON warehouse_route_stops(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_stops_sequence ON warehouse_route_stops(routeid, sequence);

-- Tabla de escaneos de paquetes en paradas de almacenes
CREATE TABLE IF NOT EXISTS warehouse_stop_scans (
  id SERIAL PRIMARY KEY,
  stopid INTEGER NOT NULL,
  routeid INTEGER NOT NULL,

  -- Información del paquete
  packageid VARCHAR(100) NOT NULL, -- Tracking number o código de barras
  packagedata JSONB, -- Información adicional del paquete

  -- Información del escaneo
  scannedat TIMESTAMP DEFAULT NOW(),
  scannedby INTEGER, -- User ID del driver

  -- Validación
  isvalid BOOLEAN DEFAULT true, -- Si el paquete corresponde a este almacén
  validationerror TEXT, -- Error si no es válido

  -- Metadata
  createdat TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_scan_stop FOREIGN KEY (stopid) REFERENCES warehouse_route_stops(id) ON DELETE CASCADE,
  CONSTRAINT fk_scan_route FOREIGN KEY (routeid) REFERENCES warehouse_routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warehouse_scans_stop ON warehouse_stop_scans(stopid);
CREATE INDEX IF NOT EXISTS idx_warehouse_scans_package ON warehouse_stop_scans(packageid);
CREATE INDEX IF NOT EXISTS idx_warehouse_scans_scannedat ON warehouse_stop_scans(scannedat);

-- Triggers para actualizar automáticamente los contadores

-- Trigger para actualizar scannedpackages en warehouse_route_stops
CREATE OR REPLACE FUNCTION update_stop_scanned_packages()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el contador de paquetes escaneados en la parada
  UPDATE warehouse_route_stops
  SET
    scannedpackages = (
      SELECT COUNT(*)
      FROM warehouse_stop_scans
      WHERE stopid = NEW.stopid AND isvalid = true
    ),
    updatedat = NOW()
  WHERE id = NEW.stopid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stop_scans
AFTER INSERT ON warehouse_stop_scans
FOR EACH ROW
EXECUTE FUNCTION update_stop_scanned_packages();

-- Trigger para actualizar totales en warehouse_routes
CREATE OR REPLACE FUNCTION update_route_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar totales en la ruta
  UPDATE warehouse_routes
  SET
    scannedpackages = (
      SELECT COALESCE(SUM(scannedpackages), 0)
      FROM warehouse_route_stops
      WHERE routeid = NEW.routeid
    ),
    completedstops = (
      SELECT COUNT(*)
      FROM warehouse_route_stops
      WHERE routeid = NEW.routeid AND status = 'completed'
    ),
    updatedat = NOW()
  WHERE id = NEW.routeid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_route_from_stops
AFTER UPDATE ON warehouse_route_stops
FOR EACH ROW
EXECUTE FUNCTION update_route_totals();

-- Comentarios para documentación
COMMENT ON TABLE warehouse_routes IS 'Rutas específicas para recolección de paquetes en almacenes';
COMMENT ON TABLE warehouse_route_stops IS 'Paradas individuales en rutas de almacenes con tracking de paquetes';
COMMENT ON TABLE warehouse_stop_scans IS 'Registro de escaneo de cada paquete en cada parada';

COMMENT ON COLUMN warehouse_routes.routenumber IS 'Formato: RUT-WH-YYYY-####';
COMMENT ON COLUMN warehouse_routes.status IS 'planning | active | completed | cancelled';
COMMENT ON COLUMN warehouse_route_stops.status IS 'pending | in_progress | completed | skipped | failed';
COMMENT ON COLUMN warehouse_route_stops.expectedpackages IS 'Cantidad de paquetes esperados en este almacén';
COMMENT ON COLUMN warehouse_route_stops.scannedpackages IS 'Cantidad de paquetes ya escaneados';
COMMENT ON COLUMN warehouse_stop_scans.isvalid IS 'Indica si el paquete escaneado corresponde a este almacén';
