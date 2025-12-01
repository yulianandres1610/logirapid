'use client'

import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string | string[]
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  // Si está cargando o no hay usuario, mostrar loading
  // (el middleware redirigirá al login si realmente no está autenticado)
  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-exa-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // Verificar si el usuario tiene el rol requerido
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    const hasAccess = allowedRoles.includes(user.role)

    if (!hasAccess) {
      // Redirect based on user's actual role instead of always going to login
      if (typeof window !== 'undefined') {
        let redirectPath = '/login'
        switch (user.role) {
          case 'SUPER_ADMIN':
            redirectPath = '/dashboard/admin'
            break
          case 'ADMIN':
          case 'DRIVER':
            redirectPath = '/dashboard/agency-admin'
            break
          case 'MANAGER':
            redirectPath = '/dashboard/manager'
            break
          case 'USER':
            redirectPath = '/dashboard/user'
            break
        }
        window.location.href = redirectPath
      }
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-exa-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }
  }

  // Si todo está bien, renderizar los hijos
  return <>{children}</>
}