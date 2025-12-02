# Driver App API - Documentacion

API REST para la aplicacion movil de conductores (Driver App) de LogiRapid.

---

## Informacion General

### Base URL

```
/api/driver-app
```

### Autenticacion

Todos los endpoints requieren autenticacion mediante cookie `auth-token`.

El middleware inyecta automaticamente estos headers en cada request:

| Header | Tipo | Descripcion |
|--------|------|-------------|
| `x-user-id` | integer | ID del usuario autenticado |
| `x-user-role` | string | Rol: `DRIVER`, `ADMIN`, `SUPER_ADMIN`, `MANAGER`, `USER` |
| `x-user-email` | string | Email del usuario |

### Formato de Respuesta Exitosa

```json
{
  "success": true,
  "data": { ... }
}
```

### Formato de Respuesta de Error

```json
{
  "success": false,
  "error": "Descripcion del error"
}
```

### Codigos HTTP

| Codigo | Descripcion |
|--------|-------------|
| 200 | Exito |
| 400 | Solicitud invalida |
| 401 | No autorizado |
| 403 | Acceso denegado |
| 404 | No encontrado |
| 500 | Error del servidor |

---

# ENDPOINTS DE RUTAS

---

## 1. GET /api/driver-app/routes

Lista las rutas asignadas al driver. Devuelve informacion resumida para mostrar en tarjetas (cards).

### Request

```http
GET /api/driver-app/routes
GET /api/driver-app/routes?status=active
GET /api/driver-app/routes?status=pending&page=1&limit=10
```

### Query Parameters

