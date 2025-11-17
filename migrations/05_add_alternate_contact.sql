-- ============================================
-- MIGRACIÓN 05: AGREGAR CAMPOS DE CONTACTO ALTERNATIVO
-- ============================================
-- Fecha: 2025-11-14
-- Propósito: Agregar campos para contacto alternativo en tabla customers
-- ============================================

-- ============================================
-- AGREGAR COLUMNAS A TABLA CUSTOMERS
-- ============================================

-- Campos de contacto alternativo
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS has_alternate_contact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS alternate_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS alternate_contact_phone VARCHAR(50);

-- ============================================
-- ACTUALIZAR TABLA DE HISTORIAL DE CAMBIOS
-- ============================================

-- Agregar comentario descriptivo
COMMENT ON COLUMN customers.has_alternate_contact IS 'Indica si el cliente tiene un contacto alternativo';
COMMENT ON COLUMN customers.alternate_contact_name IS 'Nombre del contacto alternativo';
COMMENT ON COLUMN customers.alternate_contact_phone IS 'Teléfono del contacto alternativo';

-- ============================================
-- ÍNDICE PARA BÚSQUEDA DE CONTACTOS ALTERNATIVOS
-- ============================================

-- Índice para clientes con contacto alternativo activo
CREATE INDEX IF NOT EXISTS idx_customers_has_alternate_contact
ON customers(has_alternate_contact)
WHERE has_alternate_contact = true;

-- Índice trigram para búsqueda por nombre de contacto alternativo
CREATE INDEX IF NOT EXISTS idx_customers_alternate_contact_name_trgm
ON customers USING gin (alternate_contact_name gin_trgm_ops)
WHERE alternate_contact_name IS NOT NULL;

-- ============================================
-- ACTUALIZAR ESTADÍSTICAS
-- ============================================

ANALYZE customers;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que las columnas se agregaron correctamente
-- Ejecutar en consola SQL:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'customers'
-- AND column_name IN ('has_alternate_contact', 'alternate_contact_name', 'alternate_contact_phone')
-- ORDER BY column_name;

-- ============================================
-- NOTAS
-- ============================================

/*
CAMPOS AGREGADOS:

1. has_alternate_contact (BOOLEAN):
   - Por defecto: false
   - Controla si se muestra/usa el contacto alternativo

2. alternate_contact_name (VARCHAR(255)):
   - Nombre completo del contacto alternativo
   - Opcional (NULL permitido)

3. alternate_contact_phone (VARCHAR(50)):
   - Teléfono del contacto alternativo
   - Opcional (NULL permitido)

NOTA: Los campos idType e idNumber ya existen en la tabla customers
desde la migración inicial, por lo que no necesitan ser agregados.

USO:
- Cuando has_alternate_contact = true, los campos de nombre y teléfono
  deben estar poblados
- Cuando has_alternate_contact = false, los campos pueden ser NULL
*/
