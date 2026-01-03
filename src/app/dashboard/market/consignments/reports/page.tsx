'use client'

import { motion } from 'framer-motion'
import {
  Construction,
  Sparkles,
  ArrowLeft,
  Rocket,
  BarChart3,
  TrendingUp,
  PieChart
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

export default function ConsignmentReportsPage() {
  const { theme } = useTheme()

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-[80vh] p-6 flex flex-col items-center justify-center">
          {/* Back Button */}
          <div className="w-full max-w-2xl mb-8">
            <Link href="/dashboard/market/consignments">
              <motion.button
                whileHover={{ scale: 1.02, x: -5 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Volver a Consignaciones</span>
              </motion.button>
            </Link>
          </div>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={cn(
              'w-full max-w-2xl rounded-3xl p-8 md:p-12 text-center relative overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-xl'
            )}
          >
            {/* Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
              />
            </div>

            {/* Construction Icon with Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="relative z-10 mb-6"
            >
              <div className="relative inline-flex">
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 0],
                    y: [0, -5, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg"
                >
                  <Construction className="w-12 h-12 md:w-16 md:h-16 text-white" />
                </motion.div>

                {/* Floating Sparkles */}
                <motion.div
                  animate={{
                    y: [-10, 10, -10],
                    opacity: [1, 0.5, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-2 -right-2"
                >
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </motion.div>
                <motion.div
                  animate={{
                    y: [10, -10, 10],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="absolute -bottom-1 -left-2"
                >
                  <Sparkles className="w-5 h-5 text-orange-400" />
                </motion.div>
              </div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative z-10 mb-4"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 rounded-full text-sm font-semibold">
                <Rocket className="w-4 h-4" />
                En Desarrollo
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10 text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4"
            >
              Reportes de Consignacion
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative z-10 text-gray-600 dark:text-gray-300 text-lg mb-8 max-w-md mx-auto"
            >
              Estamos trabajando en algo increible para ti.
              Muy pronto tendras acceso a reportes detallados y estadisticas avanzadas.
            </motion.p>

            {/* Features Coming Soon */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
            >
              {[
                { icon: BarChart3, label: 'KPIs en tiempo real', color: 'from-teal-500 to-cyan-500' },
                { icon: TrendingUp, label: 'Tendencias de ventas', color: 'from-green-500 to-emerald-500' },
                { icon: PieChart, label: 'Distribucion por proveedor', color: 'from-purple-500 to-pink-500' }
              ].map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={cn(
                    'p-4 rounded-2xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mx-auto mb-2',
                    feature.color
                  )}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {feature.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Progress Bar Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="relative z-10"
            >
              <p className="text-sm text-gray-500 mb-2">Progreso del desarrollo</p>
              <div className={cn(
                'h-3 rounded-full overflow-hidden',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '65%' }}
                  transition={{ duration: 1.5, delay: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-full relative overflow-hidden"
                >
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </motion.div>
              </div>
              <p className="text-xs text-gray-500 mt-2">65% completado</p>
            </motion.div>
          </motion.div>

          {/* Footer Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-8 text-gray-500 text-sm"
          >
            Gracias por tu paciencia mientras mejoramos la plataforma
          </motion.p>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
