-- Migration 09: Delivery Orders System (Sistema de Entrega de Empaques Vacíos)
-- Adds support for tracking empty packaging deliveries to customers
-- Includes inventory control, new package states, and delivery order management

-- =====================================================
-- 1. CREATE EMPAQUE_INVENTORY TABLE
-- Tabla para controlar inventario de empaques vacíos por almacén
-- =====================================================

CREATE TABLE IF NOT EXISTS empaque_inventory (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  package_size_id INTEGER NOT NULL REFERENCES package_sizes(id) ON DELETE RESTRICT,

  -- Stock levels
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  assigned_delivery INTEGER NOT NULL DEFAULT 0 CHECK (assigned_delivery >= 0),
  in_use_customer INTEGER NOT NULL DEFAULT 0 CHECK (in_use_customer >= 0),

  -- Alerts and thresholds
  min_stock_alert INTEGER NOT NULL DEFAULT 10,
  max_stock_capacity INTEGER,
  reorder_point INTEGER NOT NULL DEFAULT 20,

  -- Tracking
  last_restock_date TIMESTAMP,
  last_restock_quantity INTEGER DEFAULT 0,
  last_restock_by_user_id INTEGER,
  last_restock_by_user_name VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,

  -- Ensure one inventory record per warehouse-package_size combination
  CONSTRAINT unique_warehouse_package_size UNIQUE (warehouse_id, package_size_id),

  -- Business rule: available cannot exceed total
  CONSTRAINT inventory_available_check CHECK (available_quantity <= total_quantity),

  -- Business rule: sum of assigned + in_use cannot exceed total
  CONSTRAINT inventory_allocated_check CHECK (assigned_delivery + in_use_customer <= total_quantity)
);

-- Índices para empaque_inventory
CREATE INDEX idx_empaque_inventory_warehouse ON empaque_inventory(warehouse_id);
CREATE INDEX idx_empaque_inventory_package_size ON empaque_inventory(package_size_id);
CREATE INDEX idx_empaque_inventory_low_stock ON empaque_inventory(warehouse_id)
  WHERE available_quantity <= min_stock_alert;

COMMENT ON TABLE empaque_inventory IS 'Control de inventario de empaques vacíos por almacén y tamaño';
COMMENT ON COLUMN empaque_inventory.available_quantity IS 'Cantidad disponible para asignar a órdenes de entrega';
COMMENT ON COLUMN empaque_inventory.assigned_delivery IS 'Cantidad asignada a órdenes de entrega pendientes';
COMMENT ON COLUMN empaque_inventory.in_use_customer IS 'Cantidad entregada a clientes y en uso';

-- =====================================================
-- 2. UPDATE EMPAQUES TABLE - Add delivery_order_id
-- Campo para vincular empaque con orden de entrega
-- =====================================================

DO $$
BEGIN
  -- Add delivery_order_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empaques' AND column_name = 'delivery_order_id'
  ) THEN
    ALTER TABLE empaques ADD COLUMN delivery_order_id INTEGER;
    ALTER TABLE empaques ADD COLUMN delivery_order_number VARCHAR(100);

    CREATE INDEX idx_empaques_delivery_order ON empaques(delivery_order_id) WHERE delivery_order_id IS NOT NULL;
    CREATE INDEX idx_empaques_delivery_order_number ON empaques(delivery_order_number) WHERE delivery_order_number IS NOT NULL;

    COMMENT ON COLUMN empaques.delivery_order_id IS 'ID de la orden de entrega asociada';
    COMMENT ON COLUMN empaques.delivery_order_number IS 'Número de la orden de entrega (para trazabilidad)';
  END IF;
END $$;

-- =====================================================
-- 3. UPDATE EMPAQUES ESTADO CONSTRAINT
-- Agregar nuevos estados para flujo de entrega de empaques vacíos
-- =====================================================

-- Drop existing constraint
ALTER TABLE empaques DROP CONSTRAINT IF EXISTS empaques_estado_check;

