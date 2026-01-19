# Proyecto: Logirapid Customer App

## Descripcion General

Aplicacion web para clientes de Logirapid LLC donde pueden ordenar servicios de:
- **Remesas/Cupones Familiares** - Envio de dinero a Cuba
- **Recargas Moviles** - Recargas a telefonos cubanos via Cubacel
- **Recogida a Domicilio** - Pickup de paquetes con tracking y Mapbox
- **Marketplace** (Fase 2) - Compra de productos

**URL Produccion**: `clientes.logirapid.com`
**Backend existente**: `logirapid.com` (Next.js 14, PostgreSQL en Supabase)

---

## Stack Tecnologico

| Tecnologia | Uso |
|------------|-----|
| Next.js 14+ | Framework (App Router) |
| TypeScript | Tipado estatico |
| Supabase Auth | Autenticacion de clientes |
| Supabase (PostgreSQL) | Base de datos existente |
| Tailwind CSS | Estilos |
| Mapbox GL JS | Mapas y direcciones |
| shadcn/ui | Componentes UI |

---

## 1. Autenticacion con Supabase

### 1.1 Configuracion

```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 1.2 Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://iiznelkfuqtjopxhyprs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieXVsaWFuZGlhemdhcmNpYSIsImEiOiJjbTRsdDZ...
```

### 1.3 Tabla de Clientes

```sql
-- Nueva tabla para clientes (separada de users que es para admin)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL, -- Supabase Auth user ID
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  phone_country_code VARCHAR(5) DEFAULT '+1',
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'United States',
  zip_code VARCHAR(20),
  -- Para Cuba (beneficiarios frecuentes)
  default_recipient_name VARCHAR(255),
  default_recipient_ci VARCHAR(20), -- Carnet de identidad
  default_recipient_phone VARCHAR(20),
  default_recipient_province VARCHAR(100),
  default_recipient_municipality VARCHAR(100),
  default_recipient_address TEXT,
  -- Metadata
  preferred_language VARCHAR(2) DEFAULT 'es',
  notification_email BOOLEAN DEFAULT true,
  notification_sms BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de beneficiarios guardados
CREATE TABLE customer_beneficiaries (
  id SERIAL PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  ci VARCHAR(20), -- Carnet de identidad Cuba
  phone VARCHAR(20),
  province VARCHAR(100),
  municipality VARCHAR(100),
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.4 Paginas de Auth

| Ruta | Descripcion |
|------|-------------|
| `/login` | Login con email/password |
| `/register` | Registro de nuevo cliente |
| `/forgot-password` | Recuperar contrasena |
| `/reset-password` | Establecer nueva contrasena |

### 1.5 Flujo de Registro

1. Cliente ingresa email y password
2. Supabase Auth crea el usuario
3. Trigger o API crea registro en tabla `customers`
4. Redirige a `/dashboard`

---

## 2. Servicio de Remesas (Cupones Familiares)

### 2.1 Descripcion

Los clientes pueden enviar dinero a Cuba en forma de "cupones familiares". El dinero se convierte a MLC/CUP y el beneficiario puede recogerlo o usarlo para compras.

### 2.2 Flujo de Usuario

```
1. Seleccionar servicio "Enviar Remesa"
2. Elegir beneficiario (guardado o nuevo)
3. Ingresar monto en USD
4. Ver conversion a MLC/CUP (tasa de ElToque)
5. Seleccionar metodo de pago
6. Confirmar y pagar
7. Recibir confirmacion con codigo de seguimiento
```

### 2.3 API Existente

**Endpoint**: `POST /api/remittance-orders`

```typescript
// Request body
{
  "customerId": 123,              // ID del cliente que envia
  "agencyId": 1,                  // Logirapid LLC (fijo)
  "recipientName": "Juan Perez",
  "recipientCi": "85010112345",
  "recipientPhone": "+5352123456",
  "recipientProvince": "La Habana",
  "recipientMunicipality": "Plaza de la Revolucion",
  "recipientAddress": "Calle 23 #456",
  "amountUsd": 100,
  "amountMlc": 100,              // Calculado con tasa
  "exchangeRate": 1.0,
  "deliveryMethod": "pickup",    // pickup | delivery
  "notes": "Urgente",
  "paymentMethod": "card"
}

