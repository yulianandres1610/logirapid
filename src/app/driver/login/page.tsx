'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Truck, Package } from 'lucide-react'

export default function DriverLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
        // Check if user is a driver or has access
        const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
        if (!allowedRoles.includes(data.data.user.role)) {
          setError('Este portal es solo para conductores')
          setIsLoading(false)
          return
        }

        // Store user data
        localStorage.setItem('user', JSON.stringify(data.data.user))
        localStorage.setItem('auth-token', data.data.token)

        // Set cookies
        document.cookie = `auth-token=${data.data.token}; path=/; max-age=${60 * 60 * 24 * 7}` // 7 days
        document.cookie = `user-role=${data.data.user.role}; path=/; max-age=${60 * 60 * 24 * 7}`

        // Redirect to routes page
        router.push('/driver/routes')
      } else {
        setError(data.error || 'Error al iniciar sesion')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/20 rounded-full filter blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-exa-primary/15 rounded-full filter blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-500" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-sm mx-auto">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header with Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="pt-8 pb-4 px-6 text-center"
          >
            <img
              src="/images/blanco.png"
              alt="LogiRapid"
              className="h-12 w-auto mx-auto mb-4 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />

            {/* Portal Driver Badge */}
            <div className="inline-flex items-center gap-2 bg-exa-primary/20 text-exa-primary px-4 py-2 rounded-full">
              <Truck className="w-4 h-4" />
              <span className="text-sm font-semibold">Portal Driver</span>
            </div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-5">
            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3"
                >
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-gray-400 text-sm font-medium">
                Correo electronico
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:border-exa-primary focus:ring-1 focus:ring-exa-primary transition-all outline-none"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-gray-400 text-sm font-medium">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  required
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-12 pr-12 py-3.5 text-white placeholder-gray-500 focus:border-exa-primary focus:ring-1 focus:ring-exa-primary transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className={`
                w-full py-4 rounded-xl font-semibold text-white
                transition-all duration-200
                ${isLoading
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-exa-primary to-exa-secondary hover:shadow-lg hover:shadow-exa-primary/30'
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Iniciando...</span>
                </div>
              ) : (
                'Iniciar Sesion'
              )}
            </motion.button>

            {/* Help Link */}
            <p className="text-center text-gray-500 text-sm">
              Problemas para acceder?{' '}
              <a href="#" className="text-exa-primary hover:text-exa-secondary transition-colors">
                Contacta soporte
              </a>
            </p>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-gray-600 text-xs mt-6"
        >
          2024 LogiRapid. Todos los derechos reservados.
        </motion.p>
      </div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 right-10 w-4 h-4 bg-exa-primary rounded-full opacity-70"
        animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-32 left-10 w-3 h-3 bg-exa-secondary rounded-full opacity-60"
        animate={{ y: [0, -20, 0], x: [0, -15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-1/3 left-1/6 w-3 h-3 bg-exa-primary rounded-full opacity-50"
        animate={{ y: [0, -25, 0], x: [0, 10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin" />
                <Package className="absolute inset-0 m-auto w-6 h-6 text-exa-primary" />
              </div>
              <p className="text-white font-medium">Verificando credenciales...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
