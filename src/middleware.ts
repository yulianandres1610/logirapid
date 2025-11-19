import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
    const userRole = request.cookies.get('user-role')?.value
    const companyId = request.cookies.get('user-company-id')?.value
    const companyName = request.cookies.get('user-company-name')?.value
    const userId = request.cookies.get('user-id')?.value

    // Crear respuesta con headers inyectados
    const response = NextResponse.next()

    // Inyectar headers para que las APIs puedan acceder a la información del usuario
    if (authToken) {
      response.headers.set('x-auth-token', authToken)
    }
    if (userRole) {
      response.headers.set('x-user-role', userRole)
      // Inyectar flag de super admin para query-helpers.ts
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

    return response
  }

  // Solo aplicar middleware a rutas del dashboard
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  // Obtener el auth-token de las cookies (sistema actual)
  const authToken = request.cookies.get('auth-token')?.value

  // Obtener información del usuario de las cookies
  const userRole = request.cookies.get('user-role')?.value
  const companyId = request.cookies.get('user-company-id')?.value
  const companyName = request.cookies.get('user-company-name')?.value

  // Si no hay token de autenticación, redirigir al login
  if (!authToken || authToken !== 'authenticated') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

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