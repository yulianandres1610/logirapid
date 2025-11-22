# Corrección: Subdominio de Sucursales

**Fecha:** 2025-11-22
**Estado:** ✅ Completado

## 📋 Cambio Solicitado

**ANTES (Incorrecto):**
- Las sucursales tenían `subdomain = NULL`
- Se eliminaba el subdominio de las sucursales

**AHORA (Correcto):**
- Las sucursales usan el **MISMO subdominio** que la empresa matriz
- El subdominio se **copia automáticamente** de la empresa matriz

## 🎯 Razón del Cambio

Las sucursales deben acceder al sistema usando la **misma URL** que su empresa matriz, por lo que necesitan tener el mismo subdominio almacenado en la base de datos.

**Ejemplo:**
```
Empresa Matriz: Acme Logistics
- Subdominio: acme
- URL: https://acme.logirapid.com

Sucursal 1: Acme Miami
- Subdominio: acme (copiado de la matriz)
- URL: https://acme.logirapid.com (misma que la matriz)

Sucursal 2: Acme Dallas
- Subdominio: acme (copiado de la matriz)
- URL: https://acme.logirapid.com (misma que la matriz)
```

Todos acceden por la misma URL, y el sistema identifica la sucursal específica después del login basándose en `user_companies.company_id`.

## 🔧 Archivos Modificados

### 1. `/src/lib/branch-utils.ts`

**Función Agregada:**
```typescript
export async function getParentSubdomain(parentId: number): Promise<string | null> {
  try {
    const parentConfig = await getParentCompanyConfig(parentId)
    return parentConfig.subdomain || null
  } catch (error) {
    console.error('Error obteniendo subdominio de empresa matriz:', error)
    return null
  }
}
```

**Función Renombrada:**
```typescript
// ANTES:
cleanBranchSubdomains() // Establecía subdomain = NULL

// AHORA:
syncBranchSubdomains() // Copia subdomain de la empresa matriz
```

### 2. `/src/app/api/companies/route.ts`

**ANTES:**
```typescript
// 3. Las sucursales NO tienen subdominio propio (usan el de la empresa matriz)
finalSubdomain = null
console.log('[BRANCH] Subdominio establecido como NULL (usará el de la empresa matriz)')
```

**AHORA:**
```typescript
// 3. Las sucursales usan el MISMO subdominio que la empresa matriz
const parentSubdomain = await getParentSubdomain(parentCompanyId)
finalSubdomain = parentSubdomain
console.log(`[BRANCH] Subdominio copiado de empresa matriz: ${finalSubdomain}`)
```

### 3. `/migrations/26_update_branches_inherit_from_parent.sql`

**ANTES:**
```sql
-- 1. Limpiar subdominios de sucursales (las sucursales usan el dominio de la empresa matriz)
UPDATE companies
SET subdomain = NULL,
    updated_at = NOW()
WHERE is_branch = true
  AND subdomain IS NOT NULL;
```

**AHORA:**
```sql
-- 1. Copiar subdominios de empresa matriz a sucursales
-- Las sucursales usan el MISMO subdominio que su empresa matriz
UPDATE companies AS branch
SET subdomain = parent.subdomain,
    updated_at = NOW()
FROM companies AS parent
WHERE branch.is_branch = true
  AND branch.parent_company_id = parent.id
  AND branch.parent_company_id IS NOT NULL
  AND (branch.subdomain IS NULL OR branch.subdomain != parent.subdomain);
```

## 📊 Impacto del Cambio

### Base de Datos:
```sql
-- Tabla: companies

-- ANTES:
id | legalname      | subdomain | is_branch | parent_company_id
1  | Acme Logistics | acme      | false     | NULL
2  | Acme Miami     | NULL      | true      | 1
3  | Acme Dallas    | NULL      | true      | 1

-- AHORA:
id | legalname      | subdomain | is_branch | parent_company_id
1  | Acme Logistics | acme      | false     | NULL
2  | Acme Miami     | acme      | true      | 1      ← Copiado de matriz
3  | Acme Dallas    | acme      | true      | 1      ← Copiado de matriz
```

### Flujo de Creación:

**Al crear una nueva sucursal:**
1. ✅ Admin completa el formulario
2. ✅ Backend obtiene la empresa matriz
3. ✅ **Copia el subdominio de la empresa matriz**
4. ✅ Copia los fees de la empresa matriz
5. ✅ Valida los servicios contra la empresa matriz
6. ✅ Sucursal creada con el mismo subdominio

### Resolución de Acceso:

**Cuando un usuario accede a `https://acme.logirapid.com`:**
1. Sistema extrae el subdominio: `acme`
2. Busca en BD: `SELECT * FROM companies WHERE subdomain = 'acme'`
3. Encuentra múltiples coincidencias (matriz + sucursales)
4. Usuario inicia sesión
5. Sistema identifica la sucursal específica por `user_companies.company_id`
6. Usuario accede a su sucursal correspondiente

## ✅ Validación

### Verificar la Corrección:

```sql
-- 1. Ver subdominios de empresas y sucursales
SELECT
  id,
  legalname,
  subdomain,
  is_branch,
  parent_company_id
FROM companies
ORDER BY parent_company_id NULLS FIRST, id;

-- 2. Verificar que sucursales tengan el mismo subdominio que su matriz
SELECT
  branch.id AS branch_id,
  branch.legalname AS branch_name,
  branch.subdomain AS branch_subdomain,
  parent.subdomain AS parent_subdomain,
  CASE
    WHEN branch.subdomain = parent.subdomain THEN '✅ CORRECTO'
    ELSE '❌ DIFERENTE'
  END AS status
FROM companies AS branch
INNER JOIN companies AS parent ON branch.parent_company_id = parent.id
WHERE branch.is_branch = true;
```

## 📝 Documentación Actualizada

Todos los documentos han sido actualizados para reflejar que:
- ❌ NO: "subdomain = NULL"
- ✅ SÍ: "subdomain copiado de empresa matriz"

**Archivos actualizados:**
- `CAMBIOS_SISTEMA_SUCURSALES.md`
- `migrations/26_update_branches_inherit_from_parent.sql`
- `src/lib/branch-utils.ts`
- `src/app/api/companies/route.ts`

## 🚀 Estado Actual

✅ **Servidor funcionando correctamente**
- Puerto: 3000
- URL: http://localhost:3000
- Sin errores de compilación

✅ **Código actualizado**
- API copia subdominio automáticamente
- Utilidades actualizadas
- Migración SQL corregida

✅ **Listo para uso**
- Crear nuevas sucursales → subdominio se copia automáticamente
- Migrar sucursales existentes → ejecutar migración 26
- Acceso por mismo subdominio que empresa matriz

---

**Corrección completada exitosamente.** Las sucursales ahora heredan correctamente el subdominio de su empresa matriz. 🎉
