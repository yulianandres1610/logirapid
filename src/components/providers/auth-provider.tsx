'use client'

import React, { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { usePathname } from 'next/navigation'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoading } = useAuth()
  const pathname = usePathname()
  const isLoginRoute = pathname?.startsWith('/login')

  // Solo mostrar loading mientras verifica autenticación inicial
  if (isLoading && !isLoginRoute) {
    return <LoadingScreen />
  }

  // Render children sin ninguna redirección automática
  return <>{children}</>
}
