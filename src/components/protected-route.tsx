'use client'

import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  // Si está cargando, mostrar un loading simple
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-exa-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Si no hay usuario o no tiene el rol requerido, mostrar mensaje simple
  if (!user || (requiredRole && user.role !== requiredRole)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">Acceso no autorizado</p>
          <a href="/login" className="text-exa-primary hover:underline">
            Ir al login
          </a>
        </div>
      </div>
    )
  }

  // Si todo está bien, renderizar los hijos
  return <>{children}</>
}