# Mapbox Optimization API v2 - Ejemplos para Postman

## 1. Crear un Job de Optimización (POST)

**URL:**
```
POST https://api.mapbox.com/optimized-trips/v2?access_token=YOUR_TOKEN
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "version": 1,
  "locations": [
    {
      "name": "warehouse",
      "coordinates": [-80.2395, 25.7548]
    },
    {
      "name": "stop_1",
      "coordinates": [-80.216546, 25.80759]
    },
    {
      "name": "stop_2",
      "coordinates": [-80.384728, 25.65939]
    },
    {
      "name": "stop_3",
      "coordinates": [-80.262164, 25.842397]
    }
  ],
  "vehicles": [
    {
      "name": "vehicle_1",
      "routing_profile": "mapbox/driving",
      "start_location": "warehouse",
      "end_location": "warehouse",
      "earliest_start": "2025-11-07T08:00:00.000Z",
      "latest_end": "2025-11-07T20:00:00.000Z"
    }
  ],
  "services": [
    {
      "name": "service_1",
      "location": "stop_1",
      "duration": 300
    },
    {
      "name": "service_2",
      "location": "stop_2",
      "duration": 300
    },
    {
      "name": "service_3",
      "location": "stop_3",
      "duration": 300
    }
  ]
}
```

**Respuesta Exitosa (202 Accepted):**
```json
{
  "status": "ok",
  "id": "c7377538-cc45-40ba-a415-6179e25549f9"
}
```

---

## 2. Obtener Resultado de Optimización (GET)

**URL:**
```
GET https://api.mapbox.com/optimized-trips/v2/{JOB_ID}?access_token=YOUR_TOKEN
```

**Ejemplo:**
```
GET https://api.mapbox.com/optimized-trips/v2/c7377538-cc45-40ba-a415-6179e25549f9?access_token=YOUR_TOKEN
```

**Respuesta (200 OK):**
```json
{
  "dropped": {
    "services": [],
    "shipments": []
  },
  "routes": [
    {
      "vehicle": "vehicle_1",
      "stops": [
        {
          "location": "warehouse",
          "eta": "2025-11-07T08:00:00Z",
          "type": "start",
          "odometer": 0,
          "wait": 0
        },
        {
          "location": "stop_2",
          "eta": "2025-11-07T08:34:45Z",
          "type": "service",
          "duration": 300,
          "services": ["service_2"],
          "odometer": 21091,
          "wait": 0
        },
        {
          "location": "stop_3",
          "eta": "2025-11-07T09:16:41Z",
          "type": "service",
          "duration": 300,
          "services": ["service_3"],
          "odometer": 54431,
          "wait": 0
        },
        {
          "location": "warehouse",
          "eta": "2025-11-07T10:03:56Z",
          "type": "end",
          "odometer": 72709
        }
      ]
    }
  ],
  "version": 1
}
```

---

## 3. IMPORTANTE: Obtener Geometría de la Ruta

**⚠️ NOTA:** La Optimization API v2 NO devuelve la geometría de la ruta directamente.

Para obtener la geometría de la línea de la ruta, necesitas hacer una llamada adicional a la **Directions API** usando las coordenadas de las paradas en orden.

**URL de Directions API:**
```
GET https://api.mapbox.com/directions/v5/mapbox/driving/{coordinates}?geometries=geojson&overview=full&access_token=YOUR_TOKEN
```

**Ejemplo con coordenadas de las paradas optimizadas:**
```
GET https://api.mapbox.com/directions/v5/mapbox/driving/-80.2395,25.7548;-80.384728,25.65939;-80.262164,25.842397;-80.216546,25.80759;-80.2395,25.7548?geometries=geojson&overview=full&access_token=YOUR_TOKEN
```

**Respuesta incluye:**
```json
{
  "routes": [
    {
      "geometry": {
        "type": "LineString",
        "coordinates": [[lng, lat], [lng, lat], ...]
      },
      "distance": 72709,
      "duration": 7200
    }
  ]
}
```

---

## 4. Errores Comunes

### Error 422 - Validation Error
```json
{
  "code": "validation_error",
  "message": "undefined must match pattern \"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(([+-]\\d\\d:\\d\\d)|Z)?$\""
}
```

**Solución:** Asegúrate de que `earliest_start` y `latest_end` estén en formato ISO 8601 completo:
- ✅ Correcto: `"2025-11-07T08:00:00.000Z"`
- ❌ Incorrecto: `"08:00"`
- ❌ Incorrecto: `"2025-11-07T08:00:00"` (falta timezone)

### Error 401 - Unauthorized
```json
{
  "message": "Not Authorized - Invalid Token"
}
```

**Solución:** Verifica tu token de acceso de Mapbox.

---

## 5. Convertir Odometer a Millas

El `odometer` viene en **metros**. Para convertir a millas:

```javascript
const meters = 72709
const miles = (meters / 1609.34).toFixed(1) // "45.2 mi"
```

---

## 6. Calcular Duración Total

La duración se calcula sumando:
- Tiempo de viaje entre paradas (de los odómetros)
- Tiempo de servicio en cada parada (`duration` en segundos)

```javascript
const lastStop = route.stops[route.stops.length - 1]
const startEta = new Date(route.stops[0].eta)
const endEta = new Date(lastStop.eta)
const totalMinutes = Math.floor((endEta - startEta) / 1000 / 60)
```

---

## Tu Token

```
pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q
```

## Prueba Rápida

Reemplaza `YOUR_TOKEN` con tu token y ejecuta en Postman o terminal:

```bash
curl -X POST "https://api.mapbox.com/optimized-trips/v2?access_token=pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q" \
  -H "Content-Type: application/json" \
  -d '{
  "version": 1,
  "locations": [
    {"name": "warehouse", "coordinates": [-80.2395, 25.7548]},
    {"name": "stop_1", "coordinates": [-80.216546, 25.80759]}
  ],
  "vehicles": [{
    "name": "vehicle_1",
    "routing_profile": "mapbox/driving",
    "start_location": "warehouse",
    "end_location": "warehouse",
    "earliest_start": "2025-11-07T08:00:00.000Z",
    "latest_end": "2025-11-07T20:00:00.000Z"
  }],
  "services": [{
    "name": "service_1",
    "location": "stop_1",
    "duration": 300
  }]
}'
```
