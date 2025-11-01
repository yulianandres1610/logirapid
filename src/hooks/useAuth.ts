'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, LoginCredentials, AuthState } from '@/types'

interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  isTransitioning: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  clearError: () => void
}

const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@cubarapid.com',
    name: 'Administrador General',
    role: 'SUPER_ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    email: 'empresa@cubaexpress.com',
    name: 'Carlos Pérez',
    role: 'ADMIN',
    companyId: 'company-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    email: 'manager@cubaexpress.com',
    name: 'María González',
    role: 'MANAGER',
    companyId: 'company-1',
        createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    email: 'usuario@cubaexpress.com',
    name: 'Luis Rodríguez',
    role: 'USER',
    companyId: 'company-1',
        createdAt: new Date(),
    updatedAt: new Date(),
  }
]

const mockUser: User = mockUsers[0] // Por defecto, el admin general

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: false,
    isTransitioning: false,
    error: null,
  })

  // Check for existing auth on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // First check localStorage
      let userStr = localStorage.getItem('user')
      let user: User | null = null

      if (userStr) {
        user = JSON.parse(userStr)
      } else {
        // If no localStorage, check cookies and reconstruct user
        const authToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1]

        const userRole = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-role='))
          ?.split('=')[1]

        const companyId = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-company-id='))
          ?.split('=')[1]

        const companyName = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-company-name='))
          ?.split('=')[1]

        if (authToken === 'authenticated' && userRole) {
          // Reconstruct user from mock data based on role
          user = mockUsers.find(u => u.role === userRole) || null
          if (user) {
            user = { ...user, companyId: companyId || user.companyId }
            // Save to localStorage for future use
            localStorage.setItem('user', JSON.stringify(user))
          }
        }
      }

      if (user) {
        setState(prev => ({ ...prev, user, isLoading: false }))
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      localStorage.removeItem('user')
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Buscar usuario en mockUsers
      const user = mockUsers.find(
        u => u.email === credentials.email
      )

      // Validar credenciales
      let authenticatedUser: User | null = null

      if (credentials.email === 'admin@cubarapid.com' && credentials.password === 'admin123') {
        authenticatedUser = mockUsers[0] // SUPER_ADMIN
      } else if (credentials.email === 'empresa@cubaexpress.com' && credentials.password === 'empresa123') {
        authenticatedUser = mockUsers[1] // ADMIN de empresa
      } else if (credentials.email === 'manager@cubaexpress.com' && credentials.password === 'manager123') {
        authenticatedUser = mockUsers[2] // MANAGER de empresa
      } else if (credentials.email === 'usuario@cubaexpress.com' && credentials.password === 'usuario123') {
        authenticatedUser = mockUsers[3] // USER de empresa
      }

      if (authenticatedUser) {
        // Guardar en localStorage y cookie
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(authenticatedUser))
          document.cookie = 'auth-token=authenticated; path=/; max-age=86400'

          // También guardar cookies específicas para el middleware
          document.cookie = `user-company-id=${authenticatedUser.companyId || ''}; path=/; max-age=86400`
          document.cookie = `user-role=${authenticatedUser.role}; path=/; max-age=86400`
          document.cookie = `user-company-name=CubaExpress S.A.; path=/; max-age=86400`
        }

        // Actualizar estado inmediatamente
        setState({
          user: authenticatedUser,
          isLoading: false,
          isTransitioning: false,
          error: null,
        })

        // Redirección según el rol
        if (typeof window !== 'undefined') {
          if (authenticatedUser.role === 'SUPER_ADMIN') {
            window.location.href = '/dashboard/admin'
          } else if (authenticatedUser.role === 'ADMIN') {
            window.location.href = '/dashboard/agency-admin'
          } else if (authenticatedUser.role === 'MANAGER') {
            window.location.href = '/dashboard/manager'
          } else if (authenticatedUser.role === 'USER') {
            window.location.href = '/dashboard/user'
          }
        }
      } else {
        throw new Error('Credenciales incorrectas')
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        user: null,
        isLoading: false,
        isTransitioning: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }))
    }
  }, [])

  const logout = useCallback(() => {
    // Limpiar localStorage y cookies
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user-company-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user-company-name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }

    // Resetear estado
    setState({
      user: null,
      isLoading: false,
      isTransitioning: false,
      error: null,
    })

    // Redirigir al login
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    login,
    logout,
    clearError,
  }
}