// Response
{
  "success": true,
  "data": {
    "id": 456,
    "orderNumber": "REM-2025-0001",
    "status": "pending"
  }
}
```

### 2.4 Tasa de Cambio (ElToque API)

```typescript
// GET https://tasas.eltoque.com/v1/trmi
// Response:
{
  "tasas": {
    "USD": { "buy": 325, "sell": 330 },
    "MLC": { "buy": 280, "sell": 285 }
  }
}
```

### 2.5 UI Componentes

```
RemittanceForm/
├── BeneficiarySelector.tsx      # Seleccionar/crear beneficiario
├── AmountInput.tsx              # Monto con conversion en vivo
├── ExchangeRateDisplay.tsx      # Mostrar tasa actual
├── DeliveryMethodSelector.tsx   # Pickup o delivery
├── PaymentMethodSelector.tsx    # Tarjeta, Zelle, etc
└── ConfirmationStep.tsx         # Resumen antes de pagar
```

---

## 3. Servicio de Recargas Moviles

### 3.1 Descripcion

Recargas a telefonos Cubacel (Cuba). Integracion con UnivCell para procesamiento.

### 3.2 Flujo de Usuario

```
1. Seleccionar "Recargas"
2. Ingresar numero de telefono cubano (+53 5XXXXXXX)
3. Seleccionar monto de recarga ($10, $20, $30, etc)
4. Ver precio final con comision
5. Confirmar y pagar
6. Recibir confirmacion instantanea
```

### 3.3 API Existente

**Endpoint**: `POST /api/admin/recargas`

```typescript
// Request body
{
  "phoneNumber": "+5352123456",
  "amount": 20,                    // Monto de recarga en USD
  "operatorCode": "cubacel",
  "userId": 123,                   // Cliente que compra
  "companyId": 1                   // Logirapid LLC
}

// Response
{
  "success": true,
  "data": {
    "transactionId": "TXN-123456",
    "status": "completed",
    "finalAmount": 22.50           // Con comision
  }
}
```

### 3.4 Montos Disponibles

```typescript
const RECHARGE_AMOUNTS = [
  { value: 10, display: '$10', commission: 2.50 },
  { value: 15, display: '$15', commission: 3.75 },
  { value: 20, display: '$20', commission: 5.00 },
  { value: 25, display: '$25', commission: 6.25 },
  { value: 30, display: '$30', commission: 7.50 },
  { value: 50, display: '$50', commission: 12.50 },
]
```

### 3.5 UI Componentes

```
RechargeForm/
├── PhoneInput.tsx               # Input +53 con validacion
├── AmountSelector.tsx           # Grid de montos
├── PriceBreakdown.tsx           # Desglose monto + comision
├── RecentRecharges.tsx          # Numeros recientes
└── ConfirmationStep.tsx         # Confirmar y pagar
```

---

## 4. Servicio de Recogida a Domicilio (Pickup)

### 4.1 Descripcion

Los clientes pueden solicitar que un conductor recoja paquetes en su domicilio para envio a Cuba via ApaCargo.

### 4.2 Flujo de Usuario

```
1. Seleccionar "Recogida a Domicilio"
2. Ingresar direccion de recogida (Mapbox Autofill)
3. Confirmar ubicacion en mapa
4. Detalles del paquete (peso, dimensiones, contenido)
5. Datos del destinatario en Cuba
6. Seleccionar fecha/hora de recogida
7. Ver cotizacion
8. Confirmar y pagar
9. Tracking en tiempo real
```

### 4.3 API Existente

**Endpoint**: `POST /api/pickup-orders`

```typescript
// Request body
{
  "customerId": 123,
  "agencyId": 1,
  // Direccion de recogida
  "pickupAddress": "123 Main St, Miami, FL 33125",
  "pickupLatitude": 25.7617,
  "pickupLongitude": -80.1918,
  "pickupInstructions": "Apartamento 3B",
  // Paquete
  "packageDescription": "Ropa y medicinas",
  "packageWeight": 15,           // libras
  "packageLength": 24,           // pulgadas
  "packageWidth": 18,
  "packageHeight": 12,
  "declaredValue": 150,
  // Destinatario Cuba
  "recipientName": "Maria Garcia",
  "recipientCi": "75020112345",
  "recipientPhone": "+5352987654",
  "recipientProvince": "Pinar del Rio",
  "recipientMunicipality": "Pinar del Rio",
  "recipientAddress": "Ave Marti #123",
  // Programacion
  "scheduledDate": "2025-01-25",
  "scheduledTimeSlot": "morning", // morning, afternoon, evening
  "estimatedCost": 45.00
}

