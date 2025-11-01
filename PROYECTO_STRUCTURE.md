# CUBARAPID - Estructura del Proyecto Multi-Servicios

## Visión General
Plataforma integral para la gestión y venta de servicios múltiples (remesas, recargas, renta de autos, pasajes, mercado) con arquitectura multi-tenant y sistema de wallet integrado.

## Arquitectura General

### Tecnología Stack
- **Frontend**: React + Next.js 15 (App Router)
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: SQLite (desarrollo) → PostgreSQL (producción)
- **ORM**: Prisma
- **Autenticación**: NextAuth.js + JWT
- **API**: REST + GraphQL (opcional para queries complejas)
- **Mobile**: React Native (para drivers)
- **Estilos**: Tailwind CSS + Shadcn/ui
- **Estado**: Zustand + React Query (TanStack Query)
- **Pagos**: Sistema de Wallet propio
- **File Storage**: Local/Cloudinary

## Estructura de Directorios

```
cubarapid/
├── backend/                    # API y lógica de negocio
│   ├── src/
│   │   ├── controllers/        # Controladores de API
│   │   ├── services/          # Lógica de negocio
│   │   ├── models/            # Modelos de base de datos
│   │   ├── middleware/        # Middleware de autenticación y validación
│   │   ├── routes/            # Definición de rutas
│   │   ├── utils/             # Utilidades
│   │   ├── config/            # Configuración
│   │   └── types/             # Tipos TypeScript
│   ├── prisma/                # Schema y migraciones
│   ├── tests/                 # Tests del backend
│   └── docs/                  # Documentación API
├── frontend/                  # Aplicación web principal
│   ├── src/
│   │   ├── app/               # App Router de Next.js
│   │   ├── components/        # Componentes reutilizables
│   │   │   ├── ui/            # Componentes base (shadcn/ui)
│   │   │   ├── forms/         # Formularios
│   │   │   ├── layout/        # Layouts
│   │   │   └── features/      # Componentes por funcionalidad
│   │   ├── lib/               # Utilidades y configuración
│   │   ├── hooks/             # Hooks personalizados
│   │   ├── store/             # Estado global (Zustand)
│   │   ├── types/             # Tipos TypeScript
│   │   └── public/            # Assets estáticos
│   ├── tests/                 # Tests del frontend
│   └── docs/                  # Documentación
├── mobile/                    # App React Native (Drivers)
│   ├── src/
│   │   ├── screens/           # Pantallas
│   │   ├── components/        # Componentes móviles
│   │   ├── navigation/        # Navegación
│   │   ├── services/          # Servicios API
│   │   ├── store/             # Estado
│   │   └── utils/             # Utilidades
│   └── android/ios/           # Plataformas específicas
├── shared/                    # Código compartido
│   ├── types/                 # Tipos compartidos
│   ├── utils/                 # Utilidades compartidas
│   └── constants/             # Constantes
├── docs/                      # Documentación del proyecto
└── scripts/                   # Scripts de automatización
```

## Módulos Principales

### 1. Sistema de Autenticación y Autorización
- **Roles**: Super Admin, Admin Empresa, Agencia, Broker, Driver, Cliente Final
- **Permisos**: RBAC (Role-Based Access Control)
- **Multi-tenant**: Aislamiento de datos por empresa y sucursales

### 2. Sistema de Wallet Integral
- **Cuentas**: Numeración única (2026 + 14 dígitos)
- **Operaciones**: Recarga, Transferencia entre wallets, Saldo en Diferentes Monedas 
- **Validaciones**: Saldo suficiente, límites transaccionales
- **Historial**: Registro completo de transacciones

### 3. Catálogo de Servicios
- **Remesas**: Envio de Remesas a Cuba
- **Paqueteria** Ordenes de Entrega de Paquetria y Recoleccion de la misma 
- **Recargas**: Movil y Nauta
- **Renta de Autos**: Flota management
- **Pasajes**: Terrestres, aéreos, marítimos
- **Mercado**: Pequenos mercados en toda la isla que me proporcionaran inventario y logistica de entrega el cual yo vendere atraves de la agencias y a estos mercados le entrara una orden de entrega la cual yo le voy acumulando su pago en su wallet y el pueda cobrar su dinero 

