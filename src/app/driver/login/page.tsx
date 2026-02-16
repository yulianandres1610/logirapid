'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Truck } from 'lucide-react'
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

const driverLoginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
})

type DriverLoginFormData = z.infer<typeof driverLoginSchema>

export default function DriverLoginPage() {
  const router = useRouter()
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
  } = useForm<DriverLoginFormData>({
    resolver: zodResolver(driverLoginSchema),
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
        const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
        if (!allowedRoles.includes(payload.role)) return false
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
        router.push('/driver/routes')
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [router])

  const onSubmit = async (data: DriverLoginFormData) => {
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
        setError(result.error || 'Error al iniciar sesion')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
      if (!allowedRoles.includes(result.user?.role)) {
        setError('Este portal es solo para conductores')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      localStorage.setItem('user', JSON.stringify(result.user))
      if (result.token) {
        localStorage.setItem('auth-token', result.token)
      }

      setIsRedirecting(true)

      setTimeout(() => {
        window.location.href = '/driver/routes'
      }, 500)

    } catch (err) {
      console.error('[DRIVER LOGIN] Error:', err)
      setError('Error de conexion')
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
          <BrandedLogo subtitle="Portal Driver" />

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
                    placeholder="Correo electronico"
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
                    placeholder="Contrasena"
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
              <p className={`${styles.textMuted} text-sm mb-4`}>
                Necesitas ayuda?{' '}
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
          title="Preparando tu ruta"
          subtitle="Cargando tu espacio de trabajo..."
          icon={Truck}
        />
      </AnimatePresence>
    </BrandedLoginBackground>
  )
}
