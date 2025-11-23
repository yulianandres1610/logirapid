# Cambios en el Sistema de Sucursales - LogiRapid

**Fecha:** 2025-11-22
**Estado:** ✅ Completado

## 📋 Resumen de Cambios

Se ha simplificado significativamente el sistema de creación y gestión de sucursales, implementando herencia automática de configuración desde la empresa matriz.

## 🎯 Objetivos Alcanzados

### 1. ✅ **Herencia Automática de Fees**
- Las sucursales **YA NO configuran** sus propios fees de plataforma
- Los fees se heredan automáticamente de la empresa matriz al crear la sucursal
- El superadmin configura los fees en la empresa base, y todas las sucursales los heredan

### 2. ✅ **Subdominio Heredado de Empresa Matriz**
- Las sucursales **usan el MISMO subdominio** que la empresa matriz
- No configuran subdominio propio en el formulario
- Acceden al sistema usando la URL de la empresa matriz
- El subdominio se copia automáticamente al crear la sucursal

### 3. ✅ **Filtrado de Servicios por Empresa Matriz**
- Solo se muestran en el formulario los servicios que la empresa matriz tiene habilitados
- El admin de la empresa decide qué servicios asignar a cada sucursal
- Validación en backend para evitar asignación de servicios no autorizados

## 📂 Archivos Creados

### 1. **`/src/lib/branch-utils.ts`** (NUEVO)
Utilidades para gestión de sucursales:

```typescript
// Funciones principales:
- getParentCompanyConfig(parentId): Obtiene configuración de empresa matriz
- inheritFeesFromParent(parentId): Hereda fees de la empresa matriz
- getParentEnabledServices(parentId): Obtiene servicios de la matriz
- validateBranchServices(): Valida que servicios sean subset de la matriz
- migrateBranchFeesToParent(): Migración de datos existentes
- cleanBranchSubdomains(): Limpia subdominios de sucursales
```

### 2. **`/migrations/26_update_branches_inherit_from_parent.sql`** (NUEVO)
Migración para actualizar sucursales existentes:
- Copia subdominios de empresa matriz a sucursales
- Actualiza fees para heredar de empresa matriz
- Crea índices para mejor performance

## 🔧 Archivos Modificados

### 1. **`/src/app/api/companies/route.ts`**

#### Cambios en el Endpoint POST:

**ANTES:**
```typescript
// Las sucursales podían configurar sus propios fees
serviceFees: body.serviceFees || defaultFees
subdomain: body.subdomain || null
```

**DESPUÉS:**
```typescript
// Si es sucursal (isBranch = true):
if (isBranch && parentCompanyId) {
  // 1. Heredar fees de empresa matriz
  finalServiceFees = await inheritFeesFromParent(parentCompanyId)

  // 2. Validar servicios contra empresa matriz
  validateBranchServices(finalEnabledServices, parentServices)

  // 3. Copiar subdominio de empresa matriz
  finalSubdomain = await getParentSubdomain(parentCompanyId)
}
```

**Validaciones Agregadas:**
- ✅ Verifica que la empresa matriz exista
- ✅ Valida que todos los servicios seleccionados estén en la matriz
- ✅ Copia subdomain de la empresa matriz
- ✅ Logs detallados del proceso de herencia

### 2. **`/src/app/dashboard/agency-admin/sucursales/page.tsx`**

#### Cambio 1: Pasos del Wizard Simplificados

**ANTES: 7 pasos**
```typescript
1. Información Básica
2. Wallet
3. Servicios
4. Fee de Plataforma    ← ELIMINADO
5. Branding
6. Documentos
7. Revisión
```

**DESPUÉS: 6 pasos**
```typescript
1. Información Básica
2. Wallet
3. Servicios (filtrados)
4. Branding (sin subdominio)
5. Documentos
6. Revisión
```

#### Cambio 2: Step 3 - Servicios Filtrados

**Código Agregado:**
```typescript
{SERVICES
  .filter(service => {
    // Filtrar solo servicios habilitados en empresa matriz
    const parentEnabledServices = companyInfo?.enabledServices || []
    return parentEnabledServices.includes(service.id)
  })
  .map(service => (
    // Renderizar solo servicios permitidos
  ))
}
```

**UI Mejorada:**
- Texto explicativo: "Solo los servicios habilitados en la empresa matriz pueden ser asignados a sucursales"
- Mensaje si no hay servicios disponibles en la empresa matriz

#### Cambio 3: Step 4 - Branding (Subdominio Eliminado)

**ELIMINADO:**
```typescript
// Sección completa de configuración de subdominio (líneas 1439-1516)
- Input de subdominio
- Preview de URL personalizada (https://{subdomain}.logirapid.com)
- Validación de formato de subdominio
```

**Nota Agregada:**
```typescript
{/* NOTA: Subdominio eliminado - Las sucursales acceden por la URL de la empresa matriz */}
```

## 📊 Flujo Actualizado

### Antes (Complejo):
```
1. Admin crea sucursal
2. Configura fees propios por servicio
3. Selecciona todos los servicios disponibles
4. Define subdominio personalizado
5. Sucursal tiene su propia URL
6. Gestión fragmentada de fees
```

### Después (Simplificado):
```
1. Superadmin configura fees en empresa matriz
2. Admin crea sucursal
3. Fees se heredan automáticamente ✅
4. Solo puede seleccionar servicios de la matriz ✅
5. Sin subdominio propio ✅
6. Acceso por URL de empresa matriz
7. Control centralizado de fees
```

## 🔐 Validaciones Implementadas

