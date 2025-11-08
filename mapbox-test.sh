#!/bin/bash

# Test de Mapbox Optimization API v2
# Basado en la documentación oficial

MAPBOX_TOKEN="pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q"

# Fecha de hoy en formato ISO 8601
TODAY=$(date +%Y-%m-%d)
EARLIEST_START="${TODAY}T08:00:00.000Z"
LATEST_END="${TODAY}T20:00:00.000Z"

echo "🧪 Probando Mapbox Optimization API v2"
echo "📅 Fecha: $TODAY"
echo "⏰ Ventana: $EARLIEST_START - $LATEST_END"
echo ""

# Documento de optimización según la documentación oficial
curl -X POST "https://api.mapbox.com/optimized-trips/v2?access_token=${MAPBOX_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
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
      "earliest_start": "'"${EARLIEST_START}"'",
      "latest_end": "'"${LATEST_END}"'"
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
}' | jq '.'

echo ""
echo "✅ Si la respuesta contiene un 'id', la solicitud fue exitosa"
echo "❌ Si hay un error, revisa el mensaje de validación"
