'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, Settings, LogOut, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useBrandSafe } from '@/contexts/brand-context'

interface MobileHeaderProps {
  userName?: string
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function MobileHeader({ userName, title, showBack, onBack }: MobileHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)
  const { brand } = useBrandSafe()

  // Determine if we should show the back button
  const isSubPage = pathname.split('/').length > 3 || showBack

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  const handleLogout = () => {
    // Determine cookie domain based on environment
    const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('logirapid.com')
    const domainPart = isProduction ? 'domain=.logirapid.com;' : ''

    // Clear ALL cookies (with and without domain for safety)
    const cookieNames = [
      'auth-token',
      'user-id',
      'user-name',
      'user-email',
      'user-role',
      'user-company-id',
      'user-company-name',
      'user-company-type'
    ]

    cookieNames.forEach(name => {
      // Clear without domain (for development)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      // Clear with domain (for production)
      if (domainPart) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${domainPart}`
      }
    })

    // Clear localStorage
    localStorage.removeItem('auth-token')
    localStorage.removeItem('user')

    // Redirect to login
    router.push('/driver/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-lg border-b border-gray-800 safe-area-pt">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left side - Back button or Logo */}
        <div className="flex items-center gap-3">
          {isSubPage ? (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <img
              src={brand.logos.dark}
              alt={brand.displayName}
              className="h-10 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          )}
        </div>

        {/* Right side - User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
          >
            <User className="w-6 h-6" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-50 overflow-hidden"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-white text-sm font-medium truncate">
                    {userName || 'Driver'}
                  </p>
                  <p className="text-gray-400 text-xs">Portal Driver</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      router.push('/driver/settings')
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-300 hover:bg-gray-700/50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Configuracion</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-red-400 hover:bg-gray-700/50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Cerrar Sesion</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
