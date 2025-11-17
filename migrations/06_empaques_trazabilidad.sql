-- Migration 06: Crear tabla de trazabilidad de empaques
-- Fecha: 2025-01-15
-- Descripción: Sistema completo de auditoría y seguimiento de empaques

-- Eliminar tabla si existe para recrear con estructura correcta
DROP TABLE IF EXISTS empaques_trazabilidad CASCADE;

-- Crear tabla de trazabilidad
CREATE TABLE empaques_trazabilidad (
    id SERIAL PRIMARY KEY,
    empaque_id INTEGER NOT NULL REFERENCES empaques(id) ON DELETE CASCADE,
    accion VARCHAR(100) NOT NULL,
    orden_numero VARCHAR(100),
    servicio_nombre VARCHAR(255),
    ubicacion TEXT,
    warehouse_id INTEGER REFERENCES warehouses(id),
    warehouse_name VARCHAR(255),
    usuario_id INTEGER,
    usuario_nombre VARCHAR(255),
    notas TEXT,
    fecha TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_empaques_trazabilidad_empaque
ON empaques_trazabilidad(empaque_id);

CREATE INDEX idx_empaques_trazabilidad_fecha
ON empaques_trazabilidad(fecha DESC);

CREATE INDEX idx_empaques_trazabilidad_orden
ON empaques_trazabilidad(orden_numero);

CREATE INDEX idx_empaques_trazabilidad_accion
ON empaques_trazabilidad(accion);

-- Comentarios de documentación
COMMENT ON TABLE empaques_trazabilidad IS 'Registro de auditoría y seguimiento de empaques';
COMMENT ON COLUMN empaques_trazabilidad.accion IS 'Tipo de acción: creado, asignado_a_orden, cambio_estado_{estado}, actualizacion, liberado';
COMMENT ON COLUMN empaques_trazabilidad.orden_numero IS 'Número de orden asociada (ej: OFF-1736960000000)';
COMMENT ON COLUMN empaques_trazabilidad.servicio_nombre IS 'Nombre del servicio al que se asignó el empaque';

-- Agregar columnas faltantes a tabla empaques si no existen
ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS package_size_id INTEGER REFERENCES package_sizes(id);

ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(255);

ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER;

ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);

ALTER TABLE empaques
  ADD COLUMN IF NOT EXISTS label_setting_id INTEGER;

-- Índice para búsqueda rápida por código
CREATE INDEX IF NOT EXISTS idx_empaques_codigo
ON empaques(codigo);

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_empaques_estado
ON empaques(estado);

-- Índice para relación con órdenes
CREATE INDEX IF NOT EXISTS idx_empaques_orden
ON empaques(orden_id) WHERE orden_id IS NOT NULL;

-- Índice para relación con clientes
CREATE INDEX IF NOT EXISTS idx_empaques_cliente
ON empaques(cliente_id) WHERE cliente_id IS NOT NULL;

-- Vista para consulta rápida de empaques con detalles
CREATE OR REPLACE VIEW v_empaques_detalle AS
SELECT
    e.id,
    e.codigo,
    e.tipo,
    e.estado,
    ps.name as package_size_name,
    ps.dimensions,
    w.name as warehouse_name,
    w.city as warehouse_city,
    e.supplier_name,
    e.cliente_id,
    e.orden_id,
    e.fecha_asignacion,
    e.descripcion,
    e.created_at,
    e.updated_at
FROM empaques e
LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
LEFT JOIN warehouses w ON e.warehouse_id = w.id;

-- Vista para trazabilidad completa con detalles
CREATE OR REPLACE VIEW v_trazabilidad_completa AS
SELECT
    t.id,
    t.empaque_id,
    e.codigo as empaque_codigo,
    t.accion,
    t.orden_numero,
    t.servicio_nombre,
    t.ubicacion,
    t.warehouse_name,
    t.usuario_nombre,
    t.notas,
    t.fecha
FROM empaques_trazabilidad t
INNER JOIN empaques e ON t.empaque_id = e.id
ORDER BY t.fecha DESC;

-- Función para registrar trazabilidad automáticamente
CREATE OR REPLACE FUNCTION registrar_trazabilidad_empaque()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar cambio de estado
    IF (TG_OP = 'UPDATE' AND OLD.estado <> NEW.estado) THEN
        INSERT INTO empaques_trazabilidad (
            empaque_id,
            accion,
            ubicacion,
            warehouse_id,
            warehouse_name,
            notas
        ) VALUES (
            NEW.id,
            'cambio_estado_' || NEW.estado,
            'Sistema automático',
            NEW.warehouse_id,
            NEW.warehouse_name,
            'Estado cambiado de ' || OLD.estado || ' a ' || NEW.estado
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar cambios de estado automáticamente
DROP TRIGGER IF EXISTS trigger_trazabilidad_estado ON empaques;
CREATE TRIGGER trigger_trazabilidad_estado
    AFTER UPDATE ON empaques
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION registrar_trazabilidad_empaque();

-- Comentarios finales
COMMENT ON VIEW v_empaques_detalle IS 'Vista con información completa de empaques incluyendo relaciones';
COMMENT ON VIEW v_trazabilidad_completa IS 'Vista con trazabilidad completa incluyendo código de empaque';
COMMENT ON FUNCTION registrar_trazabilidad_empaque() IS 'Función trigger para registrar automáticamente cambios de estado';
