-- Migration: Eliminar restricción UNIQUE de subdomain
-- Las sucursales ahora usan el MISMO subdominio que su empresa matriz
-- Por lo tanto, múltiples empresas (matriz + sucursales) pueden tener el mismo subdomain

-- 1. Eliminar la restricción UNIQUE del campo subdomain
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS companies_subdomain_key;

-- 2. El índice idx_companies_subdomain ya existe y seguirá funcionando para búsquedas
-- No necesita ser modificado ya que no es UNIQUE

-- Nota: Ahora múltiples empresas (una matriz y sus sucursales) pueden compartir el mismo subdomain
-- El sistema identifica la empresa específica mediante company_id en user_companies
