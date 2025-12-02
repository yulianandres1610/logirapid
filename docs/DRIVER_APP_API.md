# Driver App API - Documentacion

API REST para la aplicacion movil de conductores (Driver App) de LogiRapid.

## Informacion General

### Base URL
```
/api/driver-app
```

### Autenticacion

Todos los endpoints requieren autenticacion mediante cookie `auth-token`.

El middleware de autenticacion inyecta los siguientes headers en cada request:

| Header | Tipo | Descripcion |
|--------|------|-------------|
| `x-user-id` | integer | ID unico del usuario autenticado |
| `x-user-role` | string | Rol del usuario: `DRIVER`, `ADMIN`, `SUPER_ADMIN` |
| `x-user-email` | string | Email del usuario |

### Formato de Respuesta

Todas las respuestas siguen este formato:

```json
{
  "success": true,
  "data": { ... }
}
```

En caso de error:

```json
{
  "success": false,
  "error": "Mensaje de error"
}
```

### Codigos HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | Exito |
| 400 | Solicitud invalida |
| 401 | No autorizado |
| 404 | No encontrado |
| 500 | Error del servidor |

---

## Endpoints de Rutas

### 1. GET /api/driver-app/routes

Lista las rutas asignadas al driver autenticado.

#### Request

```http
GET /api/driver-app/routes?status=active&page=1&limit=20
```

#### Query Parameters

| Parametro | Tipo | Requerido | Default | Descripcion |
|-----------|------|-----------|---------|-------------|
| status | string | No | all | Filtrar: `pending`, `active`, `completed`, `all` |
| page | integer | No | 1 | Numero de pagina |
| limit | integer | No | 20 | Resultados por pagina |

#### Response

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

#### Campos de Route

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | integer | ID unico de la ruta |
| routeCode | string | Codigo legible: "ROUTE-2024-001" |
| status | string | Estado: `pending`, `active`, `completed`, `cancelled` |
| distance.value | number | Distancia numerica |
| distance.unit | string | Unidad: `mi` (millas) |
| distance.formatted | string | Texto formateado: "45.5 mi" |
| duration.value | string | Duracion estimada |
| duration.formatted | string | Texto formateado |
| date | string | Fecha: YYYY-MM-DD |
| progress.total | integer | Total de paradas |
| progress.completed | integer | Paradas completadas |
| progress.percentage | integer | Porcentaje: 0-100 |

#### Ordenamiento

Las rutas se ordenan automaticamente:
1. Activas primero
2. Pendientes segundo
3. Completadas al final
4. Dentro de cada grupo: por fecha descendente

---

### 2. GET /api/driver-app/routes/{code}

Obtiene el detalle completo de una ruta por su codigo.

#### Request

```http
GET /api/driver-app/routes/ROUTE-2024-001
```

#### Path Parameters

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| code | string | Si | Codigo unico de la ruta |

#### Response

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
        "totalStops": 15,
        "completedStops": 8,
        "pendingStops": 6,
        "failedStops": 1,
        "totalOrders": 22,
        "completedOrders": 12,
        "percentage": 53
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

#### Objeto Route

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | integer | ID unico en base de datos |
| routeCode | string | Codigo legible de la ruta |
| status | string | Estado: `pending`, `active`, `completed`, `cancelled` |
| date | string | Fecha programada: YYYY-MM-DD |
| distance | object | Informacion de distancia total |
| duration | object | Informacion de duracion estimada |
| vehicle | object/null | Vehiculo asignado |
| driver | object/null | Driver asignado |
| warehouse | object/null | Almacen origen con coordenadas |
| summary | object | Resumen de progreso |

#### Objeto Vehicle

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | integer | ID del vehiculo |
| plate | string | Placa del vehiculo |
| type | string/null | Tipo de vehiculo |

#### Objeto Warehouse

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | integer | ID del almacen |
| name | string | Nombre del almacen |
| address | string | Direccion completa |
| coordinates.latitude | number | Latitud para el mapa |
| coordinates.longitude | number | Longitud para el mapa |

#### Objeto Summary

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| totalStops | integer | Total de paradas |
| completedStops | integer | Paradas completadas |
| pendingStops | integer | Paradas pendientes |
| failedStops | integer | Paradas fallidas |
| totalOrders | integer | Total de ordenes |
| completedOrders | integer | Ordenes entregadas |
| percentage | integer | Porcentaje completado: 0-100 |