| Parametro | Tipo | Requerido | Default | Descripcion |
|-----------|------|-----------|---------|-------------|
| `status` | string | No | `all` | Filtrar: `pending`, `active`, `completed`, `all` |
| `page` | integer | No | `1` | Numero de pagina |
| `limit` | integer | No | `20` | Resultados por pagina |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/routes?status=active" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "id": 123,
        "routeCode": "ROUTE-2024-001",
        "status": "active",
        "distance": {
          "value": 45.5,
          "unit": "mi",
          "formatted": "45.5 mi"
        },
        "duration": {
          "value": "2h 30min",
          "formatted": "2h 30min"
        },
        "date": "2024-12-02",
        "progress": {
          "total": 15,
          "completed": 8,
          "percentage": 53
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

### Campos de Response

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | integer | ID unico de la ruta |
| `routeCode` | string | Codigo legible de la ruta |
| `status` | string | Estado: `pending`, `active`, `completed`, `cancelled` |
| `distance.value` | number | Distancia numerica |
| `distance.unit` | string | Unidad: `mi` (millas) |
| `distance.formatted` | string | Texto formateado |
| `duration.value` | string | Duracion estimada |
| `duration.formatted` | string | Texto formateado |
| `date` | string | Fecha: YYYY-MM-DD |
| `progress.total` | integer | Total de paradas |
| `progress.completed` | integer | Paradas completadas |
| `progress.percentage` | integer | Porcentaje: 0-100 |

### Ordenamiento Automatico

1. Activas primero
2. Pendientes segundo
3. Completadas al final
4. Dentro de cada grupo: por fecha descendente

---

## 2. GET /api/driver-app/routes/{code}

Obtiene el detalle completo de una ruta por su codigo. Incluye vehiculo, almacen con coordenadas, paradas con coordenadas para el mapa, y ordenes agrupadas por parada.

### Request

```http
GET /api/driver-app/routes/ROUTE-2024-001
```

### Path Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `code` | string | Si | Codigo unico de la ruta (routeCode) |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/routes/ROUTE-2024-001" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "route": {
      "id": 123,
      "routeCode": "ROUTE-2024-001",
      "status": "active",
      "date": "2024-12-02",
      "distance": {
        "value": 45.5,
        "unit": "mi",
        "formatted": "45.5 mi"
      },
      "duration": {
        "value": "2h 30min",
        "formatted": "2h 30min"
      },
      "vehicle": {
        "id": 5,
        "plate": "ABC-123",
        "type": null
      },
      "driver": {
        "id": 10,
        "name": "Juan Perez"
      },
      "warehouse": {
        "id": 1,
        "name": "Almacen Principal",
        "address": "123 Warehouse St, Miami, FL 33101",
        "coordinates": {
          "latitude": 25.7617,
          "longitude": -80.1918
        }
      },
      "summary": {
        "totalStops": 3,
        "completedStops": 1,
        "pendingStops": 1,
        "failedStops": 1,
        "totalOrders": 4,
        "completedOrders": 2,
        "percentage": 50
      }
    },
    "stops": [
      {
        "stopNumber": 1,
        "status": "completed",
        "address": {
          "full": "456 Main St, Apt 2B, Miami, FL 33102",
          "street": "456 Main St",
          "apartment": "Apt 2B",
          "city": "Miami",
          "state": "FL",
          "zipcode": "33102",
          "country": "US"
        },
        "zone": "Miami / 33102",
        "coordinates": {
          "latitude": 25.7705,
          "longitude": -80.1936
        },
        "orders": [
          {
            "id": 1001,
            "orderNumber": "PICKUP-2024-001",
            "status": "delivered",
            "customerName": "Maria Garcia",
            "customerPhone": "+1234567890",
            "services": [
              {
                "name": "Envio Express",
                "quantity": 2
              }
            ],
            "timeSlot": "morning",
            "hasProof": true
          }
        ],
        "totalOrders": 1,
        "completedOrders": 1
      }
    ]
  }
}
```

### Campos de Response - route

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | integer | ID unico en base de datos |
| `routeCode` | string | Codigo legible de la ruta |
| `status` | string | Estado: `pending`, `active`, `completed`, `cancelled` |
| `date` | string | Fecha programada: YYYY-MM-DD |
| `distance` | object | Informacion de distancia total |
| `duration` | object | Informacion de duracion estimada |
| `vehicle` | object/null | Vehiculo asignado |
| `driver` | object/null | Driver asignado |
| `warehouse` | object/null | Almacen origen con coordenadas |
| `summary` | object | Resumen de progreso |

### Campos de Response - stops[]

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `stopNumber` | integer | Numero secuencial de la parada |
| `status` | string | Estado: `pending`, `in_progress`, `completed`, `failed` |
| `address` | object | Direccion desglosada |
| `zone` | string | Zona: "Ciudad / CodigoPostal" |
| `coordinates` | object | Latitud y longitud para el mapa |
| `orders` | array | Lista de ordenes en esta parada |
| `totalOrders` | integer | Total de ordenes en la parada |
| `completedOrders` | integer | Ordenes completadas |

### Campos de Response - orders[]

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | integer | ID de la orden |
| `orderNumber` | string | Numero de orden |
| `status` | string | Estado de la orden |
| `customerName` | string | Nombre del cliente |
| `customerPhone` | string/null | Telefono del cliente |
| `services` | array | Lista de servicios [{name, quantity}] |
| `timeSlot` | string/null | Ventana horaria |
| `hasProof` | boolean | Tiene comprobante de entrega |

---

# ENDPOINTS DE EMPAQUES (Servicios Habilitados)

---

## 3. POST /api/driver-app/empaques/validate

Valida un codigo de empaque individual al escanearlo.

### Request

```http
POST /api/driver-app/empaques/validate
Content-Type: application/json

{
  "codigo": "EMP-001",
  "tipo": "empaque",
  "operacion": "recepcion",
  "warehouseId": 1
}
```

### Body Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `codigo` | string | Si | Codigo del empaque a validar |
| `tipo` | string | Si | Tipo: `empaque` o `bulto` |
| `operacion` | string | No | Solo para bultos: `recepcion` o `envio` |
| `warehouseId` | integer | No | ID del almacen actual |

### Ejemplo Request

```bash
curl -X POST "https://tu-dominio.com/api/driver-app/empaques/validate" \
  -H "Cookie: auth-token=<tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "EMP-001",
    "tipo": "empaque"
  }'
