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
    '/auth/error'
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
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ]
}