-- Migration: Actualizar sucursales existentes para heredar configuración de empresa matriz
-- Las sucursales ya no configuran fees propios y usan el mismo subdominio que la empresa matriz

-- 1. Copiar configuración de contacto de empresa matriz a sucursales
-- Las sucursales usan el MISMO subdominio, teléfono de soporte y website que su empresa matriz
UPDATE companies AS branch
SET subdomain = parent.subdomain,
    customer_service_phone = parent.customer_service_phone,
    website = parent.website,
    updated_at = NOW()
FROM companies AS parent
WHERE branch.is_branch = true
  AND branch.parent_company_id = parent.id
  AND branch.parent_company_id IS NOT NULL
  AND (
    branch.subdomain IS NULL
    OR branch.subdomain != parent.subdomain
    OR branch.customer_service_phone IS DISTINCT FROM parent.customer_service_phone
    OR branch.website IS DISTINCT FROM parent.website
  );

-- 2. Actualizar fees de sucursales para heredar de su empresa matriz
-- Esto actualiza cada sucursal con los fees de su empresa parent
UPDATE companies AS branch
SET service_fees = parent.service_fees,
    updated_at = NOW()
FROM companies AS parent
WHERE branch.is_branch = true
  AND branch.parent_company_id = parent.id
  AND branch.parent_company_id IS NOT NULL;

-- 3. Crear índice para mejorar performance de consultas de sucursales
CREATE INDEX IF NOT EXISTS idx_companies_parent_company
ON companies(parent_company_id)
WHERE parent_company_id IS NOT NULL;

-- 4. Crear índice para búsquedas por is_branch
CREATE INDEX IF NOT EXISTS idx_companies_is_branch
ON companies(is_branch)
WHERE is_branch = true;

-- Log de la migración
DO $$
DECLARE
  branches_total INT;
  branches_subdomain_updated INT;
  branches_fees_updated INT;
BEGIN
  -- Contar total de sucursales
  SELECT COUNT(*) INTO branches_total
  FROM companies
  WHERE is_branch = true AND parent_company_id IS NOT NULL;

  -- Contar sucursales con subdominio copiado de matriz
  SELECT COUNT(*) INTO branches_subdomain_updated
  FROM companies AS branch
  INNER JOIN companies AS parent ON branch.parent_company_id = parent.id
  WHERE branch.is_branch = true
    AND branch.subdomain = parent.subdomain;

  -- Contar sucursales con fees actualizados
  SELECT COUNT(*) INTO branches_fees_updated
  FROM companies AS branch
  INNER JOIN companies AS parent ON branch.parent_company_id = parent.id
  WHERE branch.is_branch = true
    AND branch.service_fees::text = parent.service_fees::text;

  RAISE NOTICE '=== MIGRACIÓN 26: SUCURSALES ===';
  RAISE NOTICE 'Sucursales totales: %', branches_total;
  RAISE NOTICE 'Subdominios copiados de matriz: %', branches_subdomain_updated;
  RAISE NOTICE 'Fees heredados de matriz: %', branches_fees_updated;
  RAISE NOTICE 'Índices creados para mejor performance';
  RAISE NOTICE '====================================';
END $$;

-- Notas:
-- - Las sucursales ahora heredan service_fees automáticamente de su empresa matriz
-- - Los subdominios de sucursales se han copiado de la empresa matriz (usan el mismo)
-- - El teléfono de soporte se copia de la empresa matriz (mismo número de contacto)
-- - El website se copia de la empresa matriz (misma URL)
-- - Las sucursales accederán al sistema usando el MISMO subdominio que su empresa matriz
-- - Los usuarios seleccionarán la sucursal específica después de iniciar sesión