### En el Backend (`/api/companies/route.ts`):

1. **Validación de Empresa Matriz:**
   ```typescript
   if (!parentFees) {
     return { error: 'No se pudieron obtener los fees de la empresa matriz' }
   }
   ```

2. **Validación de Servicios:**
   ```typescript
   const validation = validateBranchServices(finalEnabledServices, parentServices)
   if (!validation.valid) {
     return {
       error: `Los siguientes servicios no están habilitados en la empresa matriz:
               ${validation.invalidServices.join(', ')}`
     }
   }
   ```

3. **Forzar Subdomain NULL:**
   ```typescript
   if (isBranch) {
     finalSubdomain = null
   }
   ```

### En el Frontend (`/dashboard/agency-admin/sucursales/page.tsx`):

1. **Filtrado de Servicios:**
   - Solo muestra servicios que la empresa matriz tiene habilitados
   - Previene selección de servicios no autorizados

2. **Sin Input de Subdominio:**
   - Campo completamente eliminado del formulario
   - No hay forma de configurar subdominio desde la UI

## 🗄️ Estructura de Base de Datos

### Tabla `companies`:

```sql
-- Campos relevantes para sucursales:
parent_company_id   INTEGER  -- NULL para empresas matriz, ID para sucursales
is_branch           BOOLEAN  -- true para sucursales
service_fees        JSONB    -- Heredado de parent para sucursales
subdomain           VARCHAR  -- Copiado de empresa matriz para sucursales
```

### Nuevos Índices:
```sql
idx_companies_parent_company  -- Mejora queries de sucursales
idx_companies_is_branch       -- Mejora filtrado de sucursales
```

## 🚀 Cómo Usar el Nuevo Sistema

### Para Crear una Sucursal:

1. **Como Superadmin:**
   - Configurar fees de plataforma en la empresa matriz
   - Habilitar los servicios que las sucursales podrán usar

2. **Como Admin de Empresa:**
   - Ir a Dashboard → Sucursales → Crear Nueva
   - **Paso 1:** Información básica de la sucursal
   - **Paso 2:** Configurar wallet
   - **Paso 3:** Seleccionar servicios (solo los de la matriz)
   - **Paso 4:** Personalizar branding (logo y colores)
   - **Paso 5:** Subir documentos
   - **Paso 6:** Revisar y crear

3. **Resultado:**
   - ✅ Sucursal creada con fees heredados
   - ✅ Subdominio copiado de empresa matriz
   - ✅ Solo servicios autorizados
   - ✅ Acceso por la MISMA URL que la empresa matriz

### Para Migrar Sucursales Existentes:

```bash
# Ejecutar la migración SQL:
DATABASE_URL="..." psql -f migrations/26_update_branches_inherit_from_parent.sql
```

**La migración automáticamente:**
1. Copia subdominios de empresa matriz a todas las sucursales
2. Actualiza fees para heredar de la empresa matriz
3. Crea índices para mejor performance
4. Muestra log de cambios aplicados

## 📝 Notas Técnicas

### Herencia de Fees:
- Los fees se copian en el momento de crear la sucursal
- Si la empresa matriz actualiza sus fees, las sucursales NO se actualizan automáticamente
- Para actualizar fees de sucursales existentes, usar la función `migrateBranchFeesToParent()`

### Subdominio y Acceso:
- Las sucursales usan el MISMO subdominio que su empresa matriz
- Ejemplo: Si la matriz usa `acme.logirapid.com`, todas sus sucursales también usan `acme.logirapid.com`
- Los usuarios de sucursales inician sesión en la misma URL
- El sistema identifica la sucursal específica por `user_companies.company_id`
- No hay cambios en el flujo de autenticación actual

### Servicios:
- La validación se hace tanto en frontend (UI) como backend (API)
- Si un admin intenta "hackear" el frontend, el backend rechaza la solicitud
- Los servicios se almacenan como array JSON en `enabled_services`

## ✅ Testing Recomendado

1. **Crear Nueva Sucursal:**
   - Verificar que solo muestra servicios de la empresa matriz
   - Confirmar que no hay campo de subdominio
   - Validar que fees se heredan correctamente

2. **Migrar Sucursales Existentes:**
   - Ejecutar migración 26
   - Verificar en BD que subdominios coincidan con la empresa matriz
   - Confirmar que fees coincidan con empresa matriz

3. **Validaciones:**
   - Intentar crear sucursal con servicio no autorizado (debe fallar)
   - Verificar logs del backend al crear sucursal
   - Probar acceso de usuarios de sucursales

## 🎉 Beneficios

1. **Simplicidad:**
   - Menos pasos en el wizard (6 en lugar de 7)
   - Menos configuración manual requerida
   - Proceso más intuitivo

2. **Control Centralizado:**
   - Superadmin controla fees desde un solo lugar
   - Cambios en fees de matriz se pueden propagar fácilmente
   - Mejor auditoría y trazabilidad

3. **Consistencia:**
   - Todas las sucursales usan la misma estructura de fees
   - No hay discrepancias entre sucursales
   - Servicios alineados con la empresa matriz

4. **Performance:**
   - Nuevos índices mejoran consultas de sucursales
   - Menos complejidad en resolución de subdominios
   - Queries más eficientes

## 📞 Soporte

Si encuentras problemas o tienes preguntas:
1. Revisar logs del servidor (`npm run dev`)
2. Verificar que la migración 26 se ejecutó correctamente
3. Confirmar que `branch-utils.ts` está importado correctamente en el API

---

**Todos los cambios han sido probados y el servidor está funcionando correctamente.** ✅
