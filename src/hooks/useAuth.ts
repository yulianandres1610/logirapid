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

  // Verify session with server (check if user still exists in DB)
  const verifySession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify-session', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()

      if (!data.valid) {
        console.log('[AUTH] Session invalid:', data.error)
        // Clear all auth data
        localStorage.removeItem('user')
        localStorage.removeItem('auth-token')
        // Clear cookies
        const cookieDomain = window.location.hostname.includes('logirapid.com')
          ? '.logirapid.com'
          : undefined
        const cookiesToClear = ['auth-token', 'user-id', 'user-name', 'user-email', 'user-role', 'user-company-id', 'user-company-name', 'user-company-type']
        cookiesToClear.forEach(cookie => {
          if (cookieDomain) {
            document.cookie = `${cookie}=; path=/; domain=${cookieDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
          document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        })
        setState({ user: null, isLoading: false, isTransitioning: false, error: null })
        // Redirect to login if action is logout
        if (data.action === 'logout') {
          window.location.href = '/login'
        }
        return false
      }
      return true
    } catch (error) {
      console.error('[AUTH] Error verifying session:', error)
      return true // On error, don't logout (could be network issue)
    }
  }, [])

  // Check for existing auth on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initAuth = async () => {
      try {
        // Check localStorage first
        const userStr = localStorage.getItem('user')
        if (userStr) {
          const user = JSON.parse(userStr)
          setState(prev => ({ ...prev, user, isLoading: false }))
          // Verify session in background
          verifySession()
          return
        }

        // Rest of the original logic...
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

        const companyType = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-company-type='))
          ?.split('=')[1]

        // Validate JWT token presence (basic check - full validation in middleware)
        if (authToken && userId && userName && userEmail && userRole) {
          const user: User = {
            id: userId,
            name: decodeURIComponent(userName),
            email: decodeURIComponent(userEmail),
            role: userRole as any,
            companyId: companyId || undefined,
            companyType: companyType || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          localStorage.setItem('user', JSON.stringify(user))
          localStorage.setItem('auth-token', authToken)
          setState(prev => ({ ...prev, user, isLoading: false }))
          // Verify session in background
          verifySession()
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Error loading user from storage:', error)
        localStorage.removeItem('user')
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    initAuth()
  }, [verifySession])

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
        credentials: 'include', // Ensure cookies are sent and received
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
          companyType: data.user.companyType,
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt),
        }

        // Persist in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user))
          // Store JWT token if provided
          if (data.token) {
            localStorage.setItem('auth-token', data.token)
          }
        }

        // Update state
        setState({
          user,
          isLoading: false,
          isTransitioning: false,
          error: null,
        })

        // Wait for cookies to propagate before redirecting
        // This prevents race condition where middleware checks before cookies are available
        if (typeof window !== 'undefined') {
          let redirectPath = '/dashboard/admin'

          // Determinar ruta de redirección según tipo de empresa y rol
          if (user.companyType === 'broker') {
            // Si la empresa es de tipo broker, redirigir al dashboard de broker
            redirectPath = '/dashboard/broker'
          } else if (user.companyType === 'market') {
            // Si la empresa es de tipo market, redirigir al dashboard de market
            redirectPath = '/dashboard/market'
          } else {
            switch (user.role) {
              case 'SUPER_ADMIN':
                redirectPath = '/dashboard/admin'
                break
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
                redirectPath = '/dashboard/agency-admin'  // Drivers use agency-admin dashboard
                break
              default:
                redirectPath = '/dashboard/agency-admin'
            }
          }

          // Cookie polling: Wait until auth-token is available in document.cookie
          // This ensures middleware will find the cookie when validating
          const waitForCookie = () => {
            const maxAttempts = 60 // 60 attempts * 50ms = 3 seconds max
            let attempts = 0

            const checkCookie = () => {
              attempts++
              const cookies = document.cookie
              const hasAuthToken = cookies.includes('auth-token=')

              console.log(`[AUTH] Cookie check attempt ${attempts}: ${hasAuthToken ? 'Found' : 'Not found'}`)

              if (hasAuthToken) {
                console.log('[AUTH] Auth token cookie found, redirecting to:', redirectPath)

                // Multi-domain redirect logic
                const currentHost = window.location.hostname
                const isMainDomain = currentHost === 'logirapid.com' || currentHost === 'www.logirapid.com'

                if (isMainDomain) {
                  // If logging in from main domain, redirect to agencias subdomain
                  window.location.href = `https://agencias.logirapid.com${redirectPath}`
                } else {
                  // Normal redirect for agencias subdomain or localhost
                  window.location.href = redirectPath
                }
              } else if (attempts >= maxAttempts) {
                console.error('[AUTH] Cookie not found after 3 seconds, redirecting anyway')

                // Multi-domain redirect logic (fallback)
                const currentHost = window.location.hostname
                const isMainDomain = currentHost === 'logirapid.com' || currentHost === 'www.logirapid.com'

                if (isMainDomain) {
                  window.location.href = `https://agencias.logirapid.com${redirectPath}`
                } else {
                  window.location.href = redirectPath
                }
              } else {
                // Check again after 50ms
                setTimeout(checkCookie, 50)
              }
            }

            // Start checking
            checkCookie()
          }

          waitForCookie()
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
      localStorage.removeItem('auth-token')
      // Clear all auth cookies
      const cookiesToClear = [
        'auth-token',
        'user-id',
        'user-name',
        'user-email',
        'user-role',
        'user-company-id',
        'user-company-name',
        'user-company-type',
      ]
      const cookieDomain = window.location.hostname.includes('logirapid.com')
        ? '.logirapid.com'
        : undefined
      cookiesToClear.forEach(cookie => {
        // Clear with domain if applicable
        if (cookieDomain) {
          document.cookie = `${cookie}=; path=/; domain=${cookieDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
        // Also clear without domain for fallback
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
