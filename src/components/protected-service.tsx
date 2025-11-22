'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEnabledServices } from '@/hooks/useEnabledServices'

interface ProtectedServiceProps {
  children: React.ReactNode
  requiredService: string
  fallbackPath?: string
}

/**
 * Componente que protege contenido basado en servicios habilitados
 * Solo muestra children si el usuario tiene el servicio requerido
 * SUPER_ADMIN siempre tiene acceso
 */
export function ProtectedService({
  children,
  requiredService,
  fallbackPath
}: ProtectedServiceProps) {
  const router = useRouter()
  const { hasService, isSuperAdmin, isLoading } = useEnabledServices()

  useEffect(() => {
    if (isLoading) return

    // SUPER_ADMIN siempre tiene acceso
    if (isSuperAdmin) return

    // Verificar si tiene el servicio
    if (!hasService(requiredService)) {
      console.log(`[ProtectedService] Access denied: missing service '${requiredService}'`)

      if (fallbackPath) {
        router.push(fallbackPath)
      } else {
        // Redirigir al dashboard base
        router.push('/dashboard')
      }
    }
  }, [hasService, isSuperAdmin, isLoading, requiredService, fallbackPath, router])

  // Mientras carga, no mostrar nada
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // SUPER_ADMIN siempre ve el contenido
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // Verificar servicio
  if (!hasService(requiredService)) {
    return null
  }

  return <>{children}</>
}
