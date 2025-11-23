-- Migración 25: Agregar soporte para sucursales (parent_company_id)
-- Permite que una empresa tenga empresas hijas (sucursales)

-- Agregar columna parent_company_id para relación empresa matriz-sucursal
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS parent_company_id INTEGER REFERENCES companies(id);

-- Agregar columna para identificar si es sucursal
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS is_branch BOOLEAN DEFAULT false;

-- Índice para búsquedas eficientes de sucursales por empresa matriz
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_company_id);

-- Comentarios para documentación
COMMENT ON COLUMN companies.parent_company_id IS 'ID de la empresa matriz. NULL si es empresa principal.';
COMMENT ON COLUMN companies.is_branch IS 'Indica si esta empresa es una sucursal de otra empresa';
