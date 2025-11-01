# API de Tasas de Agencia

## 📋 Descripción General

La API de Tasas de Agencia permite gestionar las tasas de cambio que aplican a las agencias, basándose en las tasas base deltoque con un porcentaje de ajuste configurado por el administrador.

## 🔗 Endpoint Base

```
/api/agency-rates
```

## 🔧 Métodos Disponibles

### 1. GET - Obtener Tasas de Agencia

**URL:** `/api/agency-rates`

**Descripción:** Obtiene todas las tasas de agencia calculadas según la configuración actual.

**Parámetros Query:**
- `currency` (string, opcional): Filtrar por moneda específica (USD, EUR, MLC, etc.)
- `breakdown` (boolean, opcional): Obtener desglose del cálculo
- `history` (boolean, opcional): Obtener historial de tasas
- `days` (number, opcional): Días de historial (default: 30)

**Ejemplos:**

```bash
# Obtener todas las tasas
GET /api/agency-rates

# Obtener tasa de USD con desglose
GET /api/agency-rates?currency=USD&breakdown=true

# Obtener historial de EUR últimos 7 días
GET /api/agency-rates?currency=EUR&history=true&days=7
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "rates": {
      "USD": {
        "currency": "USD",
        "baseRate": 475,
        "agencyRate": 498.75,
        "adjustmentPercentage": 5,
        "lastUpdate": "2025-01-20T10:30:00.000Z",
        "formattedBaseRate": "475.00",
        "formattedAgencyRate": "498.75"
      }
    },
    "config": {
      "id": "global_config_1",
      "adjustmentPercentage": 5,
      "isActive": true,
      "createdAt": "2025-01-20T10:00:00.000Z",
      "updatedAt": "2025-01-20T10:30:00.000Z",
      "createdBy": "system"
    },
    "timestamp": "2025-01-20T10:30:00.000Z"
  }
}
```

### 2. POST - Actualizar Configuración

**URL:** `/api/agency-rates`

**Descripción:** Actualiza el porcentaje de ajuste y/o el estado de activación de las tasas de agencia.

**Body Request:**
```json
{
  "adjustmentPercentage": 10,
  "isActive": true
}
```

**Ejemplo:**
```bash
curl -X POST /api/agency-rates \
  -H "Content-Type: application/json" \
  -d '{
    "adjustmentPercentage": 10,
    "isActive": true
  }'
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "rates": {
      "USD": {
        "currency": "USD",
        "baseRate": 475,
        "agencyRate": 522.50,
        "adjustmentPercentage": 10,
        "lastUpdate": "2025-01-20T10:35:00.000Z",
        "formattedBaseRate": "475.00",
        "formattedAgencyRate": "522.50"
      }
    },
    "config": {
      "id": "global_config_1",
      "adjustmentPercentage": 10,
      "isActive": true,
      "createdAt": "2025-01-20T10:00:00.000Z",
      "updatedAt": "2025-01-20T10:35:00.000Z",
      "createdBy": "system"
    },
    "timestamp": "2025-01-20T10:35:00.000Z"
  },
  "message": "Configuración de tasas actualizada exitosamente"
}
```

### 3. PUT - Actualizar Tasas Base

**URL:** `/api/agency-rates`

**Descripción:** Actualiza las tasas base desde eltoque y recalcular las tasas de agencia.

**Body Request:**
```json
{
  "rates": {
    "USD": 475,
    "EUR": 530,
    "MLC": 200,
    "GBP": 488.84,
    "CAD": 310,
    "MXN": 22.33,
    "BRL": 77.14,
    "ZELLE": 453.08,
    "CLA": 438.27
  }
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "rates": {
      "USD": {
        "currency": "USD",
        "baseRate": 475,
        "agencyRate": 522.50,
        "adjustmentPercentage": 10,
        "lastUpdate": "2025-01-20T10:40:00.000Z",
        "formattedBaseRate": "475.00",
        "formattedAgencyRate": "522.50"
      }
    },
    "config": {
      "id": "global_config_1",
      "adjustmentPercentage": 10,
      "isActive": true,
      "createdAt": "2025-01-20T10:00:00.000Z",
      "updatedAt": "2025-01-20T10:40:00.000Z",
      "createdBy": "system"
    },
    "baseRates": {
      "USD": 475,
      "EUR": 530,
      "MLC": 200
    },
    "timestamp": "2025-01-20T10:40:00.000Z"
  },
  "message": "Tasas base actualizadas y recalculadas exitosamente"
}
```

### 4. DELETE - Restablecer Configuración

**URL:** `/api/agency-rates`

