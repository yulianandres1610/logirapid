'use client'

import { motion } from 'framer-motion'
import {
  Construction,
  Sparkles,
  ArrowLeft,
  Rocket,
  BarChart3,
  TrendingUp,
  PieChart,
  Calculator,
  Receipt,
  Wallet,
  LineChart
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

export default function AccountingDashboardPage() {
  const { theme } = useTheme()

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-[80vh] p-6 flex flex-col items-center justify-center">
          {/* Back Button */}
          <div className="w-full max-w-2xl mb-8">
            <Link href="/dashboard/market">
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
                <span>Volver al Dashboard</span>
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
                className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute top-1/2 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 rounded-full blur-3xl"
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
                  className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg"
                >
                  <Calculator className="w-12 h-12 md:w-16 md:h-16 text-white" />
                </motion.div>

                {/* Floating Sparkles */}
                <motion.div
                  animate={{
                    y: [-10, 10, -10],
                    opacity: [1, 0.5, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-3 -right-3"
                >
                  <Sparkles className="w-7 h-7 text-blue-400" />
                </motion.div>
                <motion.div
                  animate={{
                    y: [10, -10, 10],
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                  className="absolute -bottom-2 -left-3"
                >
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </motion.div>

                {/* Floating coins */}
                <motion.div
                  animate={{
                    y: [-15, 5, -15],
                    x: [0, 5, 0],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="absolute -top-4 left-0"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
                    <span className="text-[10px] font-bold text-white">$</span>
                  </div>
                </motion.div>
                <motion.div
                  animate={{
                    y: [5, -15, 5],
                    x: [0, -5, 0],
                    opacity: [0.6, 1, 0.6]
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
                  className="absolute -bottom-3 right-2"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md">
                    <span className="text-[9px] font-bold text-white">$</span>
                  </div>
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
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold">
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
              Modulo de Contabilidad
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative z-10 text-gray-600 dark:text-gray-300 text-lg mb-8 max-w-md mx-auto"
            >
              Estamos construyendo un sistema contable completo para tu negocio.
              Muy pronto tendras control total de tus finanzas.
            </motion.p>

            {/* Features Coming Soon */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
            >
              {[
                { icon: BarChart3, label: 'Dashboard financiero', color: 'from-blue-500 to-blue-600' },
                { icon: Receipt, label: 'Control de gastos', color: 'from-orange-500 to-red-500' },
                { icon: Wallet, label: 'Gestion de nomina', color: 'from-purple-500 to-purple-600' },
                { icon: LineChart, label: 'Reportes avanzados', color: 'from-emerald-500 to-teal-500' }
              ].map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -3 }}
                  className={cn(
                    'p-4 rounded-2xl cursor-default',
                    theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mx-auto mb-2',
                    feature.color
                  )}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
                    {feature.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Animated Chart Preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className={cn(
                'relative z-10 mb-6 p-4 rounded-2xl',
                theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
              )}
            >
              <div className="flex items-end justify-center gap-2 h-20">
                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{
                      delay: 1 + i * 0.08,
                      duration: 0.6,
                      ease: 'easeOut'
                    }}
                    className={cn(
                      'w-3 md:w-4 rounded-t-md',
                      i % 3 === 0 ? 'bg-gradient-to-t from-blue-500 to-blue-400' :
                      i % 3 === 1 ? 'bg-gradient-to-t from-indigo-500 to-indigo-400' :
                      'bg-gradient-to-t from-purple-500 to-purple-400'
                    )}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400">Ene</span>
                <span className="text-[10px] text-gray-400">Jun</span>
                <span className="text-[10px] text-gray-400">Dic</span>
              </div>
            </motion.div>

            {/* Progress Bar Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="relative z-10"
            >
              <p className="text-sm text-gray-500 mb-2">Progreso del desarrollo</p>
              <div className={cn(
                'h-3 rounded-full overflow-hidden',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '35%' }}
                  transition={{ duration: 1.5, delay: 1.3, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 rounded-full relative overflow-hidden"
                >
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </motion.div>
              </div>
              <p className="text-xs text-gray-500 mt-2">35% completado</p>
            </motion.div>
          </motion.div>

          {/* Footer Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-8 text-gray-500 text-sm"
          >
            Gracias por tu paciencia mientras construimos esta herramienta
          </motion.p>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
