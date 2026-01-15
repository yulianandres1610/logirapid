'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Truck, Package, AlertCircle } from 'lucide-react'

export default function DriverLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check if user is already authenticated on mount
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

    const authToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('auth-token='))
      ?.split('=')[1]

    if (authToken && isTokenValid(authToken)) {
      router.push('/driver/routes')
    } else {
      setIsCheckingAuth(false)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (data.success) {
        const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
        if (!allowedRoles.includes(data.data.user.role)) {
          setError('Este portal es solo para conductores')
          setIsLoading(false)
          return
        }

        localStorage.setItem('user', JSON.stringify(data.data.user))
        localStorage.setItem('auth-token', data.data.token)

        document.cookie = `auth-token=${data.data.token}; path=/; max-age=${60 * 60 * 24 * 7}`
        document.cookie = `user-role=${data.data.user.role}; path=/; max-age=${60 * 60 * 24 * 7}`

        router.push('/driver/routes')
      } else {
        setError(data.error || 'Error al iniciar sesion')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Error de conexion. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Verificando sesion...</p>
        </div>
      </div>
    )
  }

  const isFormValid = email.length > 0 && password.length >= 6

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Reflejos principales de marca */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/25 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/25 rounded-full filter blur-3xl animate-pulse delay-1000" />

        {/* Mas reflejos de color primario (rojo) */}
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-exa-primary/18 rounded-full filter blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-exa-primary/15 rounded-full filter blur-3xl animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/5 w-64 h-64 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse delay-1200" />
        <div className="absolute bottom-1/4 left-1/6 w-56 h-56 bg-exa-primary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
        <div className="absolute top-3/4 right-1/3 w-48 h-48 bg-exa-primary/16 rounded-full filter blur-2xl animate-pulse delay-600" />

        {/* Reflejos de color secundario (azul) */}
        <div className="absolute bottom-1/3 right-1/4 w-76 h-76 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-800" />
        <div className="absolute top-1/5 left-1/2 w-64 h-64 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-1400" />
        <div className="absolute top-3/5 left-1/6 w-56 h-56 bg-exa-secondary/18 rounded-full filter blur-3xl animate-pulse delay-200" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
        >
          {/* Logo Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col items-center pt-8 pb-4"
          >
            <img
              src="/images/blanco.png"
              alt="LogiRapid"
              className="object-contain w-full max-w-xs h-auto mb-4"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  const fallback = document.createElement('div')
                  fallback.className = 'text-white font-bold text-3xl tracking-wider px-4 py-2'
                  fallback.textContent = 'LogiRapid'
                  parent.insertBefore(fallback, parent.firstChild)
                }
              }}
            />

            {/* Portal Driver Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 bg-exa-primary/20 text-exa-primary px-5 py-2.5 rounded-full border border-exa-primary/30"
            >
              <Truck className="w-5 h-5" />
              <span className="text-sm font-bold tracking-wide">Portal Driver</span>
            </motion.div>
          </motion.div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
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
                  placeholder="Correo electronico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`
                    w-full pl-12 pr-4 py-4 bg-white/5 border border-exa-primary/30
                    rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                    focus:ring-exa-primary focus:border-exa-primary transition-all duration-300
                    ${email ? 'bg-white/10 border-exa-primary/50' : ''}
                  `}
                  disabled={isLoading}
                  required
                />
              </div>
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
                  placeholder="Contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`
                    w-full pl-12 pr-12 py-4 bg-white/5 border border-exa-primary/30
                    rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                    focus:ring-exa-primary focus:border-exa-primary transition-all duration-300
                    ${password ? 'bg-white/10 border-exa-primary/50' : ''}
                  `}
                  disabled={isLoading}
                  required
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
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
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
              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className={`
                  w-full h-14 text-base font-semibold text-white rounded-2xl
                  transition-all duration-300
                  ${!isFormValid || isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-exa-primary hover:bg-exa-primary/90 hover:shadow-xl hover:shadow-exa-primary/25'
                  }
                `}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Ingresando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span>Ingresar</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </button>
            </motion.div>

            {/* Help Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <p className="text-gray-400 text-sm">
                Problemas para acceder?{' '}
                <button
                  type="button"
                  className="text-exa-primary hover:text-exa-secondary transition-colors"
                >
                  Contacta soporte
                </button>
              </p>
            </motion.div>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-gray-500 text-xs">
            © 2024 LogiRapid. Todos los derechos reservados.
          </p>
        </motion.div>
      </div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 right-20 w-4 h-4 bg-exa-primary rounded-full opacity-80"
        animate={{
          y: [0, -40, 0],
          x: [0, 25, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-32 left-16 w-3 h-3 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -25, 0],
          x: [0, -20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <motion.div
        className="absolute top-1/3 left-1/4 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -30, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -20, 0],
          x: [0, -18, 0],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
      />
      <motion.div
        className="absolute top-2/3 right-1/5 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -35, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8
        }}
      />
      <motion.div
        className="absolute left-1/6 top-1/4 w-2 h-2 bg-exa-secondary rounded-full opacity-80"
        animate={{
          y: [0, -25, 0],
          x: [0, -15, 0],
        }}
        transition={{
          duration: 3.3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2
        }}
      />
      <motion.div
        className="absolute top-1/5 right-1/3 w-3 h-3 bg-exa-primary rounded-full opacity-70"
        animate={{
          y: [0, -30, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.8
        }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-6"
            >
              {/* Loading Animation */}
              <div className="relative">
                <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-t-4 border-exa-primary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Truck className="h-12 w-12 text-exa-primary animate-pulse" />
                </div>
              </div>

              {/* Loading Text */}
              <div className="text-center space-y-3">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-semibold text-white"
                >
                  Preparando tu ruta
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-sm text-gray-400"
                >
                  Verificando credenciales...
                </motion.p>
              </div>

              {/* Loading Dots Animation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex space-x-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  className="w-3 h-3 bg-exa-primary rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  className="w-3 h-3 bg-exa-secondary rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  className="w-3 h-3 bg-exa-primary rounded-full"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