**Descripción:** Restablece la configuración a los valores por defecto (+5% activo).

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "rates": {
      "USD": {
        "currency": "USD",
        "baseRate": 475,
        "agencyRate": 498.75,
        "adjustmentPercentage": 5,
        "lastUpdate": "2025-01-20T10:45:00.000Z",
        "formattedBaseRate": "475.00",
        "formattedAgencyRate": "498.75"
      }
    },
    "config": {
      "id": "global_config_1",
      "adjustmentPercentage": 5,
      "isActive": true,
      "createdAt": "2025-01-20T10:00:00.000Z",
      "updatedAt": "2025-01-20T10:45:00.000Z",
      "createdBy": "system"
    },
    "timestamp": "2025-01-20T10:45:00.000Z"
  },
  "message": "Configuración restablecida a valores por defecto"
}
```

## 📊 Modelos de Datos

### AgencyRate
```typescript
interface AgencyRate {
  currency: string           // Código de moneda (USD, EUR, etc.)
  baseRate: number           // Tasa base desde eltoque
  agencyRate: number        // Tasa calculada para agencia
  adjustmentPercentage: number // Porcentaje de ajuste aplicado
  lastUpdate: string        // Timestamp de última actualización
  formattedBaseRate: string   // Tasa base formateada (475.00)
  formattedAgencyRate: string // Tasa agencia formateada (498.75)
  variation?: number         // Variación diaria (opcional)
}
```

### AgencyRatesConfig
```typescript
interface AgencyRatesConfig {
  id: string               // ID único de configuración
  adjustmentPercentage: number // Porcentaje de ajuste (-50 a 100)
  isActive: boolean         // Estado de activación
  createdAt: string        // Fecha de creación
  updatedAt: string        // Fecha de última actualización
  createdBy: string        // Usuario que creó la configuración
  companyId?: string       // ID de compañía (opcional)
}
```

### CalculationBreakdown
```typescript
interface CalculationBreakdown {
  currency: string           // Moneda
  baseRate: number           // Tasa base
  adjustmentPercentage: number // Porcentaje aplicado
  calculatedRate: number     // Resultado calculado
  formula: string           // Fórmula utilizada
  breakdown: {
    baseAmount: number      // Monto base
    adjustment: number       // Ajuste aplicado
    finalAmount: number      // Monto final
  }
}
```

## 🚨 Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Parámetros inválidos |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

### Ejemplos de Error:

**400 - Parámetro inválido:**
```json
{
  "success": false,
  "error": "Se requiere adjustmentPercentage como número",
  "timestamp": "2025-01-20T10:50:00.000Z"
}
```

**404 - Moneda no encontrada:**
```json
{
  "success": false,
  "error": "No se encontró información para la moneda XYZ",
  "timestamp": "2025-01-20T10:50:00.000Z"
}
```

**500 - Error interno:**
```json
{
  "success": false,
  "error": "Error interno del servidor al obtener tasas de agencia",
  "timestamp": "2025-01-20T10:50:00.000Z"
}
```

## 📝 Reglas de Validación

### Porcentaje de Ajuste
- **Tipo:** Número
- **Rango:** -50% a +100%
- **Valores especiales:**
  - 0% = "Al toque" (sin ajuste)
  - Negativo = Reducción de tasa
  - Positivo = Incremento de tasa

### Monedas Soportadas
- **USD** - Dólar Americano
- **EUR** - Euro
- **MLC** - Tarjeta de Débito
- **GBP** - Libra Esterlina
- **CAD** - Dólar Canadiense
- **MXN** - Peso Mexicano
- **BRL** - Real Brasileño
- **ZELLE** - Transferencia Zelle
- **CLA** - CashApp

### Fórmula de Cálculo
```
tasa_agencia = tasa_base × (1 + porcentaje_ajuste ÷ 100)
```

**Ejemplos:**
- Base: 475, Ajuste: +5% → 475 × (1 + 5/100) = 498.75
- Base: 475, Ajuste: -10% → 475 × (1 - 10/100) = 427.50
- Base: 475, Ajuste: 0% → 475 × (1 + 0/100) = 475.00

## 🔄 Flujo de Trabajo

1. **Obtener Tasas Base:** El sistema obtiene las tasas desde eltoque
2. **Aplicar Configuración:** Usa el porcentaje configurado por el admin
3. **Calcular Tasas:** Aplica la fórmula a cada moneda
4. **Guardar/Cache:** Almacena resultados para acceso rápido
5. **Responder:** Devuelve las tasas calculadas

## 🛠️ Ejemplos de Uso

### JavaScript/TypeScript
```typescript
// Obtener todas las tasas
const response = await fetch('/api/agency-rates')
const data = await response.json()

if (data.success) {
  console.log('Tasas USD:', data.data.rates.USD)
  console.log('Configuración:', data.data.config)
}

// Actualizar configuración
const updateResponse = await fetch('/api/agency-rates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adjustmentPercentage: 15,
    isActive: true
  })
})

const updateData = await updateResponse.json()
console.log('Actualizado:', updateData.message)
```

### cURL
```bash
# Obtener tasas con desglose
curl -X GET "http://localhost:3001/api/agency-rates?currency=USD&breakdown=true"

# Actualizar configuración
curl -X POST "http://localhost:3001/api/agency-rates" \
  -H "Content-Type: application/json" \
  -d '{"adjustmentPercentage": 8, "isActive": true}'

# Restablecer configuración
curl -X DELETE "http://localhost:3001/api/agency-rates"
```

## 📈 Métricas y Monitoreo

La API incluye timestamps en todas las respuestas para:
- **Trazabilidad:** Seguimiento de cambios
- **Cache:** Validación de datos frescos
- **Auditoría:** Registro de actividades
- **Debugging:** Identificación de problemas

## 🔒 Consideraciones de Seguridad

- **Validación de entrada:** Todos los parámetros son validados
- **Rangos restringidos:** Porcentajes limitados a -50% a +100%
- **Logging:** Todas las operaciones son registradas
- **Error handling:** Errores no exponen información sensible

## 📚 Notas Adicionales

- Las tasas se actualizan automáticamente cuando cambian las tasas base
- La configuración se persiste en localStorage del cliente
- El historial es simulado para fines de demostración
- Los cálculos usan redondeo a 2 decimales estándar financiero