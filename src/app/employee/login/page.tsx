'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Users } from 'lucide-react'
import {
  BrandedLoginBackground,
  BrandedLoginCard,
  BrandedLogo,
  BrandedFooter,
  BrandedLoadingOverlay,
  BrandedSessionCheck,
  useBrandedFormStyles
} from '@/components/login/BrandedLoginBackground'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function EmployeeLoginPage() {
  const router = useRouter()
  const styles = useBrandedFormStyles()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  })

  const watchedEmail = watch('email')
  const watchedPassword = watch('password')

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await fetch('/api/employee/profile')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setShowLoadingOverlay(true)
            router.push('/employee/dashboard')
            return
          }
        }
      } catch (error) {
        console.error('[Employee Login] Error checking auth:', error)
      }
      setIsCheckingAuth(false)
    }

    checkAuthentication()
  }, [router])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/employee/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        setShowLoadingOverlay(true)
        router.push('/employee/dashboard')
      } else {
        setError(result.error || 'Error al iniciar sesión')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Error de conexión')
    } finally {
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
          <BrandedLogo subtitle="Portal de Empleados" />

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
                <button
                  type="submit"
                  className={`w-full h-14 text-base font-semibold rounded-2xl transition-all duration-300 disabled:opacity-50 ${styles.buttonPrimary}`}
                  disabled={!isValid || !watchedEmail || !watchedPassword || isLoading}
                >
                  <div className="flex items-center justify-center space-x-2">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Ingresando...</span>
                      </>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center"
              >
                <p className={`${styles.textMuted} text-sm`}>
                  ¿Problemas para acceder?{' '}
                  <button
                    type="button"
                    className={`${styles.linkPrimary} transition-colors underline decoration-dotted`}
                  >
                    Contacta a tu supervisor
                  </button>
                </p>
              </motion.div>
            </form>
          </div>
        </BrandedLoginCard>

        <BrandedFooter />
      </div>

      <AnimatePresence>
        <BrandedLoadingOverlay
          isVisible={showLoadingOverlay}
          title="Bienvenido"
          subtitle="Preparando tu portal de empleado..."
          icon={Users}
        />
      </AnimatePresence>
    </BrandedLoginBackground>
  )
}
