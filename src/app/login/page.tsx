'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LoginForm } from '@/components/forms/LoginForm'
import { Package } from 'lucide-react'
import {
  BrandedLoginBackground,
  BrandedLoginCard,
  BrandedLogo,
  BrandedFooter,
  BrandedLoadingOverlay,
  BrandedSessionCheck,
  useBrandedFormStyles
} from '@/components/login/BrandedLoginBackground'

export default function LoginPage() {
  const styles = useBrandedFormStyles()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isTokenValid = (token: string): boolean => {
      try {
        const parts = token.split('.')
        if (parts.length !== 3) return false
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp) {
          const now = Math.floor(Date.now() / 1000)
          if (payload.exp < now) return false
        }
        return true
      } catch {
        return false
      }
    }

    const clearAuthData = () => {
      document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'user-role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'user-company-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'user-company-name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'user-company-type=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      localStorage.removeItem('auth-token')
      localStorage.removeItem('user')
    }

    const checkAuthentication = () => {
      const authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1]

      const localToken = localStorage.getItem('auth-token')
      const userStr = localStorage.getItem('user')

      const tokenToCheck = authToken || localToken
      if (tokenToCheck && !isTokenValid(tokenToCheck)) {
        clearAuthData()
        setIsCheckingAuth(false)
        return
      }

      if (authToken || (localToken && userStr)) {
        setShowLoadingOverlay(true)
        setIsRedirecting(true)

        let redirectPath = '/dashboard/admin'
        try {
          if (userStr) {
            const user = JSON.parse(userStr)
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
                redirectPath = '/dashboard/agency-admin'
                break
              default:
                redirectPath = '/dashboard/agency-admin'
            }
          }
        } catch (e) {
          console.error('[LOGIN] Error parsing user from localStorage', e)
        }

        const currentHost = window.location.hostname
        const isMainDomain = currentHost === 'logirapid.com' || currentHost === 'www.logirapid.com'

        if (isMainDomain) {
          window.location.href = `https://agencias.logirapid.com${redirectPath}`
        } else {
          window.location.href = redirectPath
        }
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [])

  const handleLoginSuccess = () => {
    setShowLoadingOverlay(true)
    setIsRedirecting(true)
  }

  if (isCheckingAuth) {
    return <BrandedSessionCheck />
  }

  return (
    <BrandedLoginBackground>
      <div className="relative z-10 w-full max-w-md mx-auto">
        <BrandedLoginCard>
          <BrandedLogo />

          <div className="p-8 pt-4">
            <LoginForm
              onSuccess={handleLoginSuccess}
              disabled={isRedirecting || showLoadingOverlay}
              onLoadingChange={setShowLoadingOverlay}
            />

            <div className="mt-8 text-center">
              <p className={`${styles.textMuted} text-sm mb-4`}>
                ¿Necesitas ayuda?{' '}
                <button className={`${styles.linkPrimary} transition-colors`}>
                  Contacta soporte
                </button>
              </p>
            </div>
          </div>
        </BrandedLoginCard>

        <BrandedFooter />
      </div>

      <AnimatePresence>
        <BrandedLoadingOverlay
          isVisible={isRedirecting || showLoadingOverlay}
          title="Cargando tu espacio de trabajo"
          subtitle="Preparando LogiRapid para ti..."
          icon={Package}
        />
      </AnimatePresence>
    </BrandedLoginBackground>
  )
}
