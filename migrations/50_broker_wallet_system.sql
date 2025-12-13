-- ============================================
-- MIGRACIÓN 50: SISTEMA DE WALLETS PARA BROKERS Y ÓRDENES DE REMESAS
-- ============================================
-- Fecha: 2025-12-13
-- Propósito: Sistema completo para cupones familiares/remesas con brokers
-- ============================================

-- ============================================
-- 1. BALANCES POR MONEDA PARA BROKERS
-- ============================================

CREATE TABLE IF NOT EXISTS broker_wallet_balances (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,  -- USD, CUP, EUR, MLC, etc.
  available_balance DECIMAL(15,2) DEFAULT 0,
  reserved_balance DECIMAL(15,2) DEFAULT 0,  -- Fondos bloqueados por órdenes pendientes
  total_balance DECIMAL(15,2) GENERATED ALWAYS AS (available_balance + reserved_balance) STORED,
  low_balance_threshold DECIMAL(15,2) DEFAULT 100,  -- Alerta cuando baja de este monto
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, currency)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_broker_wallet_company ON broker_wallet_balances(company_id);
CREATE INDEX IF NOT EXISTS idx_broker_wallet_currency ON broker_wallet_balances(currency);

COMMENT ON TABLE broker_wallet_balances IS 'Balances por moneda para cada empresa tipo broker';
COMMENT ON COLUMN broker_wallet_balances.available_balance IS 'Fondos disponibles para nuevas órdenes';
COMMENT ON COLUMN broker_wallet_balances.reserved_balance IS 'Fondos bloqueados por órdenes en proceso';
COMMENT ON COLUMN broker_wallet_balances.low_balance_threshold IS 'Umbral para alertas de saldo bajo';

-- ============================================
-- 2. RESERVAS/BLOQUEOS DE FONDOS
-- ============================================