// Response
{
  "success": true,
  "data": {
    "id": 789,
    "orderNumber": "PKG-2025-0001",
    "trackingNumber": "APA123456789",
    "status": "pending_pickup"
  }
}
```

### 4.4 Integracion Mapbox

```typescript
// Componente de direccion con autofill
import { AddressAutofill } from '@mapbox/search-js-react'

<AddressAutofill accessToken={MAPBOX_TOKEN}>
  <input
    name="address"
    placeholder="Ingrese direccion"
    autoComplete="address-line1"
  />
</AddressAutofill>

// Mapa para confirmar ubicacion
import mapboxgl from 'mapbox-gl'

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-80.1918, 25.7617], // Miami default
  zoom: 12
})
```

### 4.5 Ubicaciones Cuba

```typescript
// Archivo existente: /src/lib/cuba-locations.ts
export const CUBA_PROVINCES = [
  { code: 'PRI', name: 'Pinar del Rio' },
  { code: 'ART', name: 'Artemisa' },
  { code: 'HAB', name: 'La Habana' },
  { code: 'MAY', name: 'Mayabeque' },
  // ... 16 provincias total
]

export const CUBA_MUNICIPALITIES: Record<string, string[]> = {
  'HAB': ['Playa', 'Plaza de la Revolucion', 'Centro Habana', ...],
  'PRI': ['Pinar del Rio', 'Consolacion del Sur', ...],
  // ...
}
```

### 4.6 UI Componentes

```
PickupForm/
├── AddressAutofill.tsx          # Input con Mapbox autofill
├── MapConfirmation.tsx          # Mapa para confirmar pin
├── PackageDetails.tsx           # Peso, dimensiones, contenido
├── RecipientForm.tsx            # Datos Cuba con provincias
├── SchedulePicker.tsx           # Fecha y franja horaria
├── QuoteDisplay.tsx             # Cotizacion estimada
└── TrackingView.tsx             # Vista de tracking
```

---

## 5. Dashboard del Cliente

### 5.1 Paginas

| Ruta | Descripcion |
|------|-------------|
| `/dashboard` | Vista principal con resumen |
| `/dashboard/remittances` | Historial de remesas |
| `/dashboard/recharges` | Historial de recargas |
| `/dashboard/pickups` | Ordenes de recogida |
| `/dashboard/profile` | Perfil y beneficiarios |
| `/dashboard/beneficiaries` | Gestionar beneficiarios |

### 5.2 Dashboard Principal

```
+----------------------------------+
|  Bienvenido, [Nombre]            |
+----------------------------------+
|                                  |
|  [Enviar Remesa]  [Recargar]     |
|                                  |
|  [Recogida]       [Marketplace]  |
|                                  |
+----------------------------------+
|  Ordenes Recientes               |
|  - Remesa #123 - Completada      |
|  - Recarga +535... - Procesando  |
|  - Pickup #456 - En camino       |
+----------------------------------+
```

---

## 6. Estructura de Archivos

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (customer)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # Dashboard principal
│   │   │   ├── remittances/page.tsx      # Historial remesas
│   │   │   ├── recharges/page.tsx        # Historial recargas
│   │   │   ├── pickups/page.tsx          # Ordenes pickup
│   │   │   ├── profile/page.tsx          # Perfil
│   │   │   └── beneficiaries/page.tsx    # Beneficiarios
│   │   ├── send-remittance/page.tsx      # Formulario remesa
│   │   ├── recharge/page.tsx             # Formulario recarga
│   │   └── schedule-pickup/page.tsx      # Formulario pickup
│   ├── api/
│   │   ├── customer/
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   └── profile/route.ts
│   │   │   ├── remittances/route.ts      # Proxy a backend
│   │   │   ├── recharges/route.ts        # Proxy a backend
│   │   │   ├── pickups/route.ts          # Proxy a backend
│   │   │   └── beneficiaries/route.ts
│   │   └── exchange-rates/route.ts       # ElToque proxy
│   └── layout.tsx
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── AuthGuard.tsx
│   ├── remittance/
│   │   ├── BeneficiarySelector.tsx
│   │   ├── AmountInput.tsx
│   │   └── RemittanceForm.tsx
│   ├── recharge/
│   │   ├── PhoneInput.tsx
│   │   ├── AmountSelector.tsx
│   │   └── RechargeForm.tsx
│   ├── pickup/
│   │   ├── AddressAutofill.tsx
│   │   ├── MapConfirmation.tsx
│   │   ├── PackageDetails.tsx
│   │   └── PickupForm.tsx
│   ├── shared/
│   │   ├── CubaLocationSelector.tsx
│   │   ├── PaymentMethodSelector.tsx
│   │   └── OrderStatusBadge.tsx
│   └── ui/                               # shadcn components
├── lib/
│   ├── supabase-client.ts
│   ├── supabase-server.ts
│   ├── cuba-locations.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useExchangeRate.ts
│   └── useBeneficiaries.ts
└── types/
    └── index.ts
```

