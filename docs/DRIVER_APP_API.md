# Driver App API Documentation

## Overview

Esta documentación describe los endpoints REST disponibles para la aplicación móvil de drivers de LogiRapid.

**Base URL:** `/api/driver-app`

**Autenticación:** Todos los endpoints requieren un token de autenticación en la cookie `auth-token`. Solo usuarios con rol `DRIVER` pueden acceder.

---

## Endpoints

### 1. Dashboard

Obtiene el dashboard del driver con estadísticas, inventario y ruta activa.

**Endpoint:** `GET /api/driver-app/dashboard`

**Headers:**
```
Cookie: auth-token=<token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": 123,
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "driver@example.com",
      "phone": "+1234567890",
      "companyId": 1,
      "companyName": "LogiRapid Express"
    },
    "inventory": {
      "cajasVacias": 15,
      "cajasVaciasCapacity": 50,
      "bultos": 8,
      "bultosCapacity": 100
    },
    "rutaActiva": {
      "id": 456,
      "routeNumber": "R-2024-001",
      "status": "active",
      "totalStops": 12,
      "completedStops": 5,
      "distance": 45.5,
      "duration": 120,
      "scheduledDate": "2024-01-15"
    },
    "estadisticas": {
      "entregasHoy": 5,
      "entregasSemana": 25,
      "pendientes": 7
    }
  }
}
```

**Errors:**
- `401 Unauthorized`: Token no válido o no proporcionado
- `403 Forbidden`: Usuario no es DRIVER
- `404 Not Found`: Driver no encontrado

---

### 2. Recibir Caja Vacía

Asigna una caja vacía al driver para reparto.

**Endpoint:** `POST /api/driver-app/receive-box`

**Headers:**
```
Cookie: auth-token=<token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "codigo": "BOX-001-2024",
  "warehouseId": 1
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| codigo | string | Sí | Código único del empaque |
| warehouseId | number | No | ID del almacén donde se recibe |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Caja recibida exitosamente",
  "data": {
    "empaque": {
      "id": 1,
      "codigo": "BOX-001-2024",
      "tipo": "CAJA",
      "estado": "en_reparto",
      "packageSizeName": "Mediano"
    },
    "inventarioActualizado": {
      "cajasVacias": 16,
      "bultos": 8
    }
  }
}
```

**Validaciones:**
- El empaque debe existir
- Debe estar en estado `disponible`
- No debe tener orden asignada (es caja vacía)
- Driver debe tener capacidad disponible
- No debe estar asignado a otro driver

**Errors:**
- `400 Bad Request`: Validación fallida (empaque no disponible, tiene orden, etc.)
- `404 Not Found`: Empaque no encontrado

---

### 3. Recibir Bulto (Paquete con Contenido)

Asigna un bulto (empaque con orden) al driver para reparto.

**Endpoint:** `POST /api/driver-app/receive-package`

**Headers:**
```
Cookie: auth-token=<token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "codigo": "PKG-001-2024",
  "warehouseId": 1
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bulto recibido exitosamente",
  "data": {
    "empaque": {
      "id": 2,
      "codigo": "PKG-001-2024",
      "tipo": "BULTO",
      "estado": "en_reparto",
      "orderNumber": "ORD-2024-123",
      "serviceName": "Envío Express",
      "recipientName": "María García",
      "recipientCity": "Miami",
      "recipientState": "FL",
      "weightLb": 5.5,
      "weightKg": 2.5,
      "boxNumber": 1,
      "totalBoxes": 2,
      "packageSizeName": "Grande"
    },
    "inventarioActualizado": {
      "cajasVacias": 16,
      "bultos": 9
    }
  }
}
```

**Validaciones:**
- El empaque debe existir
- Debe tener orden asignada (es bulto)
- Debe estar en estado válido: `en_almacen`, `en_transito`, `recibido_destino`, `recogida`
- Driver debe tener capacidad disponible

**Errors:**
- `400 Bad Request`: Validación fallida
- `404 Not Found`: Empaque no encontrado

---

### 4. Lista de Bultos

Obtiene los bultos (paquetes con contenido) asignados al driver.

**Endpoint:** `GET /api/driver-app/packages`

