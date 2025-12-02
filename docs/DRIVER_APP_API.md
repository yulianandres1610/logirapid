# Driver App API - Documentación

Esta documentación describe los endpoints de la API para la aplicación móvil de conductores (Driver App) de LogiRapid.

## Base URL

```
/api/driver-app
```

## Autenticación

Todos los endpoints requieren autenticación mediante cookie `auth-token`.

### Headers Inyectados por Middleware

El middleware de autenticación inyecta los siguientes headers en cada request:

| Header | Descripción |
|--------|-------------|
| `x-user-id` | ID único del usuario autenticado |
| `x-user-role` | Rol del usuario (DRIVER, ADMIN, SUPER_ADMIN, etc.) |
| `x-user-email` | Email del usuario |

---

## Endpoints de Rutas

### 1. Listar Rutas del Driver

Obtiene la lista de rutas asignadas al driver autenticado. Devuelve información resumida optimizada para mostrar en cards de la app móvil.

#### Request

```http
GET /api/driver-app/routes
```

#### Query Parameters

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `status` | string | No | `all` | Filtrar por estado: `pending`, `active`, `completed`, `all` |
| `page` | integer | No | `1` | Número de página para paginación |
| `limit` | integer | No | `20` | Cantidad de resultados por página |

#### Response - Éxito (200)

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

#### Campos de Respuesta

##### Objeto `route`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID único de la ruta en la base de datos |
| `routeCode` | string | Código legible de la ruta (ej: "ROUTE-2024-001") |
| `status` | string | Estado actual de la ruta |
| `distance` | object | Información de distancia total |
| `duration` | object | Información de duración estimada |
| `date` | string | Fecha programada de la ruta (formato: YYYY-MM-DD) |
| `progress` | object | Progreso de entregas completadas |

##### Objeto `distance`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `value` | number | Valor numérico de la distancia |
| `unit` | string | Unidad de medida (`mi` = millas) |
| `formatted` | string | Texto formateado listo para mostrar |

##### Objeto `duration`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `value` | string | Valor de duración |
| `formatted` | string | Texto formateado listo para mostrar |

##### Objeto `progress`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `total` | integer | Total de paradas en la ruta |
| `completed` | integer | Paradas completadas |
| `percentage` | integer | Porcentaje de completado (0-100) |

##### Objeto `pagination`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `page` | integer | Página actual |
| `limit` | integer | Resultados por página |
| `total` | integer | Total de rutas |
| `totalPages` | integer | Total de páginas |
| `hasMore` | boolean | Indica si hay más páginas |

#### Estados de Ruta (`status`)

| Estado | Descripción |
|--------|-------------|
| `pending` | Ruta pendiente, aún no iniciada |
| `active` | Ruta activa, en progreso |
| `completed` | Ruta completada |
| `cancelled` | Ruta cancelada |

#### Response - Error (401)

```json
{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}
```

#### Response - Error (500)

```json
{
  "success": false,
  "error": "Error al obtener rutas"
}
```

#### Ejemplo de Uso

```bash
# Obtener todas las rutas
curl -X GET "https://api.logirapid.com/api/driver-app/routes" \
  -H "Cookie: auth-token=<token>"

# Obtener solo rutas activas
curl -X GET "https://api.logirapid.com/api/driver-app/routes?status=active" \
  -H "Cookie: auth-token=<token>"

# Obtener con paginación
curl -X GET "https://api.logirapid.com/api/driver-app/routes?page=2&limit=10" \
  -H "Cookie: auth-token=<token>"
```

#### Ordenamiento

Las rutas se ordenan automáticamente por prioridad:
1. **Activas** - Primero las rutas en progreso
2. **Pendientes** - Luego las rutas por iniciar
3. **Completadas** - Finalmente las rutas terminadas
4. Dentro de cada grupo, se ordenan por fecha descendente (más recientes primero)

#### Notas de Implementación

- El endpoint filtra automáticamente las rutas por el `driverid` del usuario autenticado
- Los usuarios con rol `SUPER_ADMIN` pueden ver todas las rutas
- La distancia se almacena en millas en la base de datos
- El campo `progress.percentage` se calcula en el servidor para evitar cálculos en el cliente

---

## Códigos de Error Comunes

| Código HTTP | Significado |
|-------------|-------------|
| 200 | Éxito |
| 400 | Solicitud inválida (parámetros incorrectos) |
| 401 | No autorizado (falta autenticación) |
| 403 | Prohibido (sin permisos suficientes) |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor |

---

## Changelog

### v1.0.0 (2024-12-02)
- Endpoint inicial `GET /api/driver-app/routes` para listar rutas
