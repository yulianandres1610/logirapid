# 🚀 Backend - CUBARAPID

## 📋 Descripción General

Este es el backend modular del sistema CUBARAPID, enfocado en la gestión de tasas de cambio y configuraciones para agencias. Está diseñado con arquitectura limpia, TypeScript y patrones de diseño modernos.

## 🏗️ Estructura del Proyecto

```
backend/
├── 📁 api/                    # Endpoints REST API
├── 📁 services/              # Lógica de negocio
├── 📁 types/                 # Definiciones TypeScript
├── 📁 utils/                 # Utilidades compartidas
├── 📁 docs/                  # Documentación completa
├── 📁 tests/                 # Suite de tests
└── 📁 config/                # Configuración del sistema
```

## 🔧 Features Principales

### 1. 📊 Sistema de Tasas de Agencia
- **Configuración dinámica** de porcentajes de ajuste
- **Cálculo automático** de tasas para agencias
- **Historial de tasas** con métricas y tendencias
- **Validación de rangos** y reglas de negocio

### 2. 🔄 Integración con eltoque
- **Conexión en tiempo real** con API de eltoque
- **Sistema de caché** robusto para desconexiones
- **Fallback automático** con tasas de emergencia
- **Health monitoring** del API externa

### 3. 🛡️ Seguridad y Validación
- **Validación estricta** de entrada de datos
- **Sanitización** de parámetros
- **Manejo de errores** centralizado
- **Logging estructurado** para auditoría

## 🚀 Quick Start

### 1. Instalación
```bash
# Asegurarse de tener Node.js 18+
node --version

# Instalar dependencias
npm install

# Variables de entorno
cp .env.example .env
```

### 2. Ejecutar en Desarrollo
```bash
# Modo desarrollo con hot-reload
npm run dev

# Modo producción
npm run build
npm start
```

### 3. Ejemplo de Uso
```typescript
import { AgencyRatesService } from './services/agency-rates.service'

// Obtener instancia del servicio
const service = AgencyRatesService.getInstance()

// Calcular tasas
const rates = service.calculateAgencyRates()

// Obtener configuración
const config = service.getConfig()
```

## 📚 Documentación

### API Documentation
- **📖 [API de Tasas de Agencia](./docs/API_AGENCY_RATES.md)** - Documentación completa del API
- **📋 [Estructura del Backend](./docs/BACKEND_STRUCTURE.md)** - Arquitectura y patrones

### Guías Rápidas
- **🔧 [Setup Guide](./docs/SETUP.md)** - Configuración inicial
- **🧪 [Testing Guide](./docs/TESTING.md)** - Guía de testing
- **🚀 [Deployment Guide](./docs/DEPLOYMENT.md)** - Guía de despliegue

## 🔌 API Endpoints

### Tasas de Agencia
```
GET    /api/agency-rates           # Obtener todas las tasas
GET    /api/agency-rates?currency=USD&breakdown=true  # Desglose
POST   /api/agency-rates           # Actualizar configuración
PUT    /api/agency-rates           # Actualizar tasas base
DELETE /api/agency-rates           # Restablecer configuración
```

### Health Check
```
GET    /api/health                 # Health general
GET    /api/health/agency-rates   # Health específico
```

## 📊 Tipos de Datos Principales

### AgencyRate
```typescript
interface AgencyRate {
  currency: string           // USD, EUR, MLC, etc.
  baseRate: number           // Tasa base eltoque
  agencyRate: number        // Tasa calculada
  adjustmentPercentage: number // Porcentaje aplicado
  lastUpdate: string        // Timestamp
  formattedBaseRate: string
  formattedAgencyRate: string
}
```

### AgencyRatesConfig
```typescript
interface AgencyRatesConfig {
  id: string
  adjustmentPercentage: number  // -50% a +100%
  isActive: boolean          // Estado activo
  createdAt: string
  updatedAt: string
  createdBy: string
}
```

## 🔄 Flujo de Trabajo

### 1. Obtener Tasas
```typescript
// 1. Sistema obtiene tasas base desde eltoque
// 2. Aplica configuración del administrador
// 3. Calcula tasas para agencias
// 4. Retorna resultados con formato estándar

const response = await fetch('/api/agency-rates')
const { success, data } = await response.json()
```

### 2. Actualizar Configuración
```typescript
// 1. Validar nuevo porcentaje
// 2. Actualizar configuración
// 3. Recalcular todas las tasas
// 4. Persistir cambios

const update = await fetch('/api/agency-rates', {
  method: 'POST',
  body: JSON.stringify({ adjustmentPercentage: 10 })
})
```

## 🛠️ Servicios Disponibles

