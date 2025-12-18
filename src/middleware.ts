import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  ]

  // Recursos estáticos (pero NO API)
  const staticRoutes = [
    '/_next',
    '/images',
    '/favicon.ico',
    '/robots.txt'
  ]

  // Verificar si la ruta es pública
  if (publicRoutes.includes(pathname) || staticRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Para rutas API públicas, no requerir autenticación
  if (pathname.startsWith('/api/public')) {
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
     * - public folder
     *
     * Note: API routes are included so middleware can inject auth headers
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}