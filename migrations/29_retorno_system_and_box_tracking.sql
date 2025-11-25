-- Migration: Sistema de Retorno y Tracking de Cajas
-- Fecha: 2025-11-24
-- Descripción: Implementa sistema para tracking de entregas de cajas vacías y sus retornos

-- =====================================================
-- PARTE 1: EXTENDER TABLA package_orders
-- =====================================================

-- Agregar columnas para tracking de retorno
DO $$
BEGIN
    -- parent_order_id: Referencia a orden de entrega original
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_orders' AND column_name = 'parent_order_id'
    ) THEN
        ALTER TABLE package_orders ADD COLUMN parent_order_id INTEGER REFERENCES package_orders(id);
        CREATE INDEX idx_package_orders_parent ON package_orders(parent_order_id);
    END IF;

    -- boxes_delivered: Cantidad de cajas entregadas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_orders' AND column_name = 'boxes_delivered'
    ) THEN
        ALTER TABLE package_orders ADD COLUMN boxes_delivered INTEGER DEFAULT 0;
    END IF;

    -- boxes_returned: Cantidad de cajas retornadas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_orders' AND column_name = 'boxes_returned'
    ) THEN
        ALTER TABLE package_orders ADD COLUMN boxes_returned INTEGER DEFAULT 0;
    END IF;

    -- pending_return: Indica si tiene retorno pendiente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_orders' AND column_name = 'pending_return'
    ) THEN
        ALTER TABLE package_orders ADD COLUMN pending_return BOOLEAN DEFAULT FALSE;
    END IF;

    -- return_status: Estado del retorno (none, pending, partial, complete)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_orders' AND column_name = 'return_status'
    ) THEN
        ALTER TABLE package_orders ADD COLUMN return_status VARCHAR(50) DEFAULT 'none';
    END IF;
END $$;

-- =====================================================
-- PARTE 2: EXTENDER TABLA empaques
-- =====================================================

DO $$
BEGIN
    -- delivery_order_id: Orden de entrega de caja vacía
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empaques' AND column_name = 'delivery_order_id'
    ) THEN
        ALTER TABLE empaques ADD COLUMN delivery_order_id INTEGER REFERENCES package_orders(id);
    END IF;

    -- return_order_id: Orden de retorno (recogida de caja llena)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empaques' AND column_name = 'return_order_id'
    ) THEN
        ALTER TABLE empaques ADD COLUMN return_order_id INTEGER REFERENCES package_orders(id);
    END IF;

    -- box_type: Tipo de caja (pequeña, mediana, grande)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empaques' AND column_name = 'box_type'
    ) THEN
        ALTER TABLE empaques ADD COLUMN box_type VARCHAR(50);
    END IF;

    -- delivered_at: Fecha de entrega de caja vacía
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empaques' AND column_name = 'delivered_at'
    ) THEN
        ALTER TABLE empaques ADD COLUMN delivered_at TIMESTAMP;
    END IF;

    -- returned_at: Fecha de retorno (recogida llena)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empaques' AND column_name = 'returned_at'
    ) THEN
        ALTER TABLE empaques ADD COLUMN returned_at TIMESTAMP;
    END IF;
END $$;

-- =====================================================
-- PARTE 3: NUEVA TABLA box_inventory
-- =====================================================

CREATE TABLE IF NOT EXISTS box_inventory (
    id SERIAL PRIMARY KEY,
    box_code VARCHAR(100) UNIQUE NOT NULL,
    box_type VARCHAR(50) NOT NULL,
    current_status VARCHAR(50) NOT NULL DEFAULT 'available',
    current_location VARCHAR(255),
    company_id INTEGER NOT NULL,
    delivery_order_id INTEGER REFERENCES package_orders(id),
    return_order_id INTEGER REFERENCES package_orders(id),
    customer_id INTEGER REFERENCES customers(id),
    delivered_at TIMESTAMP,
    returned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para box_inventory
CREATE INDEX IF NOT EXISTS idx_box_inventory_status ON box_inventory(current_status);
CREATE INDEX IF NOT EXISTS idx_box_inventory_company ON box_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_box_inventory_customer ON box_inventory(customer_id);
CREATE INDEX IF NOT EXISTS idx_box_inventory_delivery_order ON box_inventory(delivery_order_id);

-- =====================================================
-- PARTE 4: TABLA customer_transactions (HISTORIAL CRM)
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    transaction_type VARCHAR(50) NOT NULL,
    order_id INTEGER REFERENCES package_orders(id),
    order_number VARCHAR(100),
    service_name VARCHAR(255),
    amount DECIMAL(10, 2),
    status VARCHAR(50),
    transaction_date TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    details JSONB,
    company_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    created_by_user_name VARCHAR(255)
);