```

### Ejemplo Response - Valido

```json
{
  "success": true,
  "data": {
    "valid": true,
    "status": "valid",
    "empaque": {
      "id": 1,
      "codigo": "EMP-001",
      "tipo": "CAJA",
      "estado": "disponible",
      "warehouseId": 1,
      "warehouseName": "Almacen Principal",
      "packageSizeId": 2,
      "packageSizeName": "Mediana"
    }
  }
}
```

### Ejemplo Response - Invalido

```json
{
  "success": true,
  "data": {
    "valid": false,
    "status": "invalid",
    "errorCode": "NOT_FOUND",
    "message": "El codigo de empaque no existe"
  }
}
```

### Codigos de Error

| errorCode | Descripcion |
|-----------|-------------|
| `NOT_FOUND` | Codigo no existe |
| `WRONG_COMPANY` | Codigo pertenece a otra empresa |
| `NOT_AVAILABLE` | Empaque no esta disponible |
| `INVALID_STATE` | Estado no valido para la operacion |
| `NO_ORDER` | Empaque sin orden asignada (para bultos) |
| `WRONG_WAREHOUSE` | Empaque no esta en el almacen indicado |
| `ALREADY_HERE` | El bulto ya se encuentra en este almacen |

---

## 4. GET /api/driver-app/empaques/disponibles

Obtiene todos los empaques en estado 'disponible' para validar codigos al escanear.

### Request

```http
GET /api/driver-app/empaques/disponibles
GET /api/driver-app/empaques/disponibles?tipo=CAJA
GET /api/driver-app/empaques/disponibles?search=EMP
```

### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `tipo` | string | No | Filtrar por tipo: `CAJA`, `BULTO`, etc. |
| `search` | string | No | Buscar por codigo |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/empaques/disponibles" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "empaques": [
      {
        "id": 1,
        "codigo": "EMP-001",
        "tipo": "CAJA",
        "estado": "disponible",
        "packageSizeId": 2,
        "packageSizeName": "Mediana",
        "dimensions": "30x20x15",
        "maxWeightLb": 50,
        "warehouseId": 1,
        "warehouseName": "Almacen Principal",
        "createdAt": "2024-12-01T10:00:00Z"
      }
    ],
    "codigosDisponibles": ["EMP-001", "EMP-002", "EMP-003"],
    "totalDisponibles": 3,
    "resumenPorTipo": {
      "CAJA": 2,
      "BULTO": 1
    }
  }
}
```

---

## 5. GET /api/driver-app/empaques/list-disponibles

Precarga todos los empaques disponibles (cajas vacias) de la empresa para validacion local instantanea.

### Request

```http
GET /api/driver-app/empaques/list-disponibles
GET /api/driver-app/empaques/list-disponibles?warehouseId=1
GET /api/driver-app/empaques/list-disponibles?tipo=CAJA
```

### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `warehouseId` | integer | No | Filtrar por almacen |
| `tipo` | string | No | Filtrar por tipo: `CAJA`, `BULTO`, etc. |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/empaques/list-disponibles?warehouseId=1" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "empaques": [
      {
        "id": 1,
        "codigo": "EMP-001",
        "tipo": "CAJA",
        "estado": "disponible",
        "packageSizeId": 2,
        "packageSizeName": "Mediana",
        "dimensions": "30x20x15",
        "maxWeightLb": 50,
        "warehouseId": 1,
        "warehouseName": "Almacen Principal",
        "createdAt": "2024-12-01T10:00:00Z"
      }
    ],
    "codigos": ["EMP-001", "EMP-002"],
    "total": 2,
    "companyId": 5
  }
}
```

---

## 6. GET /api/driver-app/empaques/list-bultos

Precarga todos los bultos (empaques con orden asignada) de la empresa para validacion local.

### Request

```http
GET /api/driver-app/empaques/list-bultos
GET /api/driver-app/empaques/list-bultos?warehouseId=1
GET /api/driver-app/empaques/list-bultos?estado=en_almacen
```

### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `warehouseId` | integer | No | Filtrar por almacen |
| `estado` | string | No | Filtrar por estado |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/empaques/list-bultos?estado=en_almacen" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "bultos": [
      {
        "id": 10,
        "codigo": "BLT-001",
        "tipo": "BULTO",
        "estado": "en_almacen",
        "warehouseId": 1,
        "warehouseName": "Almacen Principal",
        "ordenId": 100,
        "orderNumber": "PICKUP-2024-001",
        "packageSizeId": 3,
        "packageSizeName": "Grande",
        "serviceName": "Envio Express",
        "recipientName": "Maria Garcia",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "weightLb": 25.5,
        "weightKg": 11.6,
        "boxNumber": 1,
        "totalBoxes": 2,
        "createdAt": "2024-12-01T10:00:00Z",
        "updatedAt": "2024-12-01T12:00:00Z"
      }
    ],
    "codigos": ["BLT-001", "BLT-002"],
    "total": 2,
    "companyId": 5
  }
}
```