**Query Parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| page | number | 1 | Página actual |
| limit | number | 50 | Resultados por página |
| status | string | activos | Estado: `en_reparto`, `entregado`, `all` |
| search | string | - | Búsqueda por código, orden o destinatario |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bultos": [
      {
        "id": 2,
        "codigo": "PKG-001-2024",
        "tipo": "BULTO",
        "estado": "en_reparto",
        "packageSizeId": 3,
        "packageSizeName": "Grande",
        "dimensions": "40x30x30",
        "orderNumber": "ORD-2024-123",
        "serviceName": "Envío Express",
        "recipientName": "María García",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "weightLb": 5.5,
        "weightKg": 2.5,
        "boxNumber": 1,
        "totalBoxes": 2,
        "companyId": 1,
        "companyName": "LogiRapid Express",
        "warehouseId": 1,
        "warehouseName": "Almacén Principal",
        "assignedAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-14T08:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "agrupados": [
      {
        "orderNumber": "ORD-2024-123",
        "recipientName": "María García",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "serviceName": "Envío Express",
        "totalBoxes": 2,
        "bultos": [
          {
            "id": 2,
            "codigo": "PKG-001-2024",
            "tipo": "BULTO",
            "estado": "en_reparto",
            "packageSizeName": "Grande",
            "dimensions": "40x30x30",
            "weightLb": 5.5,
            "boxNumber": 1,
            "assignedAt": "2024-01-15T10:30:00Z",
            "warehouseName": "Almacén Principal"
          }
        ]
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 8,
    "totalPages": 1
  }
}
```

---

### 5. Lista de Cajas Vacías

Obtiene las cajas vacías asignadas al driver.

**Endpoint:** `GET /api/driver-app/empty-boxes`

**Query Parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| page | number | 1 | Página actual |
| limit | number | 50 | Resultados por página |
| tamano | number | - | ID del tamaño de empaque |
| search | string | - | Búsqueda por código |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cajasVacias": [
      {
        "id": 1,
        "codigo": "BOX-001-2024",
        "tipo": "CAJA",
        "estado": "en_reparto",
        "packageSizeId": 2,
        "packageSizeName": "Mediano",
        "dimensions": "30x25x20",
        "maxWeightLb": 25,
        "companyId": 1,
        "companyName": "LogiRapid Express",
        "warehouseId": 1,
        "warehouseName": "Almacén Principal",
        "assignedAt": "2024-01-15T09:00:00Z",
        "createdAt": "2024-01-10T14:30:00Z"
      }
    ],
    "resumenPorTamano": [
      {
        "sizeId": 1,
        "sizeName": "Pequeño",
        "dimensions": "20x15x10",
        "count": 5
      },
      {
        "sizeId": 2,
        "sizeName": "Mediano",
        "dimensions": "30x25x20",
        "count": 8
      },
      {
        "sizeId": 3,
        "sizeName": "Grande",
        "dimensions": "40x30x30",
        "count": 2
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1
  }
}
```

---

## Estados de Empaques

Los empaques pueden tener los siguientes estados:

| Estado | Descripción |
|--------|-------------|
| `disponible` | Empaque disponible en inventario (caja vacía) |
| `asignado` | Asignado a orden pero no recogido |
| `recogida` | Recogido/creado en almacén origen |
| `en_almacen` | Recibido y procesado en almacén |
| `en_transito` | En tránsito a otro almacén |
| `recibido_destino` | Recibido en almacén destino |
| `en_reparto` | Asignado a driver para entrega |
| `entregado` | Entregado al destinatario final |

---

## Flujo de Estados

### Caja Vacía
```
disponible → en_reparto (driver recibe) → (driver usa en recogida) → recogida
```

### Bulto (Paquete con Contenido)
```
recogida → en_almacen → en_transito → recibido_destino → en_reparto (driver recibe) → entregado
```

---

## Códigos de Error HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Operación exitosa |
| 400 | Bad Request - Validación fallida |
| 401 | Unauthorized - Token inválido o no proporcionado |
| 403 | Forbidden - Usuario no tiene permisos (no es DRIVER) |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## Trazabilidad

Todas las operaciones de recibir cajas o bultos registran eventos en la tabla `empaques_trazabilidad`:

- `recibido_por_driver`: Caja vacía recibida por driver
- `asignado_a_reparto`: Bulto asignado a driver para reparto

Cada evento incluye:
- ID del empaque
- ID del usuario (driver)
- Nombre del driver
- ID del almacén
- Timestamp
- Notas adicionales

---

## Ejemplos de Uso

### cURL - Dashboard
```bash
curl -X GET 'http://localhost:3000/api/driver-app/dashboard' \
  -H 'Cookie: auth-token=YOUR_TOKEN'
```

### cURL - Recibir Caja
```bash
curl -X POST 'http://localhost:3000/api/driver-app/receive-box' \
  -H 'Cookie: auth-token=YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"codigo": "BOX-001-2024", "warehouseId": 1}'
```

### cURL - Recibir Bulto
```bash
curl -X POST 'http://localhost:3000/api/driver-app/receive-package' \
  -H 'Cookie: auth-token=YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"codigo": "PKG-001-2024", "warehouseId": 1}'
```

### cURL - Lista de Bultos
```bash
curl -X GET 'http://localhost:3000/api/driver-app/packages?page=1&limit=20&status=en_reparto' \
  -H 'Cookie: auth-token=YOUR_TOKEN'
```

### cURL - Lista de Cajas Vacías
```bash
curl -X GET 'http://localhost:3000/api/driver-app/empty-boxes?page=1&limit=50' \
  -H 'Cookie: auth-token=YOUR_TOKEN'
```

---

## Notas de Implementación

1. **Inventario Automático**: Los contadores en `driver_inventory` se actualizan automáticamente mediante triggers de PostgreSQL cuando se asignan/desasignan empaques.

2. **Multi-tenancy**: Todos los datos están aislados por `company_id`. Los drivers solo ven empaques de su empresa.

3. **Capacidades**: Cada driver tiene límites configurables de:
   - `cajas_vacias_capacity`: Máximo de cajas vacías (default: 50)
   - `bultos_capacity`: Máximo de bultos (default: 100)

4. **Token Format**: El token se decodifica como `base64(userId:email:role)`.
