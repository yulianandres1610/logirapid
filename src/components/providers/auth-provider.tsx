'use client'

import React, { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/loading-screen'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoading } = useAuth()

  // Solo mostrar loading mientras verifica autenticación inicial
  if (isLoading) {
    return <LoadingScreen />
  }

  // Render children sin ninguna redirección automática
  return <>{children}</>
}