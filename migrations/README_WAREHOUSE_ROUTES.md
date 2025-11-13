# 📦 Sistema de Rutas de Almacenes

## Descripción

Sistema completo para gestionar rutas de recolección de paquetes en almacenes con capacidad de escaneo y tracking en tiempo real.

## Tablas

### `warehouse_routes` - Tabla principal de rutas
Almacena información general de cada ruta de almacenes.

**Campos principales:**
- `routenumber`: Identificador único (RUT-WH-2025-0001)
- `status`: planning | active | completed | cancelled
- `totalstops`: Número de almacenes a visitar
- `completedstops`: Paradas completadas (auto-calculado)
- `totaldistance`: Distancia total en millas
- `totalpackages`: Total de paquetes a recoger
- `scannedpackages`: Paquetes escaneados (auto-calculado)

### `warehouse_route_stops` - Paradas en la ruta
Una fila por cada almacén visitado en la ruta.

**Campos principales:**
- `sequence`: Orden de visita (1, 2, 3...)
- `status`: pending | in_progress | completed | skipped | failed
- `expectedpackages`: Cantidad esperada de paquetes
- `scannedpackages`: Paquetes escaneados (auto-calculado)
- `packageids`: Array JSON de IDs escaneados
- `arrivaltime` / `departuretime`: Timestamps reales

### `warehouse_stop_scans` - Registro de escaneos
Un registro por cada paquete escaneado.

**Campos principales:**
- `packageid`: Tracking number del paquete
- `scannedat`: Timestamp del escaneo
- `scannedby`: Usuario que escaneó
- `isvalid`: Si el paquete corresponde a este almacén
- `validationerror`: Mensaje de error si no es válido

## Flujo de Trabajo

### 1. Crear Ruta
```sql
INSERT INTO warehouse_routes (...)
-- Crea la ruta en estado 'planning'
```

### 2. Activar Ruta
```sql
UPDATE warehouse_routes
SET status = 'active', starttime = NOW()
WHERE id = ?
```

### 3. Iniciar Parada
```sql
UPDATE warehouse_route_stops
SET status = 'in_progress', arrivaltime = NOW()
WHERE id = ?
```

### 4. Escanear Paquetes
```sql
INSERT INTO warehouse_stop_scans (stopid, routeid, packageid, scannedby)
VALUES (?, ?, ?, ?)
-- Los triggers actualizan automáticamente los contadores
```

### 5. Cerrar Parada
```sql
UPDATE warehouse_route_stops
SET status = 'completed', departuretime = NOW()
WHERE id = ?
-- Verifica: scannedpackages >= expectedpackages
```

### 6. Completar Ruta
```sql
UPDATE warehouse_routes
SET status = 'completed', endtime = NOW()
WHERE id = ?
-- Verifica: todas las paradas completadas
```

## Triggers Automáticos

### `update_stop_scanned_packages()`
- Se ejecuta después de INSERT en `warehouse_stop_scans`
- Actualiza `scannedpackages` en `warehouse_route_stops`
- Cuenta solo escaneos válidos (`isvalid = true`)

### `update_route_totals()`
- Se ejecuta después de UPDATE en `warehouse_route_stops`
- Actualiza `scannedpackages` y `completedstops` en `warehouse_routes`
- Suma todos los paquetes escaneados de todas las paradas

## Endpoints API (próximamente)

### Gestión de Rutas
- `POST /api/warehouse-routes` - Crear ruta
- `GET /api/warehouse-routes` - Listar rutas
- `GET /api/warehouse-routes/:id` - Detalle de ruta
- `PATCH /api/warehouse-routes/:id/start` - Iniciar ruta
- `PATCH /api/warehouse-routes/:id/complete` - Completar ruta

### Gestión de Paradas
- `GET /api/warehouse-routes/:routeId/stops` - Listar paradas
- `PATCH /api/warehouse-routes/:routeId/stops/:stopId/start` - Iniciar parada
- `PATCH /api/warehouse-routes/:routeId/stops/:stopId/complete` - Cerrar parada

### Escaneo de Paquetes
- `POST /api/warehouse-routes/:routeId/stops/:stopId/scan` - Escanear paquete
- `GET /api/warehouse-routes/:routeId/stops/:stopId/scans` - Listar escaneos
- `DELETE /api/warehouse-routes/:routeId/stops/:stopId/scans/:scanId` - Eliminar escaneo

## Diferencias con `routes` (rutas de órdenes)

| Característica | `routes` (Órdenes) | `warehouse_routes` (Almacenes) |
|----------------|-------------------|-------------------------------|
| Propósito | Entregar paquetes a clientes | Recoger paquetes de almacenes |
| Paradas | Direcciones de clientes | Ubicaciones de almacenes |
| Paquetes | Vinculados a órdenes | Escaneados en tiempo real |
| Tabla de stops | JSON en `routes.stops` | `warehouse_route_stops` |
| Escaneo | No aplica | `warehouse_stop_scans` |
| Actualización | Manual | Automática (triggers) |

## Migración

Para ejecutar la migración:

```bash
# Con psql
psql $DATABASE_URL -f migrations/create_warehouse_routes_tables.sql

# Con Node.js
node scripts/run-warehouse-migration.js
```

## Verificación

```sql
-- Ver tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'warehouse%';

-- Ver triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

## Ejemplo Completo

```sql
-- 1. Crear ruta
INSERT INTO warehouse_routes (routenumber, name, warehouseid, warehousename, totalstops, date)
VALUES ('RUT-WH-2025-0001', 'Ruta Miami Sur', 1, 'Miami Central', 3, '2025-01-15')
RETURNING id; -- id = 1

-- 2. Crear paradas
INSERT INTO warehouse_route_stops (routeid, warehouseid, warehousename, address, latitude, longitude, sequence, expectedpackages)
VALUES
  (1, 5, 'Kendall Warehouse', '123 SW 88 St', 25.6789, -80.3456, 1, 15),
  (1, 7, 'Doral Warehouse', '456 NW 107 Ave', 25.8123, -80.4567, 2, 20),
  (1, 9, 'Hialeah Warehouse', '789 E 25 St', 25.8567, -80.2789, 3, 12);

-- 3. Iniciar ruta y primera parada
UPDATE warehouse_routes SET status = 'active', starttime = NOW() WHERE id = 1;
UPDATE warehouse_route_stops SET status = 'in_progress', arrivaltime = NOW() WHERE routeid = 1 AND sequence = 1;

-- 4. Escanear paquetes en parada 1
INSERT INTO warehouse_stop_scans (stopid, routeid, packageid, scannedby)
VALUES
  (1, 1, 'PKG-001', 42),
  (1, 1, 'PKG-002', 42),
  (1, 1, 'PKG-003', 42);
-- El trigger actualiza automáticamente scannedpackages = 3

-- 5. Completar parada 1
UPDATE warehouse_route_stops SET status = 'completed', departuretime = NOW() WHERE id = 1;

-- 6. Verificar progreso
SELECT
  wr.routenumber,
  wr.totalstops,
  wr.completedstops,
  wr.scannedpackages,
  COUNT(ws.id) as total_scans
FROM warehouse_routes wr
LEFT JOIN warehouse_stop_scans ws ON ws.routeid = wr.id
WHERE wr.id = 1
GROUP BY wr.id;
```

## Notas

- Los triggers mantienen automáticamente la integridad de los contadores
- El sistema valida que los paquetes correspondan al almacén correcto
- Se mantiene un historial completo de todos los escaneos
- Las paradas pueden marcarse como 'skipped' o 'failed' según sea necesario
