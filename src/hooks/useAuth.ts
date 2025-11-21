'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, LoginCredentials, AuthState } from '@/types'

interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  isTransitioning: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

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
      // Check localStorage first
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        setState(prev => ({ ...prev, user, isLoading: false }))
      } else {
        // Check cookies and reconstruct user from them
        const authToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1]

        const userId = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-id='))
          ?.split('=')[1]

        const userName = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-name='))
          ?.split('=')[1]

        const userEmail = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-email='))
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

        if (authToken === 'authenticated' && userId && userName && userEmail && userRole) {
          const user: User = {
            id: userId,
            name: decodeURIComponent(userName),
            email: decodeURIComponent(userEmail),
            role: userRole as any,
            companyId: companyId || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          localStorage.setItem('user', JSON.stringify(user))
          setState(prev => ({ ...prev, user, isLoading: false }))
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      }
    } catch (error) {
      console.error('Error loading user from storage:', error)
      localStorage.removeItem('user')
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Call the real API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!response.ok) {
        // Set error state without throwing to avoid console errors
        setState(prev => ({
          ...prev,
          user: null,
          isLoading: false,
          isTransitioning: false,
          error: data.error || 'Error al iniciar sesión',
        }))
        return false
      }

      if (data.success && data.user) {
        const user: User = {
          id: data.user.id.toString(),
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          companyId: data.user.companyId?.toString(),
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt),
        }

        // Persist in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user))
        }

        // Update state
        setState({
          user,
          isLoading: false,
          isTransitioning: false,
          error: null,
        })

        // Redirect to appropriate dashboard based on role
        if (typeof window !== 'undefined') {
          let redirectPath = '/dashboard/admin'

          switch (user.role) {
            case 'SUPER_ADMIN':
              redirectPath = '/dashboard/admin'
              break
            case 'ADMIN':
              redirectPath = '/dashboard/agency-admin'
              break
            case 'MANAGER':
              redirectPath = '/dashboard/agency-admin'
              break
            case 'USER':
              redirectPath = '/dashboard/agency-admin'
              break
            default:
              redirectPath = '/dashboard/admin'
          }

          window.location.href = redirectPath
        }
        return true
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          isLoading: false,
          isTransitioning: false,
          error: 'Respuesta inválida del servidor',
        }))
        return false
      }
    } catch (error) {
      // Only log network errors, not authentication errors
      if (error instanceof TypeError) {
        console.error('Network error:', error)
      }
      setState(prev => ({
        ...prev,
        user: null,
        isLoading: false,
        isTransitioning: false,
        error: error instanceof Error ? error.message : 'Error al iniciar sesión',
      }))
      return false
    }
  }, [])

  const logout = useCallback(() => {
    // Clear localStorage and cookies
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      // Clear all auth cookies
      const cookiesToClear = [
        'auth-token',
        'user-id',
        'user-name',
        'user-email',
        'user-role',
        'user-company-id',
        'user-company-name',
      ]
      cookiesToClear.forEach(cookie => {
        document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      })
    }

    // Reset state
    setState({
      user: null,
      isLoading: false,
      isTransitioning: false,
      error: null,
    })

    // Redirect to login
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