-- Add new constraint with all valid estados including delivery flow
ALTER TABLE empaques ADD CONSTRAINT empaques_estado_check
  CHECK (estado IN (
    -- Inventory states
    'disponible',           -- General available (legacy)
    'disponible_almacen',   -- Available in warehouse inventory (new)

    -- Delivery flow states (entrega de empaques vacíos)
    'asignado_entrega',     -- Assigned to delivery order
    'en_ruta_entrega',      -- Out for delivery to customer
    'entregado_cliente',    -- Delivered to customer (empty)
    'en_uso_cliente',       -- In use by customer (being filled)

    -- Pickup flow states (recogida de paquetes llenos)
    'asignado',             -- Assigned to pickup order
    'recogida',             -- Picked up from customer
    'en_almacen',           -- Received at warehouse
    'en_transito',          -- In transit between warehouses
    'recibido_destino',     -- Received at destination warehouse
    'en_reparto',           -- Out for final delivery
    'entregado'             -- Delivered to final recipient
  ));

COMMENT ON CONSTRAINT empaques_estado_check ON empaques IS
  'Valid estados - Delivery flow: disponible_almacen → asignado_entrega → en_ruta_entrega → entregado_cliente → en_uso_cliente;
   Pickup flow: asignado → recogida → en_almacen → en_transito → recibido_destino → en_reparto → entregado';

-- =====================================================
-- 4. UPDATE PACKAGE_ORDERS - Add delivery order type
-- Soporte para order_type = 'entrega_empaques'
-- =====================================================

-- No need to alter table, just document new order_type value
COMMENT ON COLUMN package_orders.order_type IS
  'Tipo de orden: recogida (pickup), oficina (office), entrega_empaques (delivery)';

-- =====================================================
-- 5. CREATE INVENTORY MOVEMENT TRIGGER
-- Trigger para actualizar inventario automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_empaque_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_package_size_id INTEGER;
  v_warehouse_id INTEGER;