#### Objeto Stop

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| stopNumber | integer | Numero secuencial de la parada |
| status | string | Estado: `pending`, `in_progress`, `completed`, `failed` |
| address | object | Direccion desglosada |
| zone | string | Zona: "Ciudad / CodigoPostal" |
| coordinates.latitude | number | Latitud para el mapa |
| coordinates.longitude | number | Longitud para el mapa |
| orders | array | Lista de ordenes en esta parada |
| totalOrders | integer | Total de ordenes en la parada |
| completedOrders | integer | Ordenes completadas |

#### Objeto Address (dentro de Stop)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| full | string | Direccion completa formateada |
| street | string | Calle y numero |
| apartment | string/null | Apartamento o unidad |
| city | string | Ciudad |
| state | string | Estado |
| zipcode | string | Codigo postal |
| country | string | Pais: "US" |

#### Objeto Order (dentro de Stop)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | integer | ID de la orden |
| orderNumber | string | Numero de orden |
| status | string | Estado de la orden |
| customerName | string | Nombre del cliente |
| customerPhone | string/null | Telefono del cliente |
| services | array | Lista de servicios |
| timeSlot | string/null | Ventana horaria |
| hasProof | boolean | Tiene comprobante de entrega |

#### Objeto Service (dentro de Order)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| name | string | Nombre del servicio |
| quantity | integer | Cantidad |

---

## Estados

### Estados de Ruta

| Estado | Descripcion | Uso |
|--------|-------------|-----|
| pending | Pendiente de iniciar | Ruta programada |
| active | En progreso | Driver trabajando |
| completed | Finalizada | Todas las paradas visitadas |
| cancelled | Cancelada | Ruta cancelada |

### Estados de Parada

| Estado | Descripcion | Color sugerido |
|--------|-------------|----------------|
| pending | Por visitar | Gris |
| in_progress | En camino | Amarillo |
| completed | Completada | Verde |
| failed | Fallida | Rojo |

### Estados de Orden

| Estado | Descripcion |
|--------|-------------|
| pending | Pendiente |
| in_transit | En transito |
| delivered | Entregada |
| failed | Fallida |
| cancelled | Cancelada |

---

## Ejemplos de Uso

### Listar rutas activas

```bash
curl -X GET "https://api.logirapid.com/api/driver-app/routes?status=active" \
  -H "Cookie: auth-token=<token>"
```

### Obtener detalle de ruta

```bash
curl -X GET "https://api.logirapid.com/api/driver-app/routes/ROUTE-2024-001" \
  -H "Cookie: auth-token=<token>"
```

### Listar con paginacion

```bash
curl -X GET "https://api.logirapid.com/api/driver-app/routes?page=2&limit=10" \
  -H "Cookie: auth-token=<token>"
```

---

## Errores Comunes

### 401 No Autorizado

```json
{
  "success": false,
  "error": "No autorizado. Se requiere autenticacion."
}
```

Causa: Falta cookie `auth-token` o token invalido.

### 404 Ruta No Encontrada

```json
{
  "success": false,
  "error": "Ruta no encontrada"
}
```

Causa: El codigo de ruta no existe.

### 500 Error del Servidor

```json
{
  "success": false,
  "error": "Error al obtener rutas"
}
```

Causa: Error interno. Verificar logs del servidor.

---

## Notas de Implementacion

### Filtrado por Driver

- El endpoint filtra automaticamente por `driverid` del usuario autenticado
- Usuarios con rol `SUPER_ADMIN` pueden ver todas las rutas

### Coordenadas

- Las coordenadas usan formato decimal: latitud (-90 a 90), longitud (-180 a 180)
- El almacen (warehouse) proporciona el punto de origen para el mapa
- Cada parada incluye coordenadas para pintar marcadores

### Multiples Ordenes por Parada

- Una parada puede contener multiples ordenes
- Todas las ordenes de una parada comparten la misma direccion
- El estado de la parada se calcula basado en los estados de sus ordenes

### Calculo de Progreso

- `percentage` se calcula en el servidor: (completedOrders / totalOrders) * 100
- Evita calculos redundantes en el cliente

---

## Changelog

| Version | Fecha | Cambios |
|---------|-------|---------|
| 1.1.0 | 2024-12-02 | Agregado GET /api/driver-app/routes/{code} para detalle de ruta |
| 1.0.0 | 2024-12-02 | Endpoint inicial GET /api/driver-app/routes para listar rutas |