CREATE TABLE IF NOT EXISTS broker_reservations (
  id SERIAL PRIMARY KEY,
  broker_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  remittance_order_id INTEGER,  -- FK se agregará después de crear remittance_orders
  currency VARCHAR(10) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'reserved',  -- reserved, released, completed, cancelled
  reserved_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP,
  released_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_reservations_broker ON broker_reservations(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_reservations_order ON broker_reservations(remittance_order_id);
CREATE INDEX IF NOT EXISTS idx_broker_reservations_status ON broker_reservations(status);

COMMENT ON TABLE broker_reservations IS 'Reservas de fondos para órdenes de remesas pendientes';
COMMENT ON COLUMN broker_reservations.status IS 'reserved=bloqueado, released=liberado sin usar, completed=entregado, cancelled=cancelado';

-- ============================================
-- 3. ÓRDENES DE REMESAS/CUPONES FAMILIARES
-- ============================================

CREATE TABLE IF NOT EXISTS remittance_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,  -- REM-2025-0001

  -- Empresa que vendió el servicio
  selling_company_id INTEGER NOT NULL REFERENCES companies(id),
  sold_by_user_id INTEGER REFERENCES users(id),

  -- Broker asignado para la entrega
  broker_company_id INTEGER REFERENCES companies(id),
  broker_province VARCHAR(100),
  broker_municipality VARCHAR(100),

  -- Producto/Servicio del catálogo
  product_id INTEGER REFERENCES product_catalog(id),
  product_name VARCHAR(255),
  service_type VARCHAR(50),  -- 'usd_cash', 'cup_cash', 'mlc_card', etc.

  -- Montos
  send_amount DECIMAL(15,2) NOT NULL,  -- Monto que envía el cliente
  send_currency VARCHAR(10) DEFAULT 'USD',  -- Moneda del envío
  receive_amount DECIMAL(15,2) NOT NULL,  -- Monto que recibe el destinatario
  receive_currency VARCHAR(10) NOT NULL,  -- USD, CUP, MLC
  exchange_rate DECIMAL(10,4) DEFAULT 1,  -- Tasa de cambio aplicada

  -- Costos y comisiones
  service_fee DECIMAL(15,2) DEFAULT 0,  -- Comisión del servicio (%)
  service_fee_percentage DECIMAL(5,2),  -- Porcentaje cobrado
  delivery_fee DECIMAL(15,2) DEFAULT 0,  -- Entrega a domicilio
  total_charged DECIMAL(15,2) NOT NULL,  -- Total cobrado al cliente

  -- Destinatario (Beneficiario en Cuba)
  recipient_name VARCHAR(255) NOT NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_id_number VARCHAR(50),  -- Carnet de identidad (11 dígitos)
  recipient_address TEXT,  -- Calle/Avenida con número
  recipient_neighborhood VARCHAR(100),  -- Reparto/Zona
  recipient_province VARCHAR(100) NOT NULL,
  recipient_municipality VARCHAR(100) NOT NULL,
  recipient_address_references TEXT,  -- Referencias adicionales para el broker

  -- Contacto alternativo del destinatario
  has_alternate_contact BOOLEAN DEFAULT FALSE,
  alternate_contact_name VARCHAR(255),
  alternate_contact_phone VARCHAR(50),

  -- Remitente (quien paga en la agencia)
  sender_name VARCHAR(255) NOT NULL,
  sender_phone VARCHAR(50),
  sender_email VARCHAR(255),
  sender_id_type VARCHAR(50),  -- passport, license, id_card
  sender_id_number VARCHAR(50),

  -- Estado y fechas
  status VARCHAR(30) DEFAULT 'pending',
  -- pending, confirmed, in_delivery, delivered, cancelled, failed
  payment_status VARCHAR(30) DEFAULT 'pending',
  -- pending, paid, refunded
  estimated_delivery VARCHAR(50),  -- '1-24 horas' o '1-3 días'

  scheduled_date DATE,
  confirmed_at TIMESTAMP,
  in_delivery_at TIMESTAMP,
  delivered_at TIMESTAMP,
  delivered_by_user_id INTEGER REFERENCES users(id),
  cancelled_at TIMESTAMP,
  cancelled_by_user_id INTEGER REFERENCES users(id),
  cancellation_reason TEXT,

  -- Pago del cliente
  payment_method VARCHAR(50),  -- cash, zelle, card, transfer
  payment_reference VARCHAR(100),
  cash_received DECIMAL(15,2),  -- Si pago en efectivo
  cash_change DECIMAL(15,2),  -- Cambio a devolver

  -- Notificaciones
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,

  -- Prueba de entrega
  delivery_proof_photo TEXT,  -- URL o base64
  delivery_signature TEXT,  -- Base64 de firma digital
  delivery_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas y filtros
CREATE INDEX IF NOT EXISTS idx_remittance_orders_number ON remittance_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_selling_company ON remittance_orders(selling_company_id);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_broker ON remittance_orders(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_status ON remittance_orders(status);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_payment_status ON remittance_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_province ON remittance_orders(recipient_province);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_municipality ON remittance_orders(recipient_municipality);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_created ON remittance_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remittance_orders_recipient_phone ON remittance_orders(recipient_phone);

COMMENT ON TABLE remittance_orders IS 'Órdenes de remesas/cupones familiares';
COMMENT ON COLUMN remittance_orders.estimated_delivery IS '1-24 horas si hay fondos, 1-3 días si no hay';

-- ============================================
-- 4. HISTORIAL DE MOVIMIENTOS DEL BROKER
-- ============================================

CREATE TABLE IF NOT EXISTS broker_wallet_transactions (
  id SERIAL PRIMARY KEY,
  broker_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,
  transaction_type VARCHAR(30) NOT NULL,
  -- deposit, withdrawal, reservation, release, delivery, refund, adjustment
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  reserved_before DECIMAL(15,2) DEFAULT 0,
  reserved_after DECIMAL(15,2) DEFAULT 0,
  reference_type VARCHAR(50),  -- 'remittance_order', 'manual_deposit', 'manual_withdrawal'
  reference_id INTEGER,  -- ID de la orden o transacción relacionada
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_transactions_company ON broker_wallet_transactions(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_transactions_currency ON broker_wallet_transactions(currency);
CREATE INDEX IF NOT EXISTS idx_broker_transactions_type ON broker_wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_broker_transactions_ref ON broker_wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_broker_transactions_created ON broker_wallet_transactions(created_at DESC);

COMMENT ON TABLE broker_wallet_transactions IS 'Historial de todos los movimientos de wallets de brokers';

-- ============================================
-- 5. AGREGAR CAMPOS A COMPANIES PARA BROKERS
-- ============================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_province VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_municipality VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_coverage_area JSONB;  -- Array de áreas de cobertura
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_delivery_hours VARCHAR(100);  -- "9:00-18:00"
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_contact_phone VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_max_daily_amount DECIMAL(15,2);  -- Límite diario

COMMENT ON COLUMN companies.broker_province IS 'Provincia donde opera el broker (Cuba)';
COMMENT ON COLUMN companies.broker_municipality IS 'Municipio principal del broker';
COMMENT ON COLUMN companies.broker_coverage_area IS 'JSON con municipios/zonas de cobertura';
COMMENT ON COLUMN companies.broker_delivery_hours IS 'Horario de entrega (ej: 9:00-18:00)';
COMMENT ON COLUMN companies.broker_is_active IS 'Si el broker está activo para recibir órdenes';

-- Índice para buscar brokers por ubicación
CREATE INDEX IF NOT EXISTS idx_companies_broker_province ON companies(broker_province) WHERE companytype = 'broker';
CREATE INDEX IF NOT EXISTS idx_companies_broker_municipality ON companies(broker_municipality) WHERE companytype = 'broker';

-- ============================================
-- 6. AGREGAR FK A BROKER_RESERVATIONS
-- ============================================

-- Agregar FK ahora que la tabla remittance_orders existe
ALTER TABLE broker_reservations
  DROP CONSTRAINT IF EXISTS broker_reservations_remittance_order_fk;

ALTER TABLE broker_reservations
  ADD CONSTRAINT broker_reservations_remittance_order_fk
  FOREIGN KEY (remittance_order_id)
  REFERENCES remittance_orders(id) ON DELETE SET NULL;

-- ============================================
-- 7. FUNCIÓN PARA GENERAR NÚMERO DE ORDEN
-- ============================================

CREATE OR REPLACE FUNCTION generate_remittance_order_number()
RETURNS VARCHAR AS $$
DECLARE
  current_year VARCHAR(4);
  seq_num INTEGER;
  order_num VARCHAR(50);
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Obtener el siguiente número de secuencia para el año actual
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 10 FOR 4) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM remittance_orders
  WHERE order_number LIKE 'REM-' || current_year || '-%';

  -- Formatear: REM-2025-0001
  order_num := 'REM-' || current_year || '-' || LPAD(seq_num::TEXT, 4, '0');

  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGER PARA AUTO-ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_remittance_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS remittance_orders_updated_at ON remittance_orders;
CREATE TRIGGER remittance_orders_updated_at
  BEFORE UPDATE ON remittance_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_remittance_order_timestamp();

-- ============================================
-- 9. FUNCIÓN PARA RESERVAR FONDOS
-- ============================================

CREATE OR REPLACE FUNCTION reserve_broker_funds(
  p_broker_company_id INTEGER,
  p_currency VARCHAR(10),
  p_amount DECIMAL(15,2),
  p_remittance_order_id INTEGER,
  p_created_by INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_available DECIMAL(15,2);
  v_balance_before DECIMAL(15,2);
  v_reserved_before DECIMAL(15,2);
BEGIN
  -- Bloquear la fila del balance para evitar race conditions
  SELECT available_balance, reserved_balance
  INTO v_available, v_reserved_before
  FROM broker_wallet_balances
  WHERE company_id = p_broker_company_id AND currency = p_currency
  FOR UPDATE;

  -- Si no hay registro, crearlo con balance 0
  IF NOT FOUND THEN
    INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
    VALUES (p_broker_company_id, p_currency, 0, 0);
    v_available := 0;
    v_reserved_before := 0;
  END IF;

  v_balance_before := v_available;

  -- Verificar fondos suficientes
  IF v_available < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Actualizar balance
  UPDATE broker_wallet_balances
  SET
    available_balance = available_balance - p_amount,
    reserved_balance = reserved_balance + p_amount,
    last_updated = NOW()
  WHERE company_id = p_broker_company_id AND currency = p_currency;

  -- Registrar la reserva
  INSERT INTO broker_reservations (
    broker_company_id, remittance_order_id, currency, amount, status
  ) VALUES (
    p_broker_company_id, p_remittance_order_id, p_currency, p_amount, 'reserved'
  );

  -- Registrar en historial
  INSERT INTO broker_wallet_transactions (
    broker_company_id, currency, transaction_type, amount,
    balance_before, balance_after, reserved_before, reserved_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    p_broker_company_id, p_currency, 'reservation', p_amount,
    v_balance_before, v_balance_before - p_amount,
    v_reserved_before, v_reserved_before + p_amount,
    'remittance_order', p_remittance_order_id,
    'Reserva de fondos para orden de remesa',
    p_created_by
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. FUNCIÓN PARA LIBERAR FONDOS (ENTREGA EXITOSA)
-- ============================================

CREATE OR REPLACE FUNCTION release_broker_funds_delivered(
  p_remittance_order_id INTEGER,
  p_released_by INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_reservation RECORD;
  v_available DECIMAL(15,2);
  v_reserved DECIMAL(15,2);
BEGIN
  -- Obtener la reserva activa
  SELECT * INTO v_reservation
  FROM broker_reservations
  WHERE remittance_order_id = p_remittance_order_id AND status = 'reserved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Obtener balances actuales
  SELECT available_balance, reserved_balance
  INTO v_available, v_reserved
  FROM broker_wallet_balances
  WHERE company_id = v_reservation.broker_company_id
    AND currency = v_reservation.currency
  FOR UPDATE;

  -- Reducir el balance reservado (los fondos se usaron)
  UPDATE broker_wallet_balances
  SET
    reserved_balance = reserved_balance - v_reservation.amount,
    last_updated = NOW()
  WHERE company_id = v_reservation.broker_company_id
    AND currency = v_reservation.currency;

  -- Actualizar la reserva
  UPDATE broker_reservations
  SET
    status = 'completed',
    released_at = NOW(),
    released_by = p_released_by
  WHERE id = v_reservation.id;

  -- Registrar en historial
  INSERT INTO broker_wallet_transactions (
    broker_company_id, currency, transaction_type, amount,
    balance_before, balance_after, reserved_before, reserved_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_reservation.broker_company_id, v_reservation.currency, 'delivery', v_reservation.amount,
    v_available, v_available,
    v_reserved, v_reserved - v_reservation.amount,
    'remittance_order', p_remittance_order_id,
    'Fondos utilizados para entrega completada',
    p_released_by
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. FUNCIÓN PARA CANCELAR/DEVOLVER FONDOS
-- ============================================

CREATE OR REPLACE FUNCTION release_broker_funds_cancelled(
  p_remittance_order_id INTEGER,
  p_released_by INTEGER,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_reservation RECORD;
  v_available DECIMAL(15,2);
  v_reserved DECIMAL(15,2);
BEGIN
  -- Obtener la reserva activa
  SELECT * INTO v_reservation
  FROM broker_reservations
  WHERE remittance_order_id = p_remittance_order_id AND status = 'reserved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Obtener balances actuales
  SELECT available_balance, reserved_balance
  INTO v_available, v_reserved
  FROM broker_wallet_balances
  WHERE company_id = v_reservation.broker_company_id
    AND currency = v_reservation.currency
  FOR UPDATE;

  -- Devolver fondos a disponible
  UPDATE broker_wallet_balances
  SET
    available_balance = available_balance + v_reservation.amount,
    reserved_balance = reserved_balance - v_reservation.amount,
    last_updated = NOW()
  WHERE company_id = v_reservation.broker_company_id
    AND currency = v_reservation.currency;

  -- Actualizar la reserva
  UPDATE broker_reservations
  SET
    status = 'cancelled',
    released_at = NOW(),
    released_by = p_released_by,
    notes = p_reason
  WHERE id = v_reservation.id;

  -- Registrar en historial
  INSERT INTO broker_wallet_transactions (
    broker_company_id, currency, transaction_type, amount,
    balance_before, balance_after, reserved_before, reserved_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_reservation.broker_company_id, v_reservation.currency, 'refund', v_reservation.amount,
    v_available, v_available + v_reservation.amount,
    v_reserved, v_reserved - v_reservation.amount,
    'remittance_order', p_remittance_order_id,
    COALESCE(p_reason, 'Orden cancelada - fondos devueltos a disponible'),
    p_released_by
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. ACTUALIZAR ESTADÍSTICAS
-- ============================================

ANALYZE broker_wallet_balances;
ANALYZE broker_reservations;
ANALYZE remittance_orders;
ANALYZE broker_wallet_transactions;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que las tablas se crearon correctamente:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'broker%' OR table_name = 'remittance_orders';

-- Verificar los nuevos campos en companies:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name LIKE 'broker%';
