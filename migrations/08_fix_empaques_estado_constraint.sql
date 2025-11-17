-- Migration 08: Fix empaques estado constraint
-- Adds 'recogida', 'en_almacen', 'en_transito' and other tracking estados

-- Drop existing constraint if it exists
ALTER TABLE empaques DROP CONSTRAINT IF EXISTS empaques_estado_check;

-- Add new constraint with all valid estados
ALTER TABLE empaques ADD CONSTRAINT empaques_estado_check
  CHECK (estado IN (
    'disponible',     -- Empaque available in inventory
    'asignado',       -- Assigned to a order but not picked up yet
    'recogida',       -- Picked up / collected from origin
    'en_almacen',     -- Received and processed at warehouse
    'en_transito',    -- In transit to another warehouse
    'recibido_destino', -- Received at destination warehouse
    'en_reparto',     -- Assigned to delivery route
    'entregado'       -- Delivered to final recipient
  ));

COMMENT ON CONSTRAINT empaques_estado_check ON empaques IS
  'Valid estados: disponible, asignado, recogida, en_almacen, en_transito, recibido_destino, en_reparto, entregado';
