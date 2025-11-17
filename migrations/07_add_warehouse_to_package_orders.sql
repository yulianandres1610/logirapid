-- Migration 07: Agregar warehouse_id a package_orders
-- Permite relacionar órdenes con almacenes para registro automático de cajas

-- Agregar columna warehouse_id
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

-- Índice para mejorar queries por almacén
CREATE INDEX IF NOT EXISTS idx_package_orders_warehouse
ON package_orders(warehouse_id);

-- Comentario para documentación
COMMENT ON COLUMN package_orders.warehouse_id IS 'Almacén desde donde se procesa la orden de oficina';
