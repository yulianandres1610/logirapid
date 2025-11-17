-- Migration 07: Sistema completo de trazabilidad de empaques
-- Agrega campos necesarios para tracking completo de paquetes de órdenes de oficina

-- 1. Agregar nuevos campos a tabla empaques para tracking de órdenes
DO $$
BEGIN
    -- Campos de orden y servicio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='order_number') THEN
        ALTER TABLE empaques ADD COLUMN order_number VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='service_name') THEN
        ALTER TABLE empaques ADD COLUMN service_name VARCHAR(255);
    END IF;

    -- Campos de destinatario
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='recipient_name') THEN
        ALTER TABLE empaques ADD COLUMN recipient_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='recipient_city') THEN
        ALTER TABLE empaques ADD COLUMN recipient_city VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='recipient_state') THEN
        ALTER TABLE empaques ADD COLUMN recipient_state VARCHAR(100);
    END IF;

    -- Campos de peso
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='weight_lb') THEN
        ALTER TABLE empaques ADD COLUMN weight_lb DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='weight_kg') THEN
        ALTER TABLE empaques ADD COLUMN weight_kg DECIMAL(10,2);
    END IF;

    -- Campos de número de bulto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='box_number') THEN
        ALTER TABLE empaques ADD COLUMN box_number INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='total_boxes') THEN
        ALTER TABLE empaques ADD COLUMN total_boxes INTEGER;
    END IF;

    -- Timestamp de última actualización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='updated_at') THEN
        ALTER TABLE empaques ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Campo para usuario que realizó última actualización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='updated_by_user_id') THEN
        ALTER TABLE empaques ADD COLUMN updated_by_user_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empaques' AND column_name='updated_by_user_name') THEN
        ALTER TABLE empaques ADD COLUMN updated_by_user_name VARCHAR(255);
    END IF;
END $$;

-- 2. Actualizar estados válidos de empaques
-- Nota: PostgreSQL no tiene ENUM por defecto, se usan CHECKs o se maneja en aplicación
-- Los nuevos estados serán:
-- - recogida: Bulto recogido/creado en almacén origen
-- - en_almacen: Recibido y procesado en almacén
-- - enviado: Enviado hacia otro almacén o destino
-- - recibido_destino: Recibido en almacén destino
-- - en_reparto: Asignado a ruta de entrega
-- - entregado: Entregado al destinatario final
-- También mantenemos: disponible, asignado (para empaques no usados en órdenes)

COMMENT ON COLUMN empaques.estado IS 'Estados: disponible, asignado, recogida, en_almacen, enviado, recibido_destino, en_reparto, entregado';

-- 3. Agregar índices para mejorar performance de búsquedas
CREATE INDEX IF NOT EXISTS idx_empaques_order_number ON empaques(order_number);
CREATE INDEX IF NOT EXISTS idx_empaques_warehouse_id ON empaques(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_empaques_estado ON empaques(estado);
CREATE INDEX IF NOT EXISTS idx_empaques_codigo ON empaques(codigo);
CREATE INDEX IF NOT EXISTS idx_empaques_recipient_name ON empaques(recipient_name);

-- 4. Agregar campos de almacén a package_orders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='package_orders' AND column_name='warehouse_id') THEN
        ALTER TABLE package_orders ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='package_orders' AND column_name='warehouse_name') THEN
        ALTER TABLE package_orders ADD COLUMN warehouse_name VARCHAR(255);
    END IF;
END $$;

-- 5. Crear índice en package_orders
CREATE INDEX IF NOT EXISTS idx_package_orders_warehouse_id ON package_orders(warehouse_id);

-- 6. Agregar comentarios para documentación
COMMENT ON COLUMN empaques.order_number IS 'Número de la orden de paquetería asociada';
COMMENT ON COLUMN empaques.service_name IS 'Nombre del servicio (Caja Pequeña, Mediana, etc.)';
COMMENT ON COLUMN empaques.recipient_name IS 'Nombre completo del destinatario';
COMMENT ON COLUMN empaques.recipient_city IS 'Ciudad de destino';
COMMENT ON COLUMN empaques.recipient_state IS 'Estado de destino';
COMMENT ON COLUMN empaques.weight_lb IS 'Peso del paquete en libras';
COMMENT ON COLUMN empaques.weight_kg IS 'Peso del paquete en kilogramos';
COMMENT ON COLUMN empaques.box_number IS 'Número de este bulto (ej: 1 de 3)';
COMMENT ON COLUMN empaques.total_boxes IS 'Total de bultos en la orden';
COMMENT ON COLUMN package_orders.warehouse_id IS 'ID del almacén donde se creó/recogió la orden';
COMMENT ON COLUMN package_orders.warehouse_name IS 'Nombre del almacén de origen';
