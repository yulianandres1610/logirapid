'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Package,
  BarChart3
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/theme-context'

export default function UserDashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { theme } = useTheme()

  // Estadísticas específicas para USER (vendedor de servicios)
  const stats = [
    {
      title: "Servicios Vendidos",
      value: "68",
      change: { value: 8, trend: 'up' as const },
      icon: Package,
      description: "Este mes"
    },
    {
      title: "Comisiones Ganadas",
      value: "$425",
      change: { value: 15, trend: 'up' as const },
      icon: DollarSign,
      description: "Acumulado"
    },
    {
      title: "Transacciones Hoy",
      value: "12",
      change: { value: 3, trend: 'up' as const },
      icon: CreditCard,
      description: "Procesadas"
    },
    {
      title: "Ranking",
      value: "#5",
      change: { value: 2, trend: 'up' as const },
      icon: TrendingUp,
      description: "Entre vendedores"
    }
  ]

  const recentSales = [
    { id: 1, service: "Remesa a Cuba", amount: "$150", commission: "$7.50", time: "hace 5 min", type: "success" },
    { id: 2, service: "Recarga Móvil", amount: "$25", commission: "$1.25", time: "hace 12 min", type: "success" },
    { id: 3, service: "Paquete Express", amount: "$85", commission: "$4.25", time: "hace 25 min", type: "info" },
    { id: 4, service: "Recarga Nauta", amount: "$30", commission: "$1.50", time: "hace 1 hora", type: "success" }
  ]

  const quickActions = [
    { title: "Vender Remesa", icon: CreditCard, color: "bg-blue-500", href: "/dashboard/user/remittance" },
    { title: "Recargar Móvil", icon: ShoppingCart, color: "bg-green-500", href: "/dashboard/user/recharge" },
    { title: "Mis Ventas", icon: BarChart3, color: "bg-purple-500", href: "/dashboard/user/sales" },
    { title: "Comisiones", icon: DollarSign, color: "bg-orange-500", href: "/dashboard/user/commissions" }
  ]

  return (
    <ProtectedRoute requiredRole="USER">
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Welcome Header - User Specific */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-2"
          >
            <h1 className={cn(
              "text-xl font-light mb-1",
              theme === 'dark' ? "text-white" : "text-black"
            )}>
              Bienvenido, {user?.name?.split(' ')[0] || 'Usuario'}
            </h1>
            <p className={cn(
              "text-xs",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Panel de ventas - Tu Empresa
            </p>
          </motion.div>

          {/* Stats Grid - User Sales Focus */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={cn(
                  "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10"
                    : "bg-white/90 border-gray-100 shadow-lg hover:border-exa-primary/30"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    theme === 'dark'
                      ? "bg-exa-secondary/10"
                      : "bg-gradient-to-br from-exa-primary/10 to-exa-secondary/10 shadow-md"
                  )}>
                    <stat.icon className={cn(
                      "w-6 h-6 transition-all duration-300",
                      theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                    )} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg",
                    stat.change.trend === 'up'
                      ? theme === 'dark' ? "text-green-400 bg-green-400/10" : "text-green-600 bg-green-50 border border-green-200"
                      : stat.change.trend === 'down'
                        ? theme === 'dark' ? "text-red-400 bg-red-400/10" : "text-red-600 bg-red-50 border border-red-200"
                        : theme === 'dark' ? "text-gray-400 bg-gray-400/10" : "text-gray-600 bg-gray-50 border border-gray-200"
                  )}>
                    {stat.change.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : stat.change.trend === 'down' ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {stat.change.value}%
                  </div>
                </div>
                <h3 className={cn(
                  "text-2xl font-bold mb-1",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>{stat.value}</h3>
                <p className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? "text-gray-400" : "text-black"
                )}>{stat.title}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions - Sales Focus */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className={cn(
              "text-xl font-light mb-6",
              theme === 'dark' ? "text-white" : "text-black"
            )}>Acciones Rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(action.href)}
                  className={cn(
                    "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 text-left group relative overflow-hidden",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10"
                      : "bg-white/90 border-gray-100 shadow-lg hover:border-exa-primary/30"
                  )}
                >
                  {/* Background gradient overlay on hover */}
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br",
                    theme === 'dark'
                      ? "from-exa-primary/5 to-exa-secondary/5"
                      : "from-exa-primary/8 to-exa-secondary/8"
                  )} />

                  <div className="relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                      "group-hover:scale-110 transition-transform duration-300 group-hover:rotate-6",
                      action.color
                    )}>
                      <action.icon className="w-7 h-7 text-white drop-shadow-sm" />
                    </div>
                    <h3 className={cn(
                      "font-bold mb-2 text-lg",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>{action.title}</h3>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-black"
                    )}>Iniciar venta</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Sales Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Sales */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6",
                theme === 'dark'
                  ? "bg-white/5 border-white/10"
                  : "bg-gray-50/80 border-gray-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-xl font-light",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>Ventas Recientes</h2>
                <Activity className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )} />
              </div>

              <div className="space-y-4">
                {recentSales.map((sale, index) => (
                  <motion.div
                    key={sale.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className={cn(
                      "flex items-center justify-between py-3 border-b last:border-0",
                      theme === 'dark' ? "border-white/5" : "border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        sale.type === 'success' ? "bg-green-500" : "bg-blue-500"
                      )} />
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>{sale.service}</p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Comisión: {sale.commission}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>{sale.amount}</p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-500" : "text-gray-500"
                      )}>{sale.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Sales Performance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6",
                theme === 'dark'
                  ? "bg-white/5 border-white/10"
                  : "bg-gray-50/80 border-gray-200"
              )}
            >
              <h2 className={cn(
                "text-xl font-light mb-6",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>Rendimiento de Ventas</h2>

              <div className="space-y-6">
                {[
                  { name: "Remesas", percentage: 45, color: theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary" },
                  { name: "Recargas Móviles", percentage: 68, color: theme === 'dark' ? "bg-exa-primary" : "bg-exa-secondary" },
                  { name: "Paquetes", percentage: 35, color: "bg-green-500" },
                  { name: "Otros Servicios", percentage: 28, color: "bg-purple-500" }
                ].map((service, index) => (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>{service.name}</span>
                      <span className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>{service.percentage}%</span>
                    </div>
                    <div className={cn(
                      "w-full rounded-full h-2",
                      theme === 'dark' ? "bg-white/10" : "bg-gray-200"
                    )}>
                      <motion.div
                        className={cn("h-2 rounded-full", service.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${service.percentage}%` }}
                        transition={{ delay: 0.9 + index * 0.1, duration: 0.8 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}