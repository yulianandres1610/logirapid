'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  User,
  Wallet,
  DollarSign,
  FileText,
  TrendingUp,
  Calendar,
  Building2,
  LogOut,
  Clock,
  ArrowRight,
  Loader2
} from 'lucide-react'

interface Profile {
  id: number
  employeeCode: string
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  role: string
  payType: string
  payRate: number
  currency: string
  commissionRate: number
  companyName: string
}

interface Stats {
  currentMonth: {
    orderCount: number
    totalSales: number
    estimatedCommission: number
  }
  pendingPayroll: {
    amount: number
    count: number
  }
  pendingRequests: {
    amount: number
    count: number
  }
  lastPayroll: {
    netPay: number
    periodStart: string
    periodEnd: string
    paidAt: string
  } | null
}

const payTypeLabels: Record<string, string> = {
  hourly: 'Por Hora',
  daily: 'Por Día',
  monthly: 'Mensual'
}

export default function EmployeeDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/employee/profile')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProfile(result.data.profile)
          setStats(result.data.stats)
        }
      } else if (response.status === 401) {
        router.push('/employee/login')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/employee/auth/logout', { method: 'POST' })
      router.push('/employee/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Error al cargar perfil</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">{profile.companyName}</h1>
              <p className="text-sm text-gray-500">{profile.employeeCode}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-200">Bienvenido,</p>
              <h2 className="text-2xl font-bold">{profile.fullName}</h2>
              <p className="text-purple-200 mt-1">{profile.role}</p>
            </div>
            <div className="text-right">
              <p className="text-purple-200 text-sm">Tu tarifa</p>
              <p className="text-2xl font-bold">
                ${profile.payRate} <span className="text-base font-normal">/ {payTypeLabels[profile.payType]?.toLowerCase().replace('por ', '')}</span>
              </p>
              {profile.commissionRate > 0 && (
                <p className="text-purple-200 text-sm">+ {profile.commissionRate}% comisión</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${stats?.currentMonth.totalSales.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500">Ventas este mes</p>
            <p className="text-xs text-green-600 mt-1">
              {stats?.currentMonth.orderCount || 0} órdenes
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${stats?.currentMonth.estimatedCommission.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500">Comisión estimada</p>
            <p className="text-xs text-purple-600 mt-1">
              {profile.commissionRate}% de ventas
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${stats?.pendingPayroll.amount.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500">Nómina pendiente</p>
            <p className="text-xs text-amber-600 mt-1">
              {stats?.pendingPayroll.count || 0} períodos
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.pendingRequests.count || 0}
            </p>
            <p className="text-sm text-gray-500">Solicitudes pendientes</p>
            <p className="text-xs text-blue-600 mt-1">
              ${stats?.pendingRequests.amount.toLocaleString() || 0}
            </p>
          </motion.div>
        </div>

        {/* Last Payroll */}
        {stats?.lastPayroll && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
          >
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Último Pago
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${stats.lastPayroll.netPay.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Período: {new Date(stats.lastPayroll.periodStart).toLocaleDateString()} - {new Date(stats.lastPayroll.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Pagado el</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {new Date(stats.lastPayroll.paidAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/employee/payroll">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Mis Nóminas</h3>
                    <p className="text-sm text-gray-500">Ver historial de pagos</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </motion.div>
          </Link>

          <Link href="/employee/request">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Solicitar Pago</h3>
                    <p className="text-sm text-gray-500">Adelanto, comisión o bono</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Profile Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
        >
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            Mi Perfil
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{profile.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Código</p>
              <p className="font-medium text-gray-900 dark:text-white">{profile.employeeCode}</p>
            </div>
            <div>
              <p className="text-gray-500">Rol</p>
              <p className="font-medium text-gray-900 dark:text-white">{profile.role}</p>
            </div>
            <div>
              <p className="text-gray-500">Tipo de Pago</p>
              <p className="font-medium text-gray-900 dark:text-white">{payTypeLabels[profile.payType]}</p>
            </div>
            <div>
              <p className="text-gray-500">Tarifa</p>
              <p className="font-medium text-gray-900 dark:text-white">${profile.payRate} {profile.currency}</p>
            </div>
            <div>
              <p className="text-gray-500">Comisión</p>
              <p className="font-medium text-gray-900 dark:text-white">{profile.commissionRate}%</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
