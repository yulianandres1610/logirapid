import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // ============================================================
  // MAINTENANCE MODE - All logirapid.com domains
  // ============================================================
  // Set to true to enable maintenance mode, false to disable
  const MAINTENANCE_MODE = false  // ← DESACTIVADO

  if (MAINTENANCE_MODE) {
    // Check if it's a logirapid.com domain (including subdomains)
    const isLogiRapidDomain = host.includes('logirapid.com') || host.includes('localhost')

    if (isLogiRapidDomain) {
      // Allow static resources for the maintenance page to render properly
      if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/images') ||
        pathname === '/favicon.ico' ||
        pathname === '/maintenance.html' ||
        pathname === '/maintenance'
      ) {
        return NextResponse.next()
      }

      // Redirect all other requests to maintenance page
      console.log('[MIDDLEWARE] Maintenance mode - redirecting to maintenance.html:', pathname)
      return NextResponse.rewrite(new URL('/maintenance.html', request.url))
    }
  }

  // ============================================================
  // SUPPLIER SUBDOMAIN HANDLING - proveedores.logirapid.com
  // ============================================================
  const isSupplierSubdomain = host.startsWith('proveedores.') || host.includes('proveedores.logirapid')

  if (isSupplierSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow supplier login page
    if (pathname === '/supplier/login') {
      return NextResponse.next()
    }

    // Allow supplier API routes
    if (pathname.startsWith('/api/supplier')) {
      return NextResponse.next()
    }

    // Check for supplier-token on supplier dashboard routes
    if (pathname.startsWith('/dashboard/supplier')) {
      const supplierToken = request.cookies.get('supplier-token')?.value

      if (!supplierToken) {
        console.log('[MIDDLEWARE] Supplier subdomain - no token, redirecting to login')
        const loginUrl = new URL('/supplier/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate supplier JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(supplierToken, secret)

        if (payload.type !== 'supplier') {
          throw new Error('Invalid token type')
        }

        console.log('[MIDDLEWARE] Supplier authenticated:', payload.supplierCode)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid supplier token:', error)
        const loginUrl = new URL('/supplier/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to supplier login or dashboard
    if (pathname === '/') {
      const supplierToken = request.cookies.get('supplier-token')?.value
      if (supplierToken) {
        return NextResponse.redirect(new URL('/dashboard/supplier', request.url))
      }
      return NextResponse.redirect(new URL('/supplier/login', request.url))
    }

    // Block other routes on supplier subdomain
    console.log('[MIDDLEWARE] Supplier subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/supplier/login', request.url))
  }

  // ============================================================
  // MARKET SUBDOMAIN HANDLING - mercado.logirapid.com
  // ============================================================
  const isMarketSubdomain = host.startsWith('mercado.') || host.includes('mercado.logirapid')

  if (isMarketSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow market login page
    if (pathname === '/market/login') {
      return NextResponse.next()
    }

    // Allow public upload page (phone upload via QR)
    if (pathname.startsWith('/upload/')) {
      return NextResponse.next()
    }

    // Allow door-kiosk routes (public kiosk pages)
    if (pathname.startsWith('/door-kiosk')) {
      return NextResponse.next()
    }

    // Allow public quote signing page (no auth required)
    if (pathname.startsWith('/quote-sign')) {
      return NextResponse.next()
    }

    // Allow market API routes (including consignments, purchases, order-invoices, uploads, migrations, ai, print, users, audit)
    if (pathname.startsWith('/api/market') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/public') ||
        pathname.startsWith('/api/consignments') ||
        pathname.startsWith('/api/order-invoices') ||
        pathname.startsWith('/api/upload') ||
        pathname.startsWith('/api/migrations') ||
        pathname.startsWith('/api/ai') ||
        pathname.startsWith('/api/print') ||
        pathname.startsWith('/api/users') ||
        pathname.startsWith('/api/audit') ||
        pathname.startsWith('/api/companies') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/apps')) {
      return NextResponse.next()
    }

    // Check for auth-token on market dashboard routes
    if (pathname.startsWith('/dashboard/market')) {
      const authToken = request.cookies.get('auth-token')?.value

      if (!authToken) {
        console.log('[MIDDLEWARE] Market subdomain - no token, redirecting to login')
        const loginUrl = new URL('/market/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)

        // Verify user belongs to a market company
        if (payload.companyType !== 'market') {
          console.log('[MIDDLEWARE] User is not from market company, redirecting to login')
          const loginUrl = new URL('/market/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        console.log('[MIDDLEWARE] Market user authenticated:', payload.email)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid token on market subdomain:', error)
        const loginUrl = new URL('/market/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to market login or dashboard
    if (pathname === '/') {
      const authToken = request.cookies.get('auth-token')?.value
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
          const secret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(authToken, secret)

          if (payload.companyType === 'market') {
            return NextResponse.redirect(new URL('/dashboard/market', request.url))
          }
        } catch {
          // Token invalid, redirect to login
        }
      }
      return NextResponse.redirect(new URL('/market/login', request.url))
    }

    // Block other routes on market subdomain
    console.log('[MIDDLEWARE] Market subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/market/login', request.url))
  }

  // ============================================================
  // DOOR KIOSK SUBDOMAIN HANDLING - puerta.logirapid.com, puerta.servisumic.com
  // Must be checked BEFORE factory subdomain to avoid being caught by servisumic.com wildcard
  // ============================================================
  const isDoorKioskSubdomain =
    host.startsWith('puerta.') ||
    host.includes('puerta.logirapid') ||
    host.includes('puerta.servisumic')

  if (isDoorKioskSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow PWA resources: service worker, workbox, manifests, icons
    if (
      pathname === '/sw.js' ||
      pathname.startsWith('/workbox-') ||
      pathname.startsWith('/fallback-') ||
      pathname.startsWith('/icons/') ||
      pathname.endsWith('-manifest.json') ||
      pathname === '/favicon.png'
    ) {
      return NextResponse.next()
    }

    // Allow door security API routes (for kiosk operations)
    if (pathname.startsWith('/api/market/door-security') ||
        pathname.startsWith('/api/ai/scan-id-document') ||
        pathname.startsWith('/api/ai/scan-receipt') ||
        pathname.startsWith('/api/apps')) {
      return NextResponse.next()
    }

    // Allow door-kiosk pages - /door-kiosk/[kioskId]
    if (pathname.startsWith('/door-kiosk/')) {
      return NextResponse.next()
    }

    // Redirect root to door-kiosk selector page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/door-kiosk', request.url))
    }

    // Allow /door-kiosk routes
    if (pathname === '/door-kiosk' || pathname.startsWith('/door-kiosk')) {
      return NextResponse.next()
    }

    // Block other routes on door kiosk subdomain
    console.log('[MIDDLEWARE] Door kiosk subdomain - blocking route:', pathname)
    return NextResponse.rewrite(new URL('/door-kiosk', request.url))
  }

  // ============================================================
  // FACTORY SUBDOMAIN HANDLING - fabrica.servisumic.com
  // ============================================================
  const isFactorySubdomain =
    host.startsWith('fabrica.') ||
    host.includes('servisumic.com') ||
    host.includes('fabrica.servisumic')

  if (isFactorySubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow print service agent files (public, no auth needed)
    if (pathname.startsWith('/print-service/') || pathname.startsWith('/api/print-agent')) {
      return NextResponse.next()
    }

    // Allow factory login page
    if (pathname === '/factory/login' || pathname.startsWith('/factory/login')) {
      return NextResponse.next()
    }

    // Allow public upload page (phone upload via QR)
    if (pathname.startsWith('/upload/')) {
      return NextResponse.next()
    }

    // Allow door-kiosk routes (public kiosk pages)
    if (pathname.startsWith('/door-kiosk')) {
      return NextResponse.next()
    }

    // Allow public quote signing page (no auth required)
    if (pathname.startsWith('/quote-sign')) {
      return NextResponse.next()
    }

    // Allow market API routes (same as market subdomain - factory uses market dashboard)
    if (pathname.startsWith('/api/market') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/public') ||
        pathname.startsWith('/api/consignments') ||
        pathname.startsWith('/api/order-invoices') ||
        pathname.startsWith('/api/upload') ||
        pathname.startsWith('/api/migrations') ||
        pathname.startsWith('/api/ai') ||
        pathname.startsWith('/api/print') ||
        pathname.startsWith('/api/users') ||
        pathname.startsWith('/api/audit') ||
        pathname.startsWith('/api/companies') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/apps')) {
      return NextResponse.next()
    }

    // Check for auth-token on market dashboard routes
    if (pathname.startsWith('/dashboard/market')) {
      const authToken = request.cookies.get('auth-token')?.value

      if (!authToken) {
        console.log('[MIDDLEWARE] Factory subdomain - no token, redirecting to login')
        const loginUrl = new URL('/factory/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)

        // Verify user belongs to a market company
        if (payload.companyType !== 'market') {
          console.log('[MIDDLEWARE] User is not from market company, redirecting to login')
          const loginUrl = new URL('/factory/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        console.log('[MIDDLEWARE] Factory user authenticated:', payload.email)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid token on factory subdomain:', error)
        const loginUrl = new URL('/factory/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to factory login or dashboard
    if (pathname === '/') {
      const authToken = request.cookies.get('auth-token')?.value
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
          const secret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(authToken, secret)

          if (payload.companyType === 'market') {
            return NextResponse.redirect(new URL('/dashboard/market', request.url))
          }
        } catch {
          // Token invalid, redirect to login
        }
      }
      return NextResponse.redirect(new URL('/factory/login', request.url))
    }

    // Block other routes on factory subdomain
    console.log('[MIDDLEWARE] Factory subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/factory/login', request.url))
  }

  // ============================================================
  // EMPLOYEE SUBDOMAIN HANDLING - empleados.logirapid.com
  // ============================================================
  const isEmployeeSubdomain = host.startsWith('empleados.') || host.includes('empleados.logirapid')

  if (isEmployeeSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow employee login page
    if (pathname === '/employee/login') {
      return NextResponse.next()
    }

    // Allow employee API routes
    if (pathname.startsWith('/api/employee')) {
      return NextResponse.next()
    }

    // Check for employee-auth-token on employee dashboard routes
    if (pathname.startsWith('/employee/')) {
      const employeeToken = request.cookies.get('employee-auth-token')?.value

      if (!employeeToken) {
        console.log('[MIDDLEWARE] Employee subdomain - no token, redirecting to login')
        const loginUrl = new URL('/employee/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate employee JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(employeeToken, secret)

        if (payload.type !== 'employee') {
          throw new Error('Invalid token type')
        }

        console.log('[MIDDLEWARE] Employee authenticated:', payload.employeeCode)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid employee token:', error)
        const loginUrl = new URL('/employee/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to employee login or dashboard
    if (pathname === '/') {
      const employeeToken = request.cookies.get('employee-auth-token')?.value
      if (employeeToken) {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/employee/login', request.url))
    }

    // Block other routes on employee subdomain
    console.log('[MIDDLEWARE] Employee subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/employee/login', request.url))
  }

  // ============================================================
  // BROKER SUBDOMAIN HANDLING - broker.logirapid.com
  // ============================================================
  const isBrokerSubdomain = host.startsWith('broker.') || host.includes('broker.logirapid')

  if (isBrokerSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow broker login page
    if (pathname === '/broker/login') {
      return NextResponse.next()
    }

    // Allow broker API routes
    if (pathname.startsWith('/api/broker') || pathname.startsWith('/api/auth')) {
      return NextResponse.next()
    }

    // Check for auth-token on broker dashboard routes
    if (pathname.startsWith('/dashboard/broker')) {
      const authToken = request.cookies.get('auth-token')?.value

      if (!authToken) {
        console.log('[MIDDLEWARE] Broker subdomain - no token, redirecting to login')
        const loginUrl = new URL('/broker/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)

        // Verify user belongs to a broker company
        if (payload.companyType !== 'broker') {
          console.log('[MIDDLEWARE] User is not from broker company, redirecting to login')
          const loginUrl = new URL('/broker/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        console.log('[MIDDLEWARE] Broker user authenticated:', payload.email)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid token on broker subdomain:', error)
        const loginUrl = new URL('/broker/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to broker login or dashboard
    if (pathname === '/') {
      const authToken = request.cookies.get('auth-token')?.value
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
          const secret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(authToken, secret)

          if (payload.companyType === 'broker') {
            return NextResponse.redirect(new URL('/dashboard/broker', request.url))
          }
        } catch {
          // Token invalid, redirect to login
        }
      }
      return NextResponse.redirect(new URL('/broker/login', request.url))
    }

    // Block other routes on broker subdomain
    console.log('[MIDDLEWARE] Broker subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/broker/login', request.url))
  }

  // ============================================================
  // DRIVER SUBDOMAIN HANDLING - driver.logirapid.com
  // ============================================================
  const isDriverSubdomain = host.startsWith('driver.') || host.includes('driver.logirapid')

  if (isDriverSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow driver login page
    if (pathname === '/driver/login') {
      return NextResponse.next()
    }

    // Allow driver API routes
    if (pathname.startsWith('/api/driver-app') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/products') || pathname.startsWith('/api/apps')) {
      return NextResponse.next()
    }

    // Check for auth-token on driver routes
    if (pathname.startsWith('/driver/') || pathname === '/driver') {
      const authToken = request.cookies.get('auth-token')?.value

      if (!authToken) {
        console.log('[MIDDLEWARE] Driver subdomain - no token, redirecting to login')
        const loginUrl = new URL('/driver/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)

        // Allow DRIVER, ADMIN, and SUPER_ADMIN roles
        const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
        if (!allowedRoles.includes(payload.role as string)) {
          console.log('[MIDDLEWARE] User role not allowed for driver portal:', payload.role)
          const loginUrl = new URL('/driver/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        console.log('[MIDDLEWARE] Driver authenticated:', payload.email)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid token on driver subdomain:', error)
        const loginUrl = new URL('/driver/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to driver login or routes
    if (pathname === '/') {
      const authToken = request.cookies.get('auth-token')?.value
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
          const secret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(authToken, secret)

          const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
          if (allowedRoles.includes(payload.role as string)) {
            return NextResponse.redirect(new URL('/driver/routes', request.url))
          }
        } catch {
          // Token invalid, redirect to login
        }
      }
      return NextResponse.redirect(new URL('/driver/login', request.url))
    }

    // Block other routes on driver subdomain
    console.log('[MIDDLEWARE] Driver subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/driver/login', request.url))
  }

  // ============================================================
  // AUDIT SUBDOMAIN HANDLING - auditoria.logirapid.com
  // ============================================================
  const isAuditSubdomain = host.startsWith('auditoria.') || host.includes('auditoria.logirapid')

  if (isAuditSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow audit login page
    if (pathname === '/audit/login') {
      return NextResponse.next()
    }

    // Allow audit API routes
    if (pathname.startsWith('/api/audit') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/print')) {
      return NextResponse.next()
    }

    // Check for auth-token on audit dashboard routes
    if (pathname.startsWith('/dashboard/audit')) {
      const authToken = request.cookies.get('auth-token')?.value

      if (!authToken) {
        console.log('[MIDDLEWARE] Audit subdomain - no token, redirecting to login')
        const loginUrl = new URL('/audit/login', request.url)
        return NextResponse.redirect(loginUrl)
      }

      // Validate JWT
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)

        // Verify user is MARKET_MANAGER from market company
        if (payload.companyType !== 'market') {
          console.log('[MIDDLEWARE] User is not from market company, redirecting to login')
          const loginUrl = new URL('/audit/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        if (payload.role !== 'MARKET_MANAGER') {
          console.log('[MIDDLEWARE] User is not MARKET_MANAGER, redirecting to login')
          const loginUrl = new URL('/audit/login', request.url)
          return NextResponse.redirect(loginUrl)
        }

        console.log('[MIDDLEWARE] Audit user authenticated:', payload.email)
        return NextResponse.next()
      } catch (error) {
        console.error('[MIDDLEWARE] Invalid token on audit subdomain:', error)
        const loginUrl = new URL('/audit/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Redirect root to audit login or dashboard
    if (pathname === '/') {
      const authToken = request.cookies.get('auth-token')?.value
      if (authToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
          const secret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(authToken, secret)

          if (payload.companyType === 'market' && payload.role === 'MARKET_MANAGER') {
            return NextResponse.redirect(new URL('/dashboard/audit', request.url))
          }
        } catch {
          // Token invalid, redirect to login
        }
      }
      return NextResponse.redirect(new URL('/audit/login', request.url))
    }

    // Block other routes on audit subdomain
    console.log('[MIDDLEWARE] Audit subdomain - blocking route:', pathname)
    return NextResponse.redirect(new URL('/audit/login', request.url))
  }

  // ============================================================
  // ATTENDANCE KIOSK SUBDOMAIN HANDLING - asistencia.logirapid.com
  // ============================================================
  const isAttendanceSubdomain = host.startsWith('asistencia.') || host.includes('asistencia.logirapid')

  if (isAttendanceSubdomain) {
    // Allow static resources
    if (pathname.startsWith('/_next') || pathname.startsWith('/images') || pathname === '/favicon.ico') {
      return NextResponse.next()
    }

    // Allow kiosk API routes (for attendance operations)
    if (pathname.startsWith('/api/market/hr/kiosks') ||
        pathname.startsWith('/api/market/hr/attendance')) {
      return NextResponse.next()
    }

    // Allow kiosk pages - /kiosk/[kioskId] or /[kioskId]
    if (pathname.startsWith('/kiosk/') || pathname.match(/^\/\d+$/)) {
      return NextResponse.next()
    }

    // Redirect root to kiosk selector page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/kiosk', request.url))
    }

    // Allow /kiosk routes
    if (pathname === '/kiosk' || pathname.startsWith('/kiosk')) {
      return NextResponse.next()
    }

    // Block other routes on attendance subdomain
    console.log('[MIDDLEWARE] Attendance subdomain - blocking route:', pathname)
    return NextResponse.rewrite(new URL('/kiosk', request.url))
  }

  // ============================================================
  // REGULAR DOMAIN HANDLING
  // ============================================================

  // Rutas que no requieren autenticación
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth/error',
    '/tracking',
    '/pricing',
    '/contact',
    '/consentimiento-sms',
    '/developers',
    '/developers/documentacion',
    '/developers/playground',
    '/supplier/login',  // Supplier login is also public on main domain
    '/employee/login',  // Employee login is also public on main domain
    '/market/login',    // Market login is also public on main domain
    '/broker/login',    // Broker login is also public on main domain
    '/driver/login',    // Driver login is also public on main domain
    '/audit/login',     // Audit login is also public on main domain
    '/factory/login',   // Factory login is also public on main domain
  ]

  // Recursos estáticos (pero NO API)
  const staticRoutes = [
    '/_next',
    '/images',
    '/favicon.ico',
    '/robots.txt'
  ]

  // Public catalog routes
  if (pathname.startsWith('/catalog/') || pathname.startsWith('/api/public/catalog/')) {
    return NextResponse.next()
  }

  // Catalog subdomain: catalogo.* → rewrite to /catalog/[slug] resolved from DB
  if (host.startsWith('catalogo.') || host.includes('catalogo.logirapid') || host.includes('catalogo.servisumic')) {
    // For catalog subdomains, serve the catalog page
    // The slug will be resolved by the catalog page itself based on the host
    if (pathname === '/' || pathname === '') {
      // Rewrite root to a special catalog resolver
      const url = request.nextUrl.clone()
      url.pathname = '/api/public/catalog/resolve'
      url.searchParams.set('host', host)
      // Instead of API, redirect to catalog with host-based resolution
      // For now, rewrite to the catalog page that resolves by host
      url.pathname = '/catalog/_resolve'
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // Verificar si la ruta es pública
  if (publicRoutes.includes(pathname) || staticRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // ============================================================
  // SUPPLIER DASHBOARD ON MAIN DOMAIN - Uses supplier-token
  // ============================================================
  if (pathname.startsWith('/dashboard/supplier')) {
    const supplierToken = request.cookies.get('supplier-token')?.value

    if (!supplierToken) {
      console.log('[MIDDLEWARE] Supplier dashboard - no token, redirecting to login')
      const loginUrl = new URL('/supplier/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Validate supplier JWT
    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jwtVerify(supplierToken, secret)

      if (payload.type !== 'supplier') {
        throw new Error('Invalid token type')
      }

      console.log('[MIDDLEWARE] Supplier authenticated on main domain:', payload.supplierCode)
      return NextResponse.next()
    } catch (error) {
      console.error('[MIDDLEWARE] Invalid supplier token on main domain:', error)
      const loginUrl = new URL('/supplier/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Supplier API routes don't need auth-token, they use supplier-token
  if (pathname.startsWith('/api/supplier')) {
    return NextResponse.next()
  }

  // Employee API routes don't need auth-token, they use employee-auth-token
  if (pathname.startsWith('/api/employee')) {
    return NextResponse.next()
  }

  // Para rutas API públicas, no requerir autenticación
  if (pathname.startsWith('/api/public')) {
    return NextResponse.next()
  }

  // WhatsApp webhooks - rutas públicas para Twilio
  if (pathname.startsWith('/api/whatsapp')) {
    return NextResponse.next()
  }

  // Payment links - rutas públicas para pagos
  if (pathname.startsWith('/api/payment-links')) {
    return NextResponse.next()
  }

  // App updates - check-update is public, releases requires auth (handled in route)
  if (pathname.startsWith('/api/apps')) {
    return NextResponse.next()
  }

  // Para rutas API, inyectar headers de autenticación y multi-tenancy
  if (pathname.startsWith('/api')) {
    const authToken = request.cookies.get('auth-token')?.value
    const response = NextResponse.next()

    // Si hay token JWT, validarlo y extraer información (usando jose para Edge Runtime)
    if (authToken && !pathname.includes('/api/auth/login')) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)
        const decodedToken = payload as any

        // Inyectar headers desde el JWT decodificado
        response.headers.set('x-auth-token', authToken)
        response.headers.set('x-user-id', decodedToken.userId?.toString() || '')
        response.headers.set('x-user-role', decodedToken.role || '')
        response.headers.set('x-user-email', decodedToken.email || '')
        response.headers.set('x-is-super-admin', decodedToken.role === 'SUPER_ADMIN' ? 'true' : 'false')
        if (decodedToken.companyId) {
          response.headers.set('x-company-id', decodedToken.companyId.toString())
        }
        if (decodedToken.companyName) {
          response.headers.set('x-company-name', decodedToken.companyName)
        }
      } catch (error) {
        // Token inválido - continuar sin inyectar headers
        console.error('[MIDDLEWARE] Invalid JWT for API route:', error)
      }
    } else {
      // Fallback para cookies (para compatibilidad temporal)
      const userRole = request.cookies.get('user-role')?.value
      const companyId = request.cookies.get('user-company-id')?.value
      const companyName = request.cookies.get('user-company-name')?.value
      const userId = request.cookies.get('user-id')?.value

      if (authToken) {
        response.headers.set('x-auth-token', authToken)
      }
      if (userRole) {
        response.headers.set('x-user-role', userRole)
        response.headers.set('x-is-super-admin', userRole === 'SUPER_ADMIN' ? 'true' : 'false')
      }
      if (companyId) {
        response.headers.set('x-company-id', companyId)
      }
      if (companyName) {
        response.headers.set('x-company-name', companyName)
      }
      if (userId) {
        response.headers.set('x-user-id', userId)
      }
    }

    return response
  }

  // Solo aplicar middleware a rutas del dashboard
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  // Obtener el auth-token de las cookies (JWT)
  const authToken = request.cookies.get('auth-token')?.value

  console.log('[MIDDLEWARE] Dashboard access attempt:', {
    pathname,
    hasAuthToken: !!authToken,
    tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none'
  })

  // Si no hay token de autenticación, redirigir al login
  if (!authToken) {
    console.log('[MIDDLEWARE] No auth token found, redirecting to login')
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Validar JWT token con jose (compatible con Edge Runtime)
  let decodedToken: any
  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    console.log('[MIDDLEWARE] Using JWT_SECRET:', jwtSecret === 'fallback-secret-change-in-production' ? 'FALLBACK' : 'FROM ENV')

    // jose requiere el secret como Uint8Array
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(authToken, secret)
    decodedToken = payload

    console.log('[MIDDLEWARE] JWT token validated successfully for user:', decodedToken.email)
  } catch (error) {
    console.error('[MIDDLEWARE] Invalid JWT token:', error instanceof Error ? error.message : error)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Extraer información del token decodificado (tiene prioridad sobre las cookies)
  const userRole = decodedToken.role || request.cookies.get('user-role')?.value
  const companyId = decodedToken.companyId?.toString() || request.cookies.get('user-company-id')?.value
  const companyName = decodedToken.companyName || request.cookies.get('user-company-name')?.value
  const companyType = decodedToken.companyType || request.cookies.get('user-company-type')?.value
  const isBrokerCompany = companyType === 'broker'
  const isMarketCompany = companyType === 'market'

  console.log('[MIDDLEWARE] User info:', { userRole, companyId, companyType, isBrokerCompany, isMarketCompany, pathname })

  // ============================================================
  // REDIRECT /dashboard TO APPROPRIATE DASHBOARD BASED ON ROLE
  // ============================================================
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    let targetDashboard = '/dashboard/admin' // Default for SUPER_ADMIN

    if (userRole === 'SUPER_ADMIN') {
      targetDashboard = '/dashboard/admin'
    } else if (isMarketCompany) {
      targetDashboard = '/dashboard/market'
    } else if (isBrokerCompany) {
      targetDashboard = '/dashboard/broker'
    } else if (userRole === 'ADMIN' || userRole === 'DRIVER') {
      targetDashboard = '/dashboard/agency-admin'
    } else if (userRole === 'MANAGER') {
      targetDashboard = '/dashboard/manager'
    } else if (userRole === 'USER') {
      targetDashboard = '/dashboard/user'
    }

    console.log(`[MIDDLEWARE] Redirecting ${userRole} from /dashboard to ${targetDashboard}`)
    return NextResponse.redirect(new URL(targetDashboard, request.url))
  }

  // ============================================================
  // BROKER COMPANY HANDLING - Usuarios de empresas tipo broker
  // NOTA: SUPER_ADMIN siempre puede acceder a cualquier ruta
  // ============================================================

  // SUPER_ADMIN puede acceder a /dashboard/broker (para administrar brokers)
  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/broker')) {
    console.log('✅ SUPER_ADMIN accessing broker dashboard')
    const response = NextResponse.next()
    response.headers.set('x-user-role', userRole)
    if (companyId) response.headers.set('x-user-company-id', companyId)
    if (companyName) response.headers.set('x-user-company-name', companyName)
    if (companyType) response.headers.set('x-user-company-type', companyType || '')
    return response
  }

  // Si es usuario de empresa broker (pero NO SUPER_ADMIN), permitir acceso a /dashboard/broker
  if (isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/broker')) {
    console.log('✅ BROKER COMPANY user accessing broker dashboard, companyId:', companyId)
    const response = NextResponse.next()
    if (userRole) response.headers.set('x-user-role', userRole)
    if (companyId) response.headers.set('x-user-company-id', companyId)
    if (companyName) response.headers.set('x-user-company-name', companyName)
    if (companyType) response.headers.set('x-user-company-type', companyType)
    return response
  }

  // Redirigir usuarios NO-broker que intentan acceder a /dashboard/broker a su dashboard correcto
  if (!isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/broker')) {
    console.log('🔄 Redirecting NON-BROKER user from broker dashboard, role:', userRole)
    let redirectPath = '/dashboard/agency-admin'
    switch (userRole) {
      case 'ADMIN':
        redirectPath = '/dashboard/agency-admin'
        break
      case 'MANAGER':
        redirectPath = '/dashboard/manager'
        break
      case 'USER':
        redirectPath = '/dashboard/user'
        break
      case 'DRIVER':
        redirectPath = '/dashboard/agency-admin'
        break
    }
    const redirectUrl = new URL(redirectPath, request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirigir usuarios de empresa broker (pero NO SUPER_ADMIN) a su dashboard si intentan acceder a otros dashboards
  if (isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting BROKER COMPANY user from admin to broker dashboard')
    const brokerDashboardUrl = new URL('/dashboard/broker', request.url)
    return NextResponse.redirect(brokerDashboardUrl)
  }

  if (isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('🔄 Redirecting BROKER COMPANY user from agency-admin to broker dashboard')
    const brokerDashboardUrl = new URL('/dashboard/broker', request.url)
    return NextResponse.redirect(brokerDashboardUrl)
  }

  if (isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/manager')) {
    console.log('🔄 Redirecting BROKER COMPANY user from manager to broker dashboard')
    const brokerDashboardUrl = new URL('/dashboard/broker', request.url)
    return NextResponse.redirect(brokerDashboardUrl)
  }

  if (isBrokerCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/user')) {
    console.log('🔄 Redirecting BROKER COMPANY user from user to broker dashboard')
    const brokerDashboardUrl = new URL('/dashboard/broker', request.url)
    return NextResponse.redirect(brokerDashboardUrl)
  }

  // ============================================================
  // MARKET COMPANY HANDLING - Usuarios de empresas tipo market
  // NOTA: SUPER_ADMIN siempre puede acceder a cualquier ruta
  // ============================================================

  // SUPER_ADMIN puede acceder a /dashboard/market (para administrar mercados)
  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/market')) {
    console.log('✅ SUPER_ADMIN accessing market dashboard')
    const response = NextResponse.next()
    response.headers.set('x-user-role', userRole)
    if (companyId) response.headers.set('x-user-company-id', companyId)
    if (companyName) response.headers.set('x-user-company-name', companyName)
    if (companyType) response.headers.set('x-user-company-type', companyType || '')
    return response
  }

  // Si es usuario de empresa market (pero NO SUPER_ADMIN), permitir acceso a /dashboard/market
  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/market')) {
    console.log('✅ MARKET COMPANY user accessing market dashboard, companyId:', companyId)
    const response = NextResponse.next()
    if (userRole) response.headers.set('x-user-role', userRole)
    if (companyId) response.headers.set('x-user-company-id', companyId)
    if (companyName) response.headers.set('x-user-company-name', companyName)
    if (companyType) response.headers.set('x-user-company-type', companyType)
    return response
  }

  // Redirigir usuarios NO-market que intentan acceder a /dashboard/market a su dashboard correcto
  if (!isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/market')) {
    console.log('🔄 Redirecting NON-MARKET user from market dashboard, role:', userRole)
    let redirectPath = '/dashboard/agency-admin'
    switch (userRole) {
      case 'ADMIN':
        redirectPath = '/dashboard/agency-admin'
        break
      case 'MANAGER':
        redirectPath = '/dashboard/manager'
        break
      case 'USER':
        redirectPath = '/dashboard/user'
        break
      case 'DRIVER':
        redirectPath = '/dashboard/agency-admin'
        break
    }
    const redirectUrl = new URL(redirectPath, request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirigir usuarios de empresa market (pero NO SUPER_ADMIN) a su dashboard si intentan acceder a otros dashboards
  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting MARKET COMPANY user from admin to market dashboard')
    const marketDashboardUrl = new URL('/dashboard/market', request.url)
    return NextResponse.redirect(marketDashboardUrl)
  }

  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('🔄 Redirecting MARKET COMPANY user from agency-admin to market dashboard')
    const marketDashboardUrl = new URL('/dashboard/market', request.url)
    return NextResponse.redirect(marketDashboardUrl)
  }

  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/manager')) {
    console.log('🔄 Redirecting MARKET COMPANY user from manager to market dashboard')
    const marketDashboardUrl = new URL('/dashboard/market', request.url)
    return NextResponse.redirect(marketDashboardUrl)
  }

  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/user')) {
    console.log('🔄 Redirecting MARKET COMPANY user from user to market dashboard')
    const marketDashboardUrl = new URL('/dashboard/market', request.url)
    return NextResponse.redirect(marketDashboardUrl)
  }

  if (isMarketCompany && userRole !== 'SUPER_ADMIN' && pathname.startsWith('/dashboard/broker')) {
    console.log('🔄 Redirecting MARKET COMPANY user from broker to market dashboard')
    const marketDashboardUrl = new URL('/dashboard/market', request.url)
    return NextResponse.redirect(marketDashboardUrl)
  }

  // ============================================================

  // Validación de servicios habilitados (solo para usuarios de empresa, no SUPER_ADMIN)
  // NOTA: La validación de servicios se hace en el cliente (Sidebar) y en las API routes
  // No en middleware debido a limitaciones del Edge Runtime
  // El middleware solo valida autenticación y roles

  // Validación de acceso según rol
  const response = NextResponse.next()

  // Inyectar información del usuario en headers para que las páginas puedan usarla
  if (userRole) {
    response.headers.set('x-user-role', userRole)
  }
  if (companyId) {
    response.headers.set('x-user-company-id', companyId)
  }
  if (companyName) {
    response.headers.set('x-user-company-name', companyName)
  }

  // Filtrado por rol para diferentes dashboards
  if (userRole === 'ADMIN' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('✅ ADMIN accessing agency dashboard, companyId:', companyId)
    return response
  }

  if (userRole === 'DRIVER' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('✅ DRIVER accessing agency dashboard, companyId:', companyId)
    return response
  }

  if (userRole === 'MANAGER' && pathname.startsWith('/dashboard/manager')) {
    console.log('✅ MANAGER accessing manager dashboard, companyId:', companyId)
    return response
  }

  if (userRole === 'USER' && pathname.startsWith('/dashboard/user')) {
    console.log('✅ USER accessing user dashboard, companyId:', companyId)
    return response
  }

  // Para SUPER_ADMIN, permitir acceso completo a las rutas de administrador
  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/admin')) {
    console.log('✅ SUPER_ADMIN accessing admin dashboard')
    return response
  }

  // Excepción: Permitir que ADMIN y MANAGER accedan a /dashboard/admin/company-wallet
  // Esta es la página de wallet de la empresa que usan todos los roles de empresa
  if ((userRole === 'ADMIN' || userRole === 'MANAGER') && pathname === '/dashboard/admin/company-wallet') {
    console.log('✅ ' + userRole + ' accessing company-wallet page, companyId:', companyId)
    return response
  }

  // Excepción: Permitir que DRIVER acceda a /dashboard/driver/my-wallet
  // Wallet personal del driver
  if (userRole === 'DRIVER' && pathname === '/dashboard/driver/my-wallet') {
    console.log('✅ DRIVER accessing personal wallet page, companyId:', companyId)
    return response
  }

  // Excepción: Permitir que ADMIN acceda a /dashboard/admin/comisiones
  // Sistema de comisiones para empleados de la empresa
  if (userRole === 'ADMIN' && pathname.startsWith('/dashboard/admin/comisiones')) {
    console.log('✅ ADMIN accessing comisiones page, companyId:', companyId)
    return response
  }

  // NOTA: ADMIN ya no puede acceder a /dashboard/admin/product-config
  // Debe usar /dashboard/agency-admin/catalogo para gestionar su catálogo

  // Excepción: Permitir que ADMIN acceda a /dashboard/admin/my-wallet
  // Wallet personal del admin (alias para consistency con SUPER_ADMIN)
  if (userRole === 'ADMIN' && pathname === '/dashboard/admin/my-wallet') {
    console.log('✅ ADMIN accessing personal wallet page, companyId:', companyId)
    return response
  }

  // Redirección basada en rol si intenta acceder a rutas no permitidas
  if (userRole === 'ADMIN' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting ADMIN from admin to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  if (userRole === 'ADMIN' && pathname.startsWith('/dashboard/manager')) {
    console.log('🔄 Redirecting ADMIN from manager to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  if (userRole === 'ADMIN' && pathname.startsWith('/dashboard/user')) {
    console.log('🔄 Redirecting ADMIN from user to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  // DRIVER redirects
  if (userRole === 'DRIVER' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting DRIVER from admin to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  if (userRole === 'DRIVER' && pathname.startsWith('/dashboard/manager')) {
    console.log('🔄 Redirecting DRIVER from manager to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  if (userRole === 'DRIVER' && pathname.startsWith('/dashboard/user')) {
    console.log('🔄 Redirecting DRIVER from user to agency dashboard')
    const agencyDashboardUrl = new URL('/dashboard/agency-admin', request.url)
    return NextResponse.redirect(agencyDashboardUrl)
  }

  if (userRole === 'MANAGER' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting MANAGER from admin to manager dashboard')
    const managerDashboardUrl = new URL('/dashboard/manager', request.url)
    return NextResponse.redirect(managerDashboardUrl)
  }

  if (userRole === 'MANAGER' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('🔄 Redirecting MANAGER from agency-admin to manager dashboard')
    const managerDashboardUrl = new URL('/dashboard/manager', request.url)
    return NextResponse.redirect(managerDashboardUrl)
  }

  if (userRole === 'MANAGER' && pathname.startsWith('/dashboard/user')) {
    console.log('🔄 Redirecting MANAGER from user to manager dashboard')
    const managerDashboardUrl = new URL('/dashboard/manager', request.url)
    return NextResponse.redirect(managerDashboardUrl)
  }

  if (userRole === 'USER' && pathname.startsWith('/dashboard/admin')) {
    console.log('🔄 Redirecting USER from admin to user dashboard')
    const userDashboardUrl = new URL('/dashboard/user', request.url)
    return NextResponse.redirect(userDashboardUrl)
  }

  if (userRole === 'USER' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('🔄 Redirecting USER from agency-admin to user dashboard')
    const userDashboardUrl = new URL('/dashboard/user', request.url)
    return NextResponse.redirect(userDashboardUrl)
  }

  if (userRole === 'USER' && pathname.startsWith('/dashboard/manager')) {
    console.log('🔄 Redirecting USER from manager to user dashboard')
    const userDashboardUrl = new URL('/dashboard/user', request.url)
    return NextResponse.redirect(userDashboardUrl)
  }

  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/agency-admin')) {
    console.log('⚠️ SUPER_ADMIN accessing agency dashboard - allowed but unusual')
    return response
  }

  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/manager')) {
    console.log('⚠️ SUPER_ADMIN accessing manager dashboard - allowed but unusual')
    return response
  }

  if (userRole === 'SUPER_ADMIN' && pathname.startsWith('/dashboard/user')) {
    console.log('⚠️ SUPER_ADMIN accessing user dashboard - allowed but unusual')
    return response
  }

  // Si el rol no está definido, permitir acceso pero con log
  console.log('⚠️ Accessing with undefined role:', { pathname, userRole })
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - icons/ (PWA icons)
     * - images/ (static images)
     *
     * Note: API routes are included so middleware can inject auth headers
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|images/).*)',
  ]
}