BEGIN
  -- Get package_size_id and warehouse_id from the empaque
  SELECT package_size_id, warehouse_id INTO v_package_size_id, v_warehouse_id
  FROM empaques WHERE id = NEW.id;

  -- Skip if no inventory record exists
  IF NOT EXISTS (
    SELECT 1 FROM empaque_inventory
    WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Handle INSERT or UPDATE
  IF (TG_OP = 'INSERT' AND NEW.estado = 'disponible_almacen') THEN
    -- New empaque added to inventory
    UPDATE empaque_inventory SET
      total_quantity = total_quantity + 1,
      available_quantity = available_quantity + 1,
      updated_at = NOW()
    WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;

  ELSIF (TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado) THEN
    -- Estado change - update counters

    -- From disponible_almacen to asignado_entrega
    IF OLD.estado = 'disponible_almacen' AND NEW.estado = 'asignado_entrega' THEN
      UPDATE empaque_inventory SET
        available_quantity = available_quantity - 1,
        assigned_delivery = assigned_delivery + 1,
        updated_at = NOW()
      WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;

    -- From asignado_entrega to entregado_cliente
    ELSIF OLD.estado = 'asignado_entrega' AND NEW.estado IN ('en_ruta_entrega', 'entregado_cliente') THEN
      UPDATE empaque_inventory SET
        assigned_delivery = assigned_delivery - 1,
        in_use_customer = in_use_customer + 1,
        updated_at = NOW()
      WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;

    -- From entregado_cliente back to asignado (pickup order)
    ELSIF OLD.estado IN ('entregado_cliente', 'en_uso_cliente') AND NEW.estado = 'asignado' THEN
      UPDATE empaque_inventory SET
        in_use_customer = in_use_customer - 1,
        updated_at = NOW()
      WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;

    -- Return to inventory (cancelled delivery)
    ELSIF NEW.estado = 'disponible_almacen' AND OLD.estado != 'disponible_almacen' THEN
      -- Decrease previous counter
      IF OLD.estado = 'asignado_entrega' THEN
        UPDATE empaque_inventory SET assigned_delivery = assigned_delivery - 1
        WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;
      ELSIF OLD.estado IN ('entregado_cliente', 'en_uso_cliente') THEN
        UPDATE empaque_inventory SET in_use_customer = in_use_customer - 1
        WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;
      END IF;

      -- Increase available
      UPDATE empaque_inventory SET
        available_quantity = available_quantity + 1,
        updated_at = NOW()
      WHERE warehouse_id = v_warehouse_id AND package_size_id = v_package_size_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_empaque_inventory ON empaques;
CREATE TRIGGER trigger_update_empaque_inventory
  AFTER INSERT OR UPDATE ON empaques
  FOR EACH ROW
  EXECUTE FUNCTION update_empaque_inventory();

COMMENT ON FUNCTION update_empaque_inventory() IS
  'Actualiza automáticamente los contadores de inventario cuando cambia el estado de un empaque';

-- =====================================================
-- 6. CREATE INVENTORY HELPER FUNCTIONS
-- Funciones auxiliares para gestión de inventario
-- =====================================================

-- Function to initialize inventory for a warehouse-package_size combination
CREATE OR REPLACE FUNCTION initialize_empaque_inventory(
  p_warehouse_id INTEGER,
  p_package_size_id INTEGER,
  p_initial_quantity INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  v_inventory_id INTEGER;
BEGIN
  INSERT INTO empaque_inventory (
    warehouse_id,
    package_size_id,
    total_quantity,
    available_quantity
  )
  VALUES (
    p_warehouse_id,
    p_package_size_id,
    p_initial_quantity,
    p_initial_quantity
  )
  ON CONFLICT (warehouse_id, package_size_id) DO UPDATE SET
    total_quantity = empaque_inventory.total_quantity + p_initial_quantity,
    available_quantity = empaque_inventory.available_quantity + p_initial_quantity,
    updated_at = NOW()
  RETURNING id INTO v_inventory_id;

  RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_empaque_inventory IS
  'Inicializa o actualiza el inventario de un almacén para un tamaño de empaque específico';

-- Function to check if enough inventory is available
CREATE OR REPLACE FUNCTION check_empaque_availability(
  p_warehouse_id INTEGER,
  p_package_size_id INTEGER,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT available_quantity INTO v_available
  FROM empaque_inventory
  WHERE warehouse_id = p_warehouse_id
    AND package_size_id = p_package_size_id;

  RETURN COALESCE(v_available, 0) >= p_quantity;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_empaque_availability IS
  'Verifica si hay suficiente inventario disponible para una solicitud';

-- =====================================================
-- 7. CREATE VIEW FOR INVENTORY SUMMARY
-- Vista para resumen de inventario
-- =====================================================

CREATE OR REPLACE VIEW v_empaque_inventory_summary AS
SELECT
  ei.id,
  ei.warehouse_id,
  w.name as warehouse_name,
  w.city as warehouse_city,
  ei.package_size_id,
  ps.name as package_size_name,
  ps.dimensions as package_dimensions,
  ps.weight as package_weight,
  ei.total_quantity,
  ei.available_quantity,
  ei.assigned_delivery,
  ei.in_use_customer,
  ei.min_stock_alert,
  ei.reorder_point,
  -- Calculated fields
  (ei.available_quantity <= ei.min_stock_alert) as is_low_stock,
  (ei.available_quantity <= ei.reorder_point) as needs_reorder,
  ROUND((ei.available_quantity::NUMERIC / NULLIF(ei.total_quantity, 0) * 100), 2) as availability_percentage,
  ei.last_restock_date,
  ei.last_restock_quantity,
  ei.created_at,
  ei.updated_at
FROM empaque_inventory ei
INNER JOIN warehouses w ON ei.warehouse_id = w.id
INNER JOIN package_sizes ps ON ei.package_size_id = ps.id
ORDER BY w.name, ps.name;

COMMENT ON VIEW v_empaque_inventory_summary IS
  'Vista resumen del inventario de empaques con métricas calculadas y alertas';

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- Índices adicionales para consultas frecuentes
-- =====================================================

-- Index for finding customer deliveries
CREATE INDEX IF NOT EXISTS idx_package_orders_delivery_type
  ON package_orders(order_type, customerid, createdat DESC)
  WHERE order_type = 'entrega_empaques';

-- Index for finding packages in customer use
CREATE INDEX IF NOT EXISTS idx_empaques_customer_use
  ON empaques(recipient_name, estado)
  WHERE estado IN ('entregado_cliente', 'en_uso_cliente');

-- =====================================================
-- 9. GRANT PERMISSIONS (if using role-based access)
-- =====================================================

-- Grant permissions to application role (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON empaque_inventory TO your_app_role;
-- GRANT SELECT ON v_empaque_inventory_summary TO your_app_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 09 completed successfully';
  RAISE NOTICE 'Created empaque_inventory table with auto-update triggers';
  RAISE NOTICE 'Added delivery flow estados to empaques';
  RAISE NOTICE 'Added delivery_order_id tracking to empaques';
  RAISE NOTICE 'Created inventory management helper functions';
  RAISE NOTICE 'Created v_empaque_inventory_summary view';
END $$;
