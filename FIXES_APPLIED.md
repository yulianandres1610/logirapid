# Correcciones Aplicadas - Órdenes de Recogida en Creación de Rutas

## Fecha: 2025-11-17

## Problema Reportado
Las órdenes PICKUP00002 y PICKUP00003 no aparecían en la página de creación de rutas.

## Análisis del Problema

### Causa Raíz
1. **Token de Mapbox Inválido**: El token de Mapbox utilizado en los componentes de wizard estaba expirado/inválido
2. **Coordenadas Faltantes**: Las órdenes PICKUP00002 y PICKUP00003 se crearon con coordenadas NULL
3. **Filtro Estricto**: La página de creación de rutas filtra órdenes sin coordenadas válidas

### Detalles Técnicos
- **Archivo**: `src/app/dashboard/admin/routes/create/page.tsx` (líneas 243-249)
- **Filtro**: Excluye órdenes donde `latitude` o `longitude` sean `null`, `undefined`, o `0`
- **Geocodificación Fallida**: El wizard intentó geocodificar pero falló por token inválido

## Soluciones Aplicadas

### 1. Actualización del Token de Mapbox
**Archivos Modificados:**
- `src/components/pickup-orders/wizard/PickupOrderConfirmationStep.tsx` (línea 41)
- `src/components/office-orders/wizard/SenderSearchStep.tsx` (línea 88)

**Cambio:**
```typescript
// Token ANTIGUO (inválido):
const mapboxToken = 'pk.eyJ1IjoiY3ViYXJhcGlkIiwiYSI6ImNtM2k5N3YzbTA2MXoya3M4emk3dndhMjMifQ.kkR0NWRHWXsZVUkGEEcxqg'

// Token NUEVO (válido):
const mapboxToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'
```

### 2. Geocodificación de Órdenes Existentes
Se ejecutó un script para geocodificar las órdenes con coordenadas faltantes:

**PICKUP00002:**
- Dirección: `403 Palm Avenue, Hialeah, FL, 33012, us`
- Coordenadas: `25.825383, -80.28144`
- Estado: ✅ ACTUALIZADO

**PICKUP00003:**
- Dirección: `1241 Northwest 33rd Street, Miami, FL, 33142, us`
- Coordenadas: `25.80759, -80.216546`
- Estado: ✅ ACTUALIZADO

### 3. Mejoras en la Geocodificación
El script de geocodificación incluye:
- Limpieza de direcciones (elimina ", us" al final)
- Reintentos con direcciones simplificadas
- Logging detallado para debugging
- Manejo de errores robusto

## Verificación

### Consulta SQL para Verificar
```sql
SELECT
  ordernumber,
  status,
  latitude,
  longitude,
  zipcode,
  customeraddress
FROM package_orders
WHERE ordernumber IN ('PICKUP00002', 'PICKUP00003');
```

### Resultado Esperado
Ambas órdenes deben tener valores numéricos en `latitude` y `longitude`.

## Pruebas Recomendadas

### 1. Verificar Órdenes en Creación de Rutas
1. Ir a: `/dashboard/admin/routes/create`
2. Las órdenes PICKUP00002 y PICKUP00003 deben aparecer en la lista
3. Verificar que tengan marcadores en el mapa

### 2. Crear Nueva Orden de Recogida
1. Crear una nueva orden de recogida con un cliente existente
2. Verificar en consola que la geocodificación sea exitosa
3. Confirmar que la orden aparece en creación de rutas

### 3. Verificar Filtro de Zonas
1. Las órdenes deben aparecer al filtrar por sus zonas:
   - PICKUP00002: Zona que contiene zipcode 33012
   - PICKUP00003: Zona que contiene zipcode 33142

## Archivos Modificados

### Componentes de Wizard
1. `src/components/pickup-orders/wizard/PickupOrderConfirmationStep.tsx`
   - Actualizado token de Mapbox (línea 41)
   - Ya tenía geocodificación implementada (líneas 88-104)

2. `src/components/office-orders/wizard/SenderSearchStep.tsx`
   - Actualizado token de Mapbox (línea 88)

### API
Sin cambios - el endpoint `/api/package-orders` ya funcionaba correctamente.

### Base de Datos
- Tabla: `package_orders`
- Órdenes actualizadas: PICKUP00002, PICKUP00003
- Campos: `latitude`, `longitude`, `updatedat`

## Estado Actual

✅ Token de Mapbox actualizado en todos los componentes
✅ Coordenadas geocodificadas para PICKUP00002 y PICKUP00003
✅ Proyecto reconstruido y desplegado
✅ Servidor corriendo en puerto 3000
✅ Órdenes aparecen en creación de rutas

## Notas Adicionales

### Prevención de Problemas Futuros
- Las nuevas órdenes se geocodificarán automáticamente con el token válido
- Si la geocodificación falla, revisa:
  1. Validez del token de Mapbox
  2. Formato de la dirección
  3. Logs de consola para errores específicos

### Token de Mapbox
El token correcto se encuentra en:
- `envvercel` (líneas 33-34)
- `MAPBOX_POSTMAN_EXAMPLES.md` (línea 229)

Si el token expira, actualizarlo en:
- Variables de entorno (`NEXT_PUBLIC_MAPBOX_TOKEN`)
- Ambos componentes de wizard (PickupOrderConfirmationStep.tsx y SenderSearchStep.tsx)
