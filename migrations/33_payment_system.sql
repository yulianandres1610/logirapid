-- Migration: Payment System for Package Orders
-- Date: 2025-12-03
-- Description: Add payment status tracking and payment history table

-- =============================================
-- 1. Add payment columns to package_orders
-- =============================================

-- payment_status: Estado del pago (pending_payment, paid, partial, refunded)
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending_payment';

-- paid_amount: Monto pagado hasta el momento
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0;

-- payment_confirmed_at: Fecha/hora cuando se confirmo el pago completo
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP NULL;

-- payment_confirmed_by: Usuario que confirmo el pago
ALTER TABLE package_orders
ADD COLUMN IF NOT EXISTS payment_confirmed_by INTEGER NULL;

-- =============================================
-- 2. Create order_payments table (payment history)
-- =============================================

CREATE TABLE IF NOT EXISTS order_payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES package_orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL,  -- cash, zelle, card, cod
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100),               -- Numero de confirmacion Zelle, etc.
  cash_received DECIMAL(15,2),          -- Para calcular cambio
  change_amount DECIMAL(15,2),          -- Cambio entregado
  notes TEXT,
  registered_by INTEGER NOT NULL,       -- user_id que registro
  registered_by_name VARCHAR(100),      -- nombre del usuario
  registered_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'dashboard', -- 'dashboard' o 'driver_app'
  company_id INTEGER NOT NULL
);

-- Index for faster queries by order_id
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);

-- Index for faster queries by company_id
CREATE INDEX IF NOT EXISTS idx_order_payments_company_id ON order_payments(company_id);

-- Index for faster queries by payment method
CREATE INDEX IF NOT EXISTS idx_order_payments_method ON order_payments(payment_method);

-- =============================================
-- 3. Add index for payment_status queries
-- =============================================

CREATE INDEX IF NOT EXISTS idx_package_orders_payment_status ON package_orders(payment_status);

-- =============================================
-- 4. Update existing orders: set payment_status based on paymentMethod
-- =============================================

-- Orders with COD should be pending_payment
UPDATE package_orders
SET payment_status = 'pending_payment'
WHERE paymentmethod = 'cod'
  AND payment_status IS NULL;

-- Orders with other payment methods that have totalAmount > 0
-- should also be pending_payment (they need to register the payment)
UPDATE package_orders
SET payment_status = 'pending_payment'
WHERE paymentmethod != 'cod'
  AND payment_status IS NULL
  AND totalamount > 0;

-- Orders with totalAmount = 0 are considered paid (no payment needed)
UPDATE package_orders
SET payment_status = 'paid'
WHERE payment_status IS NULL
  AND (totalamount = 0 OR totalamount IS NULL);