### 4. Sistema Multi-Marca (White Label)
- **Branding por Empresa**: Logo, colores, tipografía
- **Facturación Personalizada**: Plantillas configurables
- **Dominios Personalizados**: Subdominios por empresa

## Vista de Usuarios y Permisos

### 1. Super Administrador
- **Dashboard Global**: Métricas de toda la plataforma
- **Gestión de Empresas**: CRUD completo
- **Reportes Consolidados**: Todos los servicios y empresas
- **Configuración Global**: Parámetros del sistema
- **Sin Validaciones**: Acceso total a todas las operaciones

### 2. Administrador de Empresa
- **Dashboard Empresa**: Métricas propias y de sucursales
- **Gestión de Sucursales**: CRUD de sucursales propias
- **Gestión de Servicios**: Configurar servicios disponibles
- **Reportes Empresariales**: Datos de su empresa y sucursales
- **Wallet Management**: Recargas y transferencias

### 3. Agencia
- **Punto de Venta**: Vender todos los servicios habilitados
- **Gestión de Clientes**: Registro y consulta
- **Procesamiento de Órdenes**: Crear y gestionar órdenes
- **Reportes de Ventas**: Métricas de desempeño
- **Wallet Operations**: Consultar saldo, procesar pagos

### 4. Broker de Remesas
- **Gestión de Remesas**: Procesar remesas asignadas
- **Validación de Documentos**: Verificar identidad
- **Seguimiento de Envíos**: Track remesas
- **Comisiones**: Ver y gestionar comisiones

### 5. Drivers
- **Gestión de Entregas**: Ver entregas asignadas
- **Navegación**: Rutas optimizadas
- **Confirmación de Entrega**: Firmas y fotos
- **Historial de Servicios**: Entregas completadas

### 6. Mercado
- **Gestión de Productos**: Inventario y precios
- **Procesamiento de Pedidos**: Recibir y procesar
- **Logística**: Coordinar entregas
- **Reportes de Ventas**: Análisis de productos

## Modelo de Base de Datos (Entidades Principales)

```sql
-- Usuarios y Autenticación
Users (id, email, password, role, company_id, branch_id, created_at)
Companies (id, name, tax_id, phone, email, logo, colors, wallet_id, created_at)
Branches (id, company_id, name, address, phone, manager_id, created_at)

-- Sistema de Wallet
Wallets (id, account_number, balance, currency, company_id, created_at)
Transactions (id, wallet_id, type, amount, description, status, created_at)
Wallet_Transfers (id, from_wallet_id, to_wallet_id, amount, status, created_at)

-- Servicios
Services (id, name, type, commission_rate, status, company_id, created_at)
Orders (id, service_id, customer_id, agency_id, amount, status, created_at)

-- Remesas
Remittances (id, sender_id, receiver_id, amount, fee, status, broker_id, created_at)

-- Recargas
Recharges (id, phone_number, amount, carrier_id, agency_id, status, created_at)

-- Renta de Autos
Car_Rentals (id, customer_id, car_id, start_date, end_date, total_amount, status, created_at)
Cars (id, company_id, plate, model, year, status, created_at)

-- Pasajes
Tickets (id, route_id, passenger_id, seat_number, price, status, created_at)
Routes (id, origin, destination, price, company_id, created_at)

-- Mercado
Products (id, name, description, price, stock, category_id, company_id, created_at)
Product_Categories (id, name, company_id, created_at)
Orders_Products (order_id, product_id, quantity, price, created_at)

-- Drivers
Drivers (id, user_id, license_number, vehicle_info, status, created_at)
Deliveries (id, driver_id, order_id, status, delivered_at, created_at)
```

## Etapas del Proyecto

### Etapa 1: Fundación y Autenticación (2-3 semanas)
1. **Setup del Proyecto**
   - Configurar monorepo con Turborepo/Nx
   - Setup de Next.js 15 con App Router
   - Configurar Prisma con SQLite
   - Setup de autenticación con NextAuth.js

2. **Sistema de Usuarios y Roles**
   - Modelo de base de datos de usuarios
   - Sistema de registro y login
   - Implementación de roles y permisos
   - Middleware de autenticación

