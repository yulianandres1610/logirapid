'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BrandedLoginBackground,
  BrandedLoginCard,
  BrandedLogo,
  BrandedFooter,
  BrandedLoadingOverlay,
  BrandedSessionCheck,
  useBrandedFormStyles
} from '@/components/login/BrandedLoginBackground'

const auditLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type AuditLoginFormData = z.infer<typeof auditLoginSchema>

export default function AuditLoginPage() {
  const styles = useBrandedFormStyles()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<AuditLoginFormData>({
    resolver: zodResolver(auditLoginSchema),
    mode: 'onChange',
  })

  const watchedEmail = watch('email')
  const watchedPassword = watch('password')

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
        if (payload.companyType !== 'market') return false
        if (payload.role !== 'MARKET_MANAGER') return false
        return true
      } catch {
        return false
      }
    }

    const checkAuthentication = () => {
      const authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1]

      if (authToken && isTokenValid(authToken)) {
        setShowLoadingOverlay(true)
        setIsRedirecting(true)
        window.location.href = '/dashboard/audit'
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [])

  const onSubmit = async (data: AuditLoginFormData) => {
    setError(null)
    setIsLoading(true)
    setShowLoadingOverlay(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Error al iniciar sesión')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      if (result.user?.companyType !== 'market') {
        setError('Esta cuenta no pertenece a un mercado. Solo usuarios de mercados pueden acceder.')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      if (result.user?.role !== 'MARKET_MANAGER') {
        setError('Solo usuarios con rol MARKET_MANAGER pueden acceder al Portal de Auditoría.')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      localStorage.setItem('user', JSON.stringify(result.user))
      localStorage.setItem('auth-token', result.token)

      setIsRedirecting(true)

      const waitForCookie = () => {
        const maxAttempts = 60
        let attempts = 0

        const checkCookie = () => {
          attempts++
          const cookies = document.cookie
          const hasAuthToken = cookies.includes('auth-token=')

          if (hasAuthToken || attempts >= maxAttempts) {
            window.location.href = '/dashboard/audit'
          } else {
            setTimeout(checkCookie, 50)
          }
        }

        checkCookie()
      }

      waitForCookie()

    } catch (err) {
      console.error('Login error:', err)
      setError('Error de conexión')
      setShowLoadingOverlay(false)
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return <BrandedSessionCheck />
  }

  return (
    <BrandedLoginBackground>
      <div className="relative z-10 w-full max-w-md mx-auto">
        <BrandedLoginCard>
          <BrandedLogo subtitle="Portal Auditoría" />

          <div className="p-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className={`h-5 w-5 ${styles.iconColor}`} />
                  </div>
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    {...register('email')}
                    className={`
                      w-full pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300
                      ${errors.email ? 'border-red-500' : styles.inputBase}
                      ${watchedEmail ? styles.inputFilled : ''}
                    `}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.email.message}
                  </motion.p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 ${styles.iconColor}`} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contraseña"
                    {...register('password')}
                    className={`
                      w-full pl-12 pr-12 py-4 rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300
                      ${errors.password ? 'border-red-500' : styles.inputBase}
                      ${watchedPassword ? styles.inputFilled : ''}
                    `}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute inset-y-0 right-0 pr-4 flex items-center ${styles.linkSecondary} transition-colors`}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.password.message}
                  </motion.p>
                )}
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-300">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  className={`w-full h-14 text-base font-semibold rounded-2xl transition-all duration-300 ${styles.buttonPrimary}`}
                  loading={isLoading}
                  disabled={!isValid || !watchedEmail || !watchedPassword || isLoading}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span>{isLoading ? 'Ingresando...' : 'Ingresar'}</span>
                    {!isLoading && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </div>
                </Button>
              </motion.div>
            </form>

            <div className="mt-8 text-center">
              <p className={`${styles.textMuted} text-sm`}>
                Acceso exclusivo para auditores de inventario
              </p>
              <p className={`${styles.textMuted} text-xs mt-2 opacity-75`}>
                Solo usuarios MARKET_MANAGER
              </p>
            </div>
          </div>
        </BrandedLoginCard>

        <BrandedFooter />
      </div>

      <AnimatePresence>
        <BrandedLoadingOverlay
          isVisible={isRedirecting || showLoadingOverlay}
          title="Accediendo a Auditoría"
          subtitle="Preparando el sistema de conteo..."
          icon={ClipboardCheck}
        />
      </AnimatePresence>
    </BrandedLoginBackground>
  )
}