---

## 7. APIs a Crear

### 7.1 Customer Auth

```typescript
// POST /api/customer/auth/register
{
  "email": "cliente@email.com",
  "password": "securepass123",
  "fullName": "Juan Cliente",
  "phone": "+13051234567"
}

// Response: { success: true, customerId: "uuid" }
```

### 7.2 Customer Remittances (Proxy)

```typescript
// POST /api/customer/remittances
// Valida auth de Supabase, luego llama a backend existente
// Agrega customerId desde sesion

// GET /api/customer/remittances
// Lista ordenes del cliente autenticado
```

### 7.3 Customer Recharges (Proxy)

```typescript
// POST /api/customer/recharges
// GET /api/customer/recharges
```

### 7.4 Customer Pickups (Proxy)

```typescript
// POST /api/customer/pickups
// GET /api/customer/pickups
// GET /api/customer/pickups/[id]/tracking
```

### 7.5 Beneficiaries

```typescript
// GET /api/customer/beneficiaries
// POST /api/customer/beneficiaries
// PUT /api/customer/beneficiaries/[id]
// DELETE /api/customer/beneficiaries/[id]
```

---

## 8. Middleware de Autenticacion

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Rutas publicas
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password']

  if (publicPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
    // Si ya tiene sesion, redirigir a dashboard
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return res
  }

  // Rutas protegidas
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)']
}
```

---

## 9. Estilos y Diseno

### 9.1 Paleta de Colores

```css
:root {
  --primary: #2563eb;        /* Azul Logirapid */
  --primary-dark: #1d4ed8;
  --secondary: #f59e0b;      /* Naranja accent */
  --success: #10b981;
  --danger: #ef4444;
  --background: #f8fafc;
  --card: #ffffff;
  --text: #1e293b;
  --text-muted: #64748b;
}
```

### 9.2 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Bottom navigation en mobile
- Sidebar en desktop

---

## 10. Orden de Implementacion

### Fase 1: Setup Base
1. Crear proyecto Next.js 14 con TypeScript
2. Configurar Tailwind CSS y shadcn/ui
3. Configurar Supabase Auth
4. Crear tabla `customers` y `customer_beneficiaries`
5. Implementar layout base con navegacion

### Fase 2: Autenticacion
1. Pagina de login
2. Pagina de registro
3. Recuperacion de password
4. AuthGuard y middleware

### Fase 3: Dashboard
1. Dashboard principal con cards de servicios
2. Pagina de perfil
3. Gestion de beneficiarios

### Fase 4: Remesas
1. Formulario de remesa
2. Selector de beneficiarios
3. Integracion tasa de cambio ElToque
4. Historial de remesas

### Fase 5: Recargas
1. Formulario de recarga
2. Selector de montos
3. Historial de recargas

### Fase 6: Pickup
1. Integracion Mapbox
2. Formulario de pickup
3. Vista de tracking
4. Historial de pickups

---

## 11. Conexion con Backend Existente

### 11.1 Base de Datos

La app se conecta a la misma base de datos PostgreSQL en Supabase que usa el sistema admin:

```
Host: db.iiznelkfuqtjopxhyprs.supabase.co
Database: postgres
```

### 11.2 Tablas Compartidas

- `remittance_orders` - Ordenes de remesa
- `recharge_transactions` - Transacciones de recarga
- `package_orders` - Ordenes de pickup
- `companies` - Logirapid LLC (id=1)
- `users` - Solo para referencia, clientes en `customers`

### 11.3 Ordenes Visibles en Admin

Todas las ordenes creadas por clientes aparecen en:
- `logirapid.com/dashboard/remittance` - Remesas
- `logirapid.com/dashboard/recharge` - Recargas
- `logirapid.com/dashboard/pickup` - Pickups

El admin puede ver `customer_id` para identificar el cliente.

---

## 12. Variables de Entorno Completas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://iiznelkfuqtjopxhyprs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieXVsaWFuZGlhemdhcmNpYSIsImEiOiJjbTRsdDZ...

# API Backend (para proxies)
BACKEND_API_URL=https://logirapid.com/api
BACKEND_API_KEY=internal-api-key

# ElToque (tasas de cambio)
ELTOQUE_API_URL=https://tasas.eltoque.com/v1/trmi

# Logirapid Company ID
LOGIRAPID_COMPANY_ID=1
```

