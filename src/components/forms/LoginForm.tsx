'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { LoginCredentials } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

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

  const onSubmit = async (data: LoginFormData) => {
    clearError()
    try {
      await login(data as LoginCredentials)
      onSuccess?.()
    } catch (err) {
      // Error is handled by the useAuth hook
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email Field */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="email"
            placeholder="Correo electrónico"
            {...register('email')}
            className={`
              w-full pl-12 pr-4 py-4 bg-white/5 border ${errors.email ? 'border-red-500' : 'border-exa-secondary/30'}
              rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
              focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300
              ${watchedEmail ? 'bg-white/10 border-exa-secondary/50' : ''}
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

      {/* Password Field */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            {...register('password')}
            className={`
              w-full pl-12 pr-12 py-4 bg-white/5 border ${errors.password ? 'border-red-500' : 'border-exa-secondary/30'}
              rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
              focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300
              ${watchedPassword ? 'bg-white/10 border-exa-secondary/50' : ''}
            `}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
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

      {/* Error Message */}
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

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          type="submit"
          className="w-full h-14 text-base font-semibold bg-exa-secondary hover:bg-exa-secondary/90 text-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-exa-secondary/25 flex items-center justify-center space-x-2"
          loading={isLoading}
          disabled={!isValid || !watchedEmail || !watchedPassword || isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Iniciando sesión...</span>
            </>
          ) : (
            <>
              <span>Ingresar</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </Button>
      </motion.div>

      {/* Demo Credentials - More Elegant */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 transition-colors list-none">
            ¿Credenciales de demostración?
          </summary>
          <div className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs text-gray-300 mb-1">
              <span className="font-mono">Email:</span> admin@cubarapid.com
            </p>
            <p className="text-xs text-gray-300">
              <span className="font-mono">Contraseña:</span> admin123
            </p>
          </div>
        </details>
      </motion.div>
    </form>
  )
}