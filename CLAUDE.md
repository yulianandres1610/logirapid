# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LogiRapid/CubaRapid** is a multi-tenant logistics and package delivery management platform built with Next.js 15, TypeScript, and PostgreSQL (Supabase). It provides comprehensive package tracking, route optimization via Mapbox, fleet management, CRM, and multi-service capabilities (remittances, recharges, marketplace).

## Development Commands

```bash
# Development server (runs on port 3000)
npm run dev

# Production build
npm run build

# Start production server (runs on port 3000)
npm start

# Type checking (run before committing)
npm run type-check

# Linting
npm run lint
```

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 15.0.0 (App Router)
- **Database:** PostgreSQL via Supabase (connection via pg library)
- **Maps:** Mapbox GL JS 3.16 for route optimization and geocoding
- **Auth:** Custom cookie-based authentication (NOT NextAuth despite dependency)
- **State:** React Context API (ThemeContext, NotificationContext, CompanyContext)
- **Forms:** React Hook Form + Zod validation
- **UI:** Radix UI primitives, Tailwind CSS with custom theming

### Database Architecture

**Primary PostgreSQL Database:** Supabase-hosted PostgreSQL

Core tables and their relationships:
- **users** → **user_companies** ← **companies**: Multi-tenant user management
- **package_orders**: Core delivery orders with geolocation (latitude/longitude)
- **routes**: Delivery routes with Mapbox-optimized waypoints (stored as JSON)
- **customers** → **customer_addresses**: CRM with multi-address support
- **customer_change_history**: Full audit trail for customer modifications
- **warehouses**: Depot locations with coordinates for route start/end points
- **transactions**: Financial ledger tied to companies
- **agency_rates_config** / **agency_rates_history**: Multi-currency exchange rates

**Database Access Pattern:**
- Direct synchronous queries via `src/lib/database.ts`
- Use `db.transaction()` for multi-step operations
- Complex data (services, waypoints) stored as JSON strings
- Schema migrations via try-catch ALTER TABLE blocks

**Secondary JSON Stores:**
- `data/fleet.json`: Vehicle fleet and driver assignments
- `data/packages.json`: Box inventory, pricing, and shipments
- `data/vehicles.json`: Additional vehicle data

### Authentication System

**Mock Authentication** (for development):
```typescript
// Login credentials in src/hooks/useAuth.ts:
admin@cubarapid.com / admin123      → SUPER_ADMIN
empresa@cubaexpress.com / empresa123 → ADMIN
manager@cubaexpress.com / manager123 → MANAGER
usuario@cubaexpress.com / usuario123 → USER
```

**Role-Based Access:**
- **SUPER_ADMIN**: Platform-wide access, all companies
- **ADMIN**: Company admin, manage users and services
- **MANAGER**: Create users, recharge wallets, no transfers
- **USER**: Sell services, debit from wallet

**Session Management:**
- Cookies: `auth-token`, `user-role`, `user-company-id`, `user-company-name`
- Middleware (`src/middleware.ts`) enforces role-based routing
- Auto-redirect to role-appropriate dashboard

### API Route Patterns

**Standard Response Format:**
```typescript
{ success: boolean, data?: T, error?: string }
```

**Key API Groups:**
- `/api/package-orders/*`: Package management, cancel, reprogram
- `/api/routes/*`: Route creation with Mapbox optimization
  - Use `?saveRoute=false` to preview optimization without persisting
- `/api/customers/*`: CRM operations
- `/api/fleet/vehicles/*`: Fleet management
- `/api/agency-rates/*`: Exchange rate configuration
- `/api/warehouses/*`: Warehouse CRUD

**Query Patterns:**
- Pagination: `?page=1&limit=10`
- Filtering: `?status=pending&search=term`
- All routes use try-catch with 500 error responses

### Route Optimization Architecture

**Mapbox Integration:**
- Token: Environment variable or hardcoded in components
- API: Mapbox Directions API (`/directions/v5/mapbox/driving`)
- Features: TSP optimization, alternative routes, Spanish language

**Optimization Flow:**
1. Select package orders with valid coordinates
2. Filter by date and status (pending/reprogrammed)
3. Build waypoint sequence: warehouse → delivery stops → warehouse
4. Call Mapbox API with `alternatives=true`
5. Display routes in `RouteMap.tsx` for selection
6. On confirm: save to `routes` table, update orders to `in_transit`