---

## 13. Notas Importantes

1. **Separacion de Usuarios**: Los clientes usan Supabase Auth y tabla `customers`. El sistema admin usa JWT propio y tabla `users`. No mezclar.

2. **Company ID**: Todas las ordenes se crean con `company_id = 1` (Logirapid LLC). El sistema es multi-tenant pero esta app es solo para Logirapid.

3. **Pagos**: En Fase 1, los pagos se marcan como "pending" y se procesan manualmente. En Fase 2 se integra Stripe.

4. **Cuba Locations**: Usar la libreria existente `/src/lib/cuba-locations.ts` que tiene las 16 provincias y sus municipios.

5. **Mapbox**: Ya hay componentes existentes en el proyecto principal que se pueden referenciar: `/src/components/maps/RouteMap.tsx` y `/src/components/ui/MapboxAddressAutofill.tsx`

6. **Estados de Orden**:
   - Remesas: `pending`, `processing`, `completed`, `cancelled`
   - Recargas: `pending`, `completed`, `failed`
   - Pickups: `pending_pickup`, `picked_up`, `in_transit`, `delivered`

---

## 14. Endpoints del Backend Existente (Referencia)

### Remesas
- `POST /api/remittance-orders` - Crear orden
- `GET /api/remittance-orders?customerId=X` - Listar por cliente
- `GET /api/remittance-orders/[id]` - Detalle de orden

### Recargas
- `POST /api/admin/recargas` - Crear recarga
- `GET /api/admin/recargas?userId=X` - Listar por usuario

### Pickups
- `POST /api/pickup-orders` - Crear orden
- `GET /api/pickup-orders?customerId=X` - Listar por cliente
- `GET /api/pickup-orders/[id]` - Detalle con tracking

---

Este documento contiene toda la informacion necesaria para que Vibecode desarrolle la aplicacion de clientes de Logirapid.
