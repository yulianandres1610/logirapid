-- Migration: Driver Inventory System
-- Fecha: 2025-11-26
-- Descripcion: Agregar campos para tracking de empaques por driver y tabla de inventario

-- 1. Agregar campos a tabla empaques para asociar con driver
ALTER TABLE empaques ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id);
ALTER TABLE empaques ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255);
ALTER TABLE empaques ADD COLUMN IF NOT EXISTS assigned_to_driver_at TIMESTAMP;

-- 2. Crear indice para busquedas rapidas por driver
CREATE INDEX IF NOT EXISTS idx_empaques_driver_id ON empaques(driver_id);

-- 3. Crear tabla de inventario de drivers
CREATE TABLE IF NOT EXISTS driver_inventory (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cajas_vacias_count INTEGER DEFAULT 0,
  bultos_count INTEGER DEFAULT 0,
  cajas_vacias_capacity INTEGER DEFAULT 50,
  bultos_capacity INTEGER DEFAULT 100,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (driver_id)
);

-- 4. Crear indice para busquedas por company
CREATE INDEX IF NOT EXISTS idx_driver_inventory_company ON driver_inventory(company_id);

-- 5. Funcion para actualizar inventario de driver automaticamente
CREATE OR REPLACE FUNCTION update_driver_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se asigna un empaque a un driver
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id != NEW.driver_id) THEN
    -- Crear registro de inventario si no existe
    INSERT INTO driver_inventory (driver_id, cajas_vacias_count, company_id)
    VALUES (NEW.driver_id, 0, NEW.company_id)
    ON CONFLICT (driver_id) DO NOTHING;

    -- Incrementar contador del nuevo driver
    UPDATE driver_inventory
    SET cajas_vacias_count = cajas_vacias_count + 1,
        updated_at = NOW()
    WHERE driver_id = NEW.driver_id;
  END IF;

  -- Cuando se desasigna un empaque de un driver
  IF OLD.driver_id IS NOT NULL AND (NEW.driver_id IS NULL OR NEW.driver_id != OLD.driver_id) THEN
    UPDATE driver_inventory
    SET cajas_vacias_count = GREATEST(0, cajas_vacias_count - 1),
        updated_at = NOW()
    WHERE driver_id = OLD.driver_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para mantener inventario actualizado
DROP TRIGGER IF EXISTS trigger_update_driver_inventory ON empaques;
CREATE TRIGGER trigger_update_driver_inventory
AFTER UPDATE OF driver_id ON empaques
FOR EACH ROW
EXECUTE FUNCTION update_driver_inventory();

-- 7. Trigger para INSERT de empaques con driver_id
CREATE OR REPLACE FUNCTION insert_driver_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO driver_inventory (driver_id, cajas_vacias_count, company_id)
    VALUES (NEW.driver_id, 1, NEW.company_id)
    ON CONFLICT (driver_id)
    DO UPDATE SET cajas_vacias_count = driver_inventory.cajas_vacias_count + 1,
                  updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_insert_driver_inventory ON empaques;
CREATE TRIGGER trigger_insert_driver_inventory
AFTER INSERT ON empaques
FOR EACH ROW
EXECUTE FUNCTION insert_driver_inventory();

-- 8. Inicializar inventario para drivers existentes
INSERT INTO driver_inventory (driver_id, cajas_vacias_count, bultos_count, company_id)
SELECT DISTINCT
  u.id,
  COALESCE((SELECT COUNT(*) FROM empaques e WHERE e.driver_id = u.id), 0),
  0,
  uc.companyid
FROM users u
JOIN user_companies uc ON u.id = uc.userid
WHERE u.role = 'DRIVER'
ON CONFLICT (driver_id) DO UPDATE
SET cajas_vacias_count = EXCLUDED.cajas_vacias_count,
    updated_at = NOW();