**Route Data Structure:**
```typescript
routes table:
- waypoints: JSON array of {orderId, address, coordinates, sequence}
- distance: miles
- duration: minutes
- status: planning | active | completed | cancelled
- driver_id, vehicle_id: assigned resources
```

### Key Components

**Layout System:**
- `DashboardLayout`: Sidebar + Header + scrollable content
- Role-based sidebar menu rendering
- Theme-aware with CSS variable system

**Map Components:**
- `RouteMap.tsx`: Interactive route selection with alternative visualization
- Displays numbered waypoint markers and warehouse locations
- Color-coded routes: optimal (red), alternatives (gray)

**Form Wizards:**
- `PackageOrderWizard`: Multi-step order creation
- `VehicleRegistrationForm`: Fleet onboarding
- All use React Hook Form + Zod schemas

### State Management Conventions

**Use Context For:**
- Global theme state (ThemeContext)
- Notification queue (NotificationContext)
- Company branding (CompanyContext)

**Use Local State For:**
- Form state (React Hook Form)
- UI toggles (modals, dropdowns)
- Component-specific data

**Custom Hooks:**
- `useAuth`: Authentication state and login/logout
- `useAgencyRates`: Exchange rate fetching with ElToque API
- `useCompanyInfo`: Multi-tenancy company data

### File Organization

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API route handlers
│   └── dashboard/         # Role-based dashboard routes
├── components/
│   ├── layout/            # DashboardLayout, Sidebar, Header
│   ├── maps/              # Mapbox integration components
│   ├── ui/                # Radix UI primitives
│   └── protected-route.tsx
├── contexts/              # React Context providers
├── hooks/                 # Custom React hooks
├── lib/
│   └── database.ts        # PostgreSQL database access layer
└── middleware.ts          # Auth and routing middleware

data/
├── fleet.json            # Fleet management
└── packages.json         # Box inventory
```

### Important Conventions

**Imports:**
- Use `@/` prefix for absolute imports
- Example: `import { db } from '@/lib/database'`

**Styling:**
- Tailwind utility classes
- Custom theme via CSS variables: `--exa-primary`, `--exa-secondary`, `--exa-gradient-*`
- Theme values in `tailwind.config.js`

**Data Formats:**
- Dates: ISO 8601 strings
- Currency: USD primary, multi-currency support in agency rates
- Distance: Miles and kilometers
- Coordinates: Decimal degrees (latitude, longitude)

**TypeScript:**
- Strict mode enabled
- Run `npm run type-check` before commits
- Define types inline or in component files

### Mapbox Configuration

**Token Location:** Hardcoded in map components (should be env var)

**Map Styles:**
- Dark mode: `mapbox://styles/mapbox/dark-v11`
- Light mode: `mapbox://styles/mapbox/streets-v12`

**APIs Used:**
- Directions API: Route optimization
- Geocoding API: Address to coordinates conversion

### Common Development Patterns

**Adding a New API Route:**
1. Create handler in `src/app/api/[resource]/route.ts`
2. Import `db` from `@/lib/database`
3. Use try-catch with standard response format
4. Add TypeScript types for request/response

**Adding a New Database Table:**
1. Add creation SQL in `src/lib/database.ts` initialization
2. Use try-catch for ALTER TABLE if adding to existing schema
3. Update TypeScript types
4. Consider adding indexes for query performance

**Working with Package Orders:**
- Always include geolocation data (latitude/longitude)
- Status flow: pending → in_transit → delivered → completed
- Services stored as JSON: `[{type, name, price, quantity}]`
- Link to routes via `routes.waypoints` JSON array

**Working with Routes:**
- Routes must start and end at a warehouse
- Waypoints stored as JSON with sequence numbers
- Use Mapbox for optimization, not manual sorting
- Update linked package_orders.status when route status changes

### Multi-Tenancy Notes

- Each company has isolated wallet and transaction limits
- Company branding (logos, colors) stored in `companies` table
- Users can belong to multiple companies via `user_companies`
- Rate configurations are company-specific via `company_agency_configs`

### Testing Checklist

When modifying core features, verify:
- [ ] Type check passes (`npm run type-check`)
- [ ] Database migrations don't break existing data
- [ ] Role-based access works for all user types
- [ ] Map coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
- [ ] Routes include warehouse as start/end point
- [ ] Currency calculations handle decimal precision
- [ ] Forms validate with Zod schemas before submission
