'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BottomNavigation } from '@/components/driver/BottomNavigation'
import { MobileHeader } from '@/components/driver/MobileHeader'
import { ThemeProvider } from '@/contexts/theme-context'
import { NotificationProvider } from '@/contexts/NotificationContext'

interface DriverLayoutProps {
  children: ReactNode
}

export default function DriverLayout({ children }: DriverLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('')

  // Check if we're on the login page
  const isLoginPage = pathname === '/driver/login'

  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for auth token in cookies
        const authToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1]

        const userRole = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-role='))
          ?.split('=')[1]

        // Also check localStorage
        const userStr = localStorage.getItem('user')
        let user = null
        if (userStr) {
          try {
            user = JSON.parse(userStr)
          } catch (e) {
            console.error('Error parsing user from localStorage')
          }
        }

        if (authToken && (userRole === 'DRIVER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
          setIsAuthenticated(true)
          if (user) {
            setUserName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Driver')
          }
        } else if (!isLoginPage) {
          router.push('/driver/login')
        }
      } catch (e) {
        console.error('Error checking auth:', e)
        if (!isLoginPage) {
          router.push('/driver/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, isLoginPage])

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // Login page - render without nav
  if (isLoginPage) {
    return (
      <ThemeProvider>
        <NotificationProvider>
          <div className="min-h-screen bg-gray-900">
            {children}
          </div>
        </NotificationProvider>
      </ThemeProvider>
    )
  }

  // Not authenticated and not on login page - show loading (will redirect)
  if (!isAuthenticated && !isLoginPage) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-sm">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  // Authenticated - render with full layout
  return (
    <ThemeProvider>
      <NotificationProvider>
        <div className="min-h-screen bg-gray-900 flex flex-col">
          {/* Mobile Header */}
          <MobileHeader userName={userName} />

          {/* Main Content - scrollable area */}
          <main className="flex-1 overflow-y-auto pb-20">
            {children}
          </main>

          {/* Bottom Navigation - fixed */}
          <BottomNavigation />
        </div>
      </NotificationProvider>
    </ThemeProvider>
  )
}
