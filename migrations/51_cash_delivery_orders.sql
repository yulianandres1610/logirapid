-- ============================================
-- MIGRACIÓN 51: SISTEMA DE ENTREGA DE EFECTIVO A BROKERS CON OTP
-- ============================================
-- Fecha: 2025-12-14
-- Propósito: Órdenes de entrega de efectivo físico a brokers con validación OTP
-- ============================================

-- ============================================
-- 1. TABLA DE ÓRDENES DE ENTREGA DE EFECTIVO
-- ============================================

CREATE TABLE IF NOT EXISTS cash_delivery_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,  -- CDO-2025-0001

  -- Broker destino (quien recibe el efectivo)
  broker_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  broker_company_name VARCHAR(255),

  -- Repartidor asignado (quien lleva el efectivo)
  delivery_user_id INTEGER NOT NULL REFERENCES users(id),
  delivery_user_name VARCHAR(255) NOT NULL,
  delivery_user_phone VARCHAR(50) NOT NULL,

  -- Moneda y monto
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',  -- USD, EUR, CUP, etc.
  total_amount DECIMAL(15,2) NOT NULL,

  -- Nomenclatura de billetes (cuántos billetes de cada denominación)
  -- Ejemplo: {"100": 5, "50": 3, "20": 10, "10": 5, "5": 2, "1": 10}
  bill_denominations JSONB NOT NULL,
  total_bills INTEGER NOT NULL,  -- Total de billetes físicos

  -- Fechas
  deadline_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Estado de la orden
  status VARCHAR(30) DEFAULT 'pending',
  -- pending: orden creada, esperando que el repartidor salga
  -- in_transit: repartidor en camino
  -- pending_reception: broker inició el proceso de recepción
  -- validating: monto validado, esperando OTP
  -- completed: entrega completada, wallet acreditado
  -- cancelled: orden cancelada
  -- blocked: bloqueado por demasiados intentos fallidos de OTP

  -- Recepción por el broker
  received_bill_denominations JSONB,  -- Lo que el broker contó
  received_total_amount DECIMAL(15,2),
  reception_started_at TIMESTAMP,
  amount_matches BOOLEAN,

  -- Sistema OTP para validación
  otp_code VARCHAR(6),
  otp_sent_at TIMESTAMP,
  otp_expires_at TIMESTAMP,
  otp_attempts INTEGER DEFAULT 0,
  otp_max_attempts INTEGER DEFAULT 3,
  otp_resend_count INTEGER DEFAULT 0,
  otp_max_resends INTEGER DEFAULT 3,

  -- Completado
  completed_at TIMESTAMP,
  completed_by_user_id INTEGER REFERENCES users(id),

  -- Wallet transaction creada al completar
  wallet_transaction_id INTEGER,

  -- Creado por (admin que creó la orden)
  created_by_user_id INTEGER REFERENCES users(id),

  -- Notas adicionales
  notes TEXT,
  cancellation_reason TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cash_delivery_broker ON cash_delivery_orders(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_user ON cash_delivery_orders(delivery_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_status ON cash_delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_created ON cash_delivery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_deadline ON cash_delivery_orders(deadline_date);
CREATE INDEX IF NOT EXISTS idx_cash_delivery_number ON cash_delivery_orders(order_number);

-- Comentarios
COMMENT ON TABLE cash_delivery_orders IS 'Órdenes de entrega de efectivo físico a brokers con validación OTP';
COMMENT ON COLUMN cash_delivery_orders.bill_denominations IS 'JSON con cantidad de billetes por denominación: {"100": 5, "50": 3}';
COMMENT ON COLUMN cash_delivery_orders.otp_code IS 'Código OTP de 6 dígitos enviado al repartidor por SMS';
COMMENT ON COLUMN cash_delivery_orders.otp_expires_at IS 'El OTP expira 5 minutos después de enviarse';

-- ============================================
-- 2. FUNCIÓN PARA GENERAR NÚMERO DE ORDEN
-- ============================================

CREATE OR REPLACE FUNCTION generate_cash_delivery_order_number()
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
  FROM cash_delivery_orders
  WHERE order_number LIKE 'CDO-' || current_year || '-%';

  -- Formatear: CDO-2025-0001
  order_num := 'CDO-' || current_year || '-' || LPAD(seq_num::TEXT, 4, '0');

  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. FUNCIÓN PARA CALCULAR TOTAL DE BILLETES
-- ============================================

CREATE OR REPLACE FUNCTION calculate_bill_total(
  p_denominations JSONB
) RETURNS RECORD AS $$
DECLARE
  result RECORD;
  total_amount DECIMAL(15,2) := 0;
  total_bills INTEGER := 0;
  denomination TEXT;
  quantity INTEGER;
BEGIN
  FOR denomination, quantity IN SELECT * FROM jsonb_each_text(p_denominations)
  LOOP
    total_amount := total_amount + (CAST(denomination AS DECIMAL) * CAST(quantity AS INTEGER));
    total_bills := total_bills + CAST(quantity AS INTEGER);
  END LOOP;

  SELECT total_amount, total_bills INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. TRIGGER PARA AUTO-ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_cash_delivery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cash_delivery_orders_updated_at ON cash_delivery_orders;
CREATE TRIGGER cash_delivery_orders_updated_at
  BEFORE UPDATE ON cash_delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_delivery_timestamp();

-- ============================================
-- 5. FUNCIÓN PARA VALIDAR NOMENCLATURA
-- ============================================

CREATE OR REPLACE FUNCTION validate_cash_delivery_amounts(
  p_order_id INTEGER,
  p_received_denominations JSONB
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_expected_total DECIMAL(15,2);
  v_received_total DECIMAL(15,2) := 0;
  denomination TEXT;
  quantity INTEGER;
  result JSONB;
BEGIN
  -- Obtener la orden
  SELECT * INTO v_order
  FROM cash_delivery_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Orden no encontrada'
    );
  END IF;

  v_expected_total := v_order.total_amount;

  -- Calcular total recibido
  FOR denomination, quantity IN SELECT * FROM jsonb_each_text(p_received_denominations)
  LOOP
    v_received_total := v_received_total + (CAST(denomination AS DECIMAL) * CAST(quantity AS INTEGER));
  END LOOP;

  -- Actualizar la orden con los valores recibidos
  UPDATE cash_delivery_orders
  SET
    received_bill_denominations = p_received_denominations,
    received_total_amount = v_received_total,
    amount_matches = (v_expected_total = v_received_total)
  WHERE id = p_order_id;

  -- Retornar resultado
  IF v_expected_total = v_received_total THEN
    RETURN jsonb_build_object(
      'success', true,
      'matches', true,
      'expectedTotal', v_expected_total,
      'receivedTotal', v_received_total
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'matches', false,
      'expectedTotal', v_expected_total,
      'receivedTotal', v_received_total,
      'difference', v_received_total - v_expected_total
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FUNCIÓN PARA ACREDITAR WALLET AL COMPLETAR
-- ============================================

CREATE OR REPLACE FUNCTION complete_cash_delivery(
  p_order_id INTEGER,
  p_completed_by INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_balance_before DECIMAL(15,2);
  v_balance_after DECIMAL(15,2);
  v_transaction_id INTEGER;
BEGIN
  -- Obtener la orden
  SELECT * INTO v_order
  FROM cash_delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden ya completada');
  END IF;

  IF v_order.status = 'blocked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden bloqueada');
  END IF;

  -- Obtener o crear el wallet del broker
  INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
  VALUES (v_order.broker_company_id, v_order.currency, 0, 0)
  ON CONFLICT (company_id, currency) DO NOTHING;

  -- Obtener balance actual
  SELECT available_balance INTO v_balance_before
  FROM broker_wallet_balances
  WHERE company_id = v_order.broker_company_id AND currency = v_order.currency
  FOR UPDATE;

  v_balance_after := v_balance_before + v_order.total_amount;

  -- Acreditar el wallet
  UPDATE broker_wallet_balances
  SET
    available_balance = v_balance_after,
    last_updated = NOW()
  WHERE company_id = v_order.broker_company_id AND currency = v_order.currency;

  -- Registrar transacción
  INSERT INTO broker_wallet_transactions (
    broker_company_id, currency, transaction_type, amount,
    balance_before, balance_after, reserved_before, reserved_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    v_order.broker_company_id, v_order.currency, 'deposit', v_order.total_amount,
    v_balance_before, v_balance_after, 0, 0,
    'cash_delivery', p_order_id,
    'Depósito de efectivo - Orden ' || v_order.order_number,
    p_completed_by
  )
  RETURNING id INTO v_transaction_id;

  -- Marcar orden como completada
  UPDATE cash_delivery_orders
  SET
    status = 'completed',
    completed_at = NOW(),
    completed_by_user_id = p_completed_by,
    wallet_transaction_id = v_transaction_id
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after,
    'amountAdded', v_order.total_amount,
    'currency', v_order.currency,
    'transactionId', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. ACTUALIZAR ESTADÍSTICAS
-- ============================================

ANALYZE cash_delivery_orders;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que la tabla se creó correctamente:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cash_delivery_orders';

-- Probar la función de generación de número:
-- SELECT generate_cash_delivery_order_number();
