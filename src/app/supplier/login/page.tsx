'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, Eye, EyeOff, AlertCircle, Package } from 'lucide-react'
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

const supplierLoginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type SupplierLoginFormData = z.infer<typeof supplierLoginSchema>

export default function SupplierLoginPage() {
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
  } = useForm<SupplierLoginFormData>({
    resolver: zodResolver(supplierLoginSchema),
    mode: 'onChange',
  })

  const watchedUsername = watch('username')
  const watchedPassword = watch('password')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAuthentication = () => {
      const supplierToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('supplier-token='))
        ?.split('=')[1]

      if (supplierToken) {
        setShowLoadingOverlay(true)
        setIsRedirecting(true)
        window.location.href = '/dashboard/supplier'
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [])

  const onSubmit = async (data: SupplierLoginFormData) => {
    setError(null)
    setIsLoading(true)
    setShowLoadingOverlay(true)

    try {
      const response = await fetch('/api/supplier/auth', {
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

      setIsRedirecting(true)

      const waitForCookie = () => {
        const maxAttempts = 60
        let attempts = 0

        const checkCookie = () => {
          attempts++
          const cookies = document.cookie
          const hasSupplierToken = cookies.includes('supplier-token=')

          if (hasSupplierToken || attempts >= maxAttempts) {
            window.location.href = '/dashboard/supplier'
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
          <BrandedLogo subtitle="Portal de Proveedores" />

          <div className="p-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 ${styles.iconColor}`} />
                  </div>
                  <input
                    type="text"
                    placeholder="Usuario"
                    {...register('username')}
                    className={`
                      w-full pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300
                      ${errors.username ? 'border-red-500' : styles.inputBase}
                      ${watchedUsername ? styles.inputFilled : ''}
                    `}
                    disabled={isLoading}
                  />
                </div>
                {errors.username && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.username.message}
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
                  disabled={!isValid || !watchedUsername || !watchedPassword || isLoading}
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
          title="Cargando tu portal"
          subtitle="Preparando tu espacio de trabajo..."
          icon={Package}
        />
      </AnimatePresence>
    </BrandedLoginBackground>
  )
}