---

## 7. GET /api/driver-app/empaques/servicio/{orderNumber}/{serviceName}

Obtiene todos los empaques (bultos) asociados a un servicio especifico de una orden.

### Request

```http
GET /api/driver-app/empaques/servicio/PICKUP-2024-001/Envio%20Express
```

### Path Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `orderNumber` | string | Si | Numero de la orden |
| `serviceName` | string | Si | Nombre del servicio (URL encoded) |

### Ejemplo Request

```bash
curl -X GET "https://tu-dominio.com/api/driver-app/empaques/servicio/PICKUP-2024-001/Envio%20Express" \
  -H "Cookie: auth-token=<tu-token>"
```

### Ejemplo Response

```json
{
  "success": true,
  "data": {
    "orden": {
      "orderNumber": "PICKUP-2024-001",
      "customerName": "Maria Garcia",
      "status": "in_transit"
    },
    "servicio": {
      "name": "Envio Express",
      "type": "express",
      "quantity": 2,
      "weight": 50,
      "price": 25.00
    },
    "empaques": [
      {
        "id": 10,
        "codigo": "BLT-001",
        "tipo": "BULTO",
        "estado": "en_reparto",
        "boxNumber": 1,
        "totalBoxes": 2,
        "recipientName": "Maria Garcia",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "weightLb": 25.5,
        "weightKg": 11.6,
        "packageSizeName": "Grande",
        "dimensions": "40x30x25",
        "driverId": 10,
        "driverName": "Juan Perez"
      }
    ],
    "codigosEsperados": ["BLT-001", "BLT-002"],
    "validacion": {
      "totalBultos": 2,
      "bultosEnReparto": 2,
      "bultosEntregados": 0,
      "bultosPendientes": 0,
      "todosAsignados": true,
      "todosEntregados": false
    }
  }
}
```

---

# ESTADOS

## Estados de Ruta

| Estado | Descripcion | Color |
|--------|-------------|-------|
| `pending` | Pendiente de iniciar | Gris |
| `active` | En progreso | Amarillo |
| `completed` | Finalizada | Verde |
| `cancelled` | Cancelada | Rojo |

## Estados de Parada

| Estado | Descripcion | Color |
|--------|-------------|-------|
| `pending` | Por visitar | Gris |
| `in_progress` | En camino | Amarillo |
| `completed` | Completada | Verde |
| `failed` | Fallida | Rojo |

## Estados de Orden

| Estado | Descripcion |
|--------|-------------|
| `pending` | Pendiente |
| `in_transit` | En transito |
| `delivered` | Entregada |
| `failed` | Fallida |
| `cancelled` | Cancelada |

## Estados de Empaque

| Estado | Descripcion |
|--------|-------------|
| `disponible` | Caja vacia disponible |
| `en_almacen` | Bulto en almacen |
| `en_reparto` | Bulto en ruta de entrega |
| `entregado` | Bulto entregado |

---

# NOTAS DE IMPLEMENTACION

## Filtrado por Empresa

- Los endpoints filtran automaticamente por la empresa del usuario autenticado
- Usuarios con rol `SUPER_ADMIN` pueden ver datos de todas las empresas

## Coordenadas para el Mapa

- Latitud: rango -90 a 90
- Longitud: rango -180 a 180
- El almacen (`warehouse.coordinates`) es el punto de origen
- Cada parada (`stops[].coordinates`) son los marcadores

## Multiples Ordenes por Parada

- Una parada puede contener multiples ordenes
- El estado de la parada se calcula basado en los estados de sus ordenes

## Validacion de Empaques

- Usar `list-disponibles` y `list-bultos` para precargar codigos
- Validar localmente primero, usar `validate` como fallback
- Los codigos son case-insensitive

---

# CHANGELOG

| Version | Fecha | Descripcion |
|---------|-------|-------------|
| 1.1.0 | 2024-12-02 | Agregado GET /api/driver-app/routes/{code} para detalle de ruta |
| 1.0.0 | 2024-12-02 | Endpoints de rutas y empaques |