-- Índices para customer_transactions
CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer ON customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_type ON customer_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_company ON customer_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_date ON customer_transactions(transaction_date DESC);

-- =====================================================
-- PARTE 5: NUEVOS ESTADOS PARA EMPAQUES
-- =====================================================

-- Comentarios para documentar nuevos estados de empaques
COMMENT ON COLUMN empaques.estado IS 'Estados posibles:
- disponible: En almacén, disponible
- vacia_almacen: Caja vacía en bodega
- entregada_vacia: Entregada vacía al cliente
- en_cliente_vacia: En poder del cliente (vacía)
- en_cliente_llena: Cliente la llenó, pendiente retorno
- retorno_programado: Programada para recogida
- retorno_recogida: Recogida del cliente (llena)
- en_uso: En uso general
- en_transito: En tránsito
- entregado: Entregado al destino final';

-- =====================================================
-- PARTE 6: FUNCIÓN PARA ACTUALIZAR CONTADORES
-- =====================================================

-- Función para actualizar contadores de retorno automáticamente
CREATE OR REPLACE FUNCTION update_return_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se crea una orden de retorno, actualizar la orden padre
    IF NEW.parent_order_id IS NOT NULL AND NEW.order_type = 'retorno' THEN
        UPDATE package_orders
        SET
            boxes_returned = boxes_returned + NEW.boxes_delivered,
            return_status = CASE
                WHEN boxes_returned + NEW.boxes_delivered >= boxes_delivered THEN 'complete'
                WHEN boxes_returned + NEW.boxes_delivered > 0 THEN 'partial'
                ELSE 'pending'
            END,
            pending_return = CASE
                WHEN boxes_returned + NEW.boxes_delivered >= boxes_delivered THEN FALSE
                ELSE TRUE
            END
        WHERE id = NEW.parent_order_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar contadores
DROP TRIGGER IF EXISTS trigger_update_return_counters ON package_orders;
CREATE TRIGGER trigger_update_return_counters
    AFTER INSERT OR UPDATE ON package_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_return_counters();

-- =====================================================
-- PARTE 7: FUNCIÓN PARA REGISTRAR TRANSACCIONES
-- =====================================================

-- Función para registrar automáticamente transacciones del cliente
CREATE OR REPLACE FUNCTION log_customer_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar cuando la orden se completa
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        INSERT INTO customer_transactions (
            customer_id,
            transaction_type,
            order_id,
            order_number,
            service_name,
            amount,
            status,
            transaction_date,
            completed_at,
            details,
            company_id
        ) VALUES (
            NEW.sender_customer_id,
            NEW.order_type,
            NEW.id,
            NEW.order_number,
            COALESCE(NEW.services::text, 'Orden de paquete'),
            NEW.total_amount,
            'completed',
            NEW.created_at,
            NOW(),
            jsonb_build_object(
                'pickup_address', NEW.pickup_address,
                'delivery_address', NEW.delivery_address,
                'boxes_delivered', NEW.boxes_delivered,
                'boxes_returned', NEW.boxes_returned
            ),
            NEW.company_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar transacciones
DROP TRIGGER IF EXISTS trigger_log_customer_transaction ON package_orders;
CREATE TRIGGER trigger_log_customer_transaction
    AFTER INSERT OR UPDATE ON package_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_customer_transaction();

-- =====================================================
-- MENSAJES DE CONFIRMACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migración 29 completada exitosamente';
    RAISE NOTICE '📦 Sistema de retorno implementado';
    RAISE NOTICE '📊 Tracking de cajas configurado';
    RAISE NOTICE '👥 Historial de transacciones CRM creado';
END $$;