### AgencyRatesService
- **Singleton pattern** para instancia global
- **Cálculo automático** de tasas
- **Validación** de configuraciones
- **Historial** de tasas

```typescript
class AgencyRatesService {
  // Calcular tasas con configuración actual
  calculateAgencyRates(): Record<string, AgencyRate>

  // Actualizar configuración
  updateConfig(config: Partial<AgencyRatesConfig>): void

  // Validar nuevo porcentaje
  validateConfig(percentage: number): ValidationResult

  // Obtener desglose de cálculo
  getCalculationBreakdown(currency: string): CalculationBreakdown
}
```

## 🔧 Utilidades

### ResponseHelper
```typescript
// Respuestas estandarizadas
ResponseHelper.success(data, message)
ResponseHelper.error(error, details)
ResponseHelper.created(data, message)
ResponseHelper.paginated(data, page, limit, total)
```

### ValidationHelper
```typescript
// Validaciones comunes
ValidationHelper.validateEmail(email)
ValidationHelper.validatePercentage(value)
ValidationHelper.validateCurrency(currency)
ValidationHelper.validateRequired(obj, fields)
```

### FormatHelper
```typescript
// Formateo de datos
FormatHelper.formatCurrency(amount, currency)
FormatHelper.formatDate(date, locale)
FormatHelper.formatPercentage(value)
```

## 📈 Patrones de Diseño

### 1. Singleton
- **AgencyRatesService** - Única instancia global
- **Configuración compartida** - Acceso centralizado

### 2. Repository
- **Abstracción** de acceso a datos
- **Testing friendly** con mocks

### 3. Factory
- **Creación** de objetos complejos
- **Manejo** de dependencias

### 4. Observer
- **Notificación** de cambios
- **Reactividad** del sistema

## 🔐 Seguridad

### Validación de Entrada
- **Range validation** para porcentajes (-50% a +100%)
- **Type checking** estricto
- **Input sanitization**

### Manejo de Errores
- **Try-catch** en operaciones asíncronas
- **Mensajes** descriptivos sin exponer detalles sensibles
- **Logging** estructurado para auditoría

### Autenticación
- **JWT tokens** para acceso seguro
- **Role-based** authorization
- **Rate limiting** para prevenir abuso

## 🚀 Performance

### Estrategias de Caché
- **Memory cache** para datos frecuentes
- **LocalStorage** para configuración persistente
- **Time-to-Live** para datos temporales

### Optimización
- **Lazy loading** de servicios
- **Batch processing** para operaciones masivas
- **Debouncing** para actualizaciones frecuentes

## 📊 Monitoreo

### Logging
```typescript
// Logs estructurados
logger.info('Agency rates updated', {
  userId: 'admin123',
  adjustmentPercentage: 5,
  affectedCurrencies: 9,
  processingTime: 150
})
```

### Métricas
- **Response time** de endpoints
- **Error rates** por feature
- **Cache hit rates**
- **Business metrics** (tasa updates, etc.)

## 🧪 Testing

### Unit Tests
```bash
# Ejecutar tests unitarios
npm run test:unit

# Con coverage
npm run test:coverage
```

### Integration Tests
```bash
# Tests de integración de APIs
npm run test:integration

# Tests con base de datos real
npm run test:e2e
```

## 🚀 Deployment

### Development
```bash
# Build del proyecto
npm run build

# Iniciar servidor
npm start
```

### Producción
```bash
# Variables de entorno
export NODE_ENV=production
export PORT=3001

# Build optimizado
npm run build:prod

# Iniciar en modo producción
npm run start:prod
```

### Docker
```bash
# Construir imagen
docker build -t cubarapid-backend .

# Ejecutar contenedor
docker run -p 3001:3001 cubarapid-backend
```

## 📝 Contribución

### Guidelines
1. **Seguir** la estructura establecida
2. **Tipar** todo el código TypeScript
3. **Documentar** funciones y clases
4. **Testear** todas las features nuevas
5. **Respetar** las convenciones de nomenclatura

### Pull Requests
1. **Branch** desde `develop`
2. **Tests** pasando
3. **Code review** aprobado
4. **Documentación** actualizada
5. **Merge** a `main`

## 🔗 Links Útiles

- **[Frontend](../src/)** - Aplicación cliente
- **[API Documentation](./docs/API_AGENCY_RATES.md)** - Referencia de API
- **[Architecture Guide](./docs/BACKEND_STRUCTURE.md)** - Arquitectura

---

Este backend proporciona una base sólida y escalable para el sistema de gestión de tasas de CUBARAPID, con arquitectura limpia, testing completo y documentación detallada.