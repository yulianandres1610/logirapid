'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  ShoppingCart,
  Globe,
  Eye,
  Car,
  Ticket,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/theme-context'

export default function AgencyAdminDashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { theme } = useTheme()

  // Simplified stats for agency admin - focused on their company data
  const stats = [
    {
      title: "Usuarios",
      value: "156",
      change: { value: 8, trend: 'up' as const },
      icon: Users,
      description: "Activos en tu empresa"
    },
    {
      title: "Transacciones",
      value: "2,847",
      change: { value: 12, trend: 'up' as const },
      icon: CreditCard,
      description: "Este mes"
    },
    {
      title: "Ingresos",
      value: "$15,432",
      change: { value: 6, trend: 'up' as const },
      icon: DollarSign,
      description: "Revenue mensual"
    },
    {
      title: "Sucursales",
      value: "8",
      change: { value: 2, trend: 'up' as const },
      icon: Building2,
      description: "Activas"
    }
  ]

  const recentActivity = [
    { id: 1, user: "Carlos Pérez", action: "Nuevo usuario registrado", time: "hace 5 min", type: "success" },
    { id: 2, user: "María López", action: "Transacción completada", time: "hace 12 min", type: "success" },
    { id: 3, user: "Juan Martínez", action: "Sucursal creada", time: "hace 25 min", type: "info" },
    { id: 4, user: "Ana García", action: "Recarga móvil", time: "hace 1 hora", type: "warning" }
  ]

  const quickActions = [
    { title: "Ver Usuarios", icon: Users, color: "bg-blue-500", href: "/dashboard/agency-admin/users" },
    { title: "Nueva Sucursal", icon: Building2, color: "bg-green-500", href: "/dashboard/agency-admin/companies" },
    { title: "Transacciones", icon: CreditCard, color: "bg-purple-500", href: "/dashboard/agency-admin/transactions" },
    { title: "Documentos", icon: FileText, color: "bg-orange-500", href: "/dashboard/agency-admin/documents" }
  ]

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Welcome Header - Agency Specific */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-2"
          >
            <h1 className={cn(
              "text-xl font-light mb-1",
              theme === 'dark' ? "text-white" : "text-black"
            )}>
              Bienvenido, {user?.name?.split(' ')[0] || 'Admin'}
            </h1>
            <p className={cn(
              "text-xs",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Panel de administración - Tu Empresa
            </p>
          </motion.div>

          {/* Stats Grid - Clean Cards */}
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

          {/* Quick Actions */}
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
                    )}>Gestionar {action.title.toLowerCase()}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Activity Section - Minimal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
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
                )}>Actividad Reciente</h2>
                <Eye className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )} />
              </div>

              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className={cn(
                      "flex items-center gap-4 py-3 border-b last:border-0",
                      theme === 'dark' ? "border-white/5" : "border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      activity.type === 'success' ? "bg-green-500" :
                      activity.type === 'warning' ? "bg-yellow-500" : "bg-blue-500"
                    )} />
                    <div className="flex-1">
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>{activity.user}</p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>{activity.action}</p>
                    </div>
                    <span className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-500" : "text-gray-500"
                    )}>{activity.time}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Quick Stats */}
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
              )}>Servicios Populares</h2>

              <div className="space-y-6">
                {[
                  { name: "Remesas", percentage: 65, color: theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary" },
                  { name: "Recargas Móviles", percentage: 82, color: theme === 'dark' ? "bg-exa-primary" : "bg-exa-secondary" },
                  { name: "Transfers", percentage: 48, color: "bg-green-500" },
                  { name: "Pagos", percentage: 35, color: "bg-purple-500" }
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