3. **Dashboard del Super Administrador**
   - Layout principal con sidebar
   - Vista global de empresas
   - Métricas generales
   - Gestión de usuarios

### Etapa 2: Sistema de Empresas y Wallet (3-4 semanas)
1. **Gestión de Empresas**
   - CRUD de empresas
   - Sistema de sucursales
   - Relaciones jerárquicas
   - Validaciones de acceso

2. **Sistema de Wallet**
   - Creación de cuentas (numeración 2026 + 16 dígitos)
   - Sistema de recargas
   - Transferencias entre wallets
   - Historial de transacciones
   - Validaciones y seguridad

3. **Branding y White Label**
   - Sistema de configuración visual
   - Upload de logos
   - Paletas de colores personalizadas
   - Plantillas de facturación

### Etapa 3: Módulo de Remesas (4-5 semanas)
1. **Catálogo de Remesas**
   - Gestión de rutas y tarifas
   - Configuración de comisiones
   - Integración con proveedores

2. **Procesamiento de Remesas**
   - Formulario de envío
   - Validación de documentos
   - Procesamiento de pagos
   - Seguimiento en tiempo real

3. **Panel de Brokers**
   - Asignación de remesas
   - Gestión de documentación
   - Reportes de comisiones
   - Herramientas de validación

### Etapa 4: Módulo de Recargas (2-3 semanas)
1. **Catálogo de Recargas**
   - Integración con operadores móviles
   - Configuración de servicios públicos
   - Gestión de comisiones

2. **Procesamiento de Recargas**
   - Formulario de recarga
   - Integración con pasarelas de pago
   - Confirmación automática
   - Notificaciones

### Etapa 5: Módulo de Renta de Autos (3-4 semanas)
1. **Gestión de Flota**
   - Catálogo de vehículos
   - Disponibilidad y precios
   - Mantenimiento y seguros

2. **Sistema de Reservas**
   - Calendario de disponibilidad
   - Cálculo de tarifas
   - Contratos digitales
   - Check-in/Check-out

### Etapa 6: Módulo de Pasajes (3-4 semanas)
1. **Gestión de Rutas**
   - Catálogo de rutas
   - Horarios y frecuencias
   - Precios dinámicos

2. **Sistema de Boletos**
   - Selección de asientos
   - Generación de boletos
   - Validación QR
   - Reportes de ocupación

### Etapa 7: Módulo de Mercado (4-5 semanas)
1. **Gestión de Productos**
   - Catálogo de productos
   - Control de inventario
   - Categorías y atributos

2. **Sistema de E-commerce**
   - Carrito de compras
   - Procesamiento de pedidos
   - Integración con pagos
   - Gestión de envíos

### Etapa 8: Aplicación Mobile Drivers (3-4 semanas)
1. **App React Native**
   - Setup del proyecto
   - Navegación y pantallas
   - Conexión con API

2. **Funcionalidades de Drivers**
   - Gestión de entregas
   - Navegación GPS
   - Confirmación de entrega
   - Comunicación con clientes

### Etapa 9: Integración y Testing (2-3 semanas)
1. **Integración Total**
   - Conexión entre módulos
   - Testing end-to-end
   - Performance optimization

2. **Deploy y Producción**
   - Configuración de producción
   - Migración a PostgreSQL
   - Setup de monitoreo
   - Documentación final

## Consideraciones Técnicas

### Seguridad
- Encriptación de datos sensibles
- Validaciones de entrada
- Rate limiting
- Auditoría de acciones

### Escalabilidad
- Arquitectura modular
- Base de datos optimizada
- Caching estratégico
- CDN para assets

### Performance
- Code splitting
- Lazy loading
- Optimización de imágenes
- Estrategias de caché

### Testing
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright)
- Testing de carga

## Próximos Pasos

1. **Revisión y Aprobación**: Analizar esta estructura detalladamente
2. **Ajustes**: Modificar según feedback y requerimientos específicos
3. **Setup Inicial**: Configurar el proyecto con las herramientas elegidas
4. **Comenzar Etapa 1**: Iniciar con la fundación y autenticación

¿Qué te parece esta estructura? ¿Hay algún módulo o aspecto que te gustaría modificar o detallar más antes de comenzar con la implementación?