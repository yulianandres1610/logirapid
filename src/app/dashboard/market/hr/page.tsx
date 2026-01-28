'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Building2,
  Clock,
  FileText,
  Calendar,
  Fingerprint,
  TrendingUp,
  UserCheck,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalDepartments: number
  totalSchedules: number
  activeContracts: number
  todayPresent: number
  todayAbsent: number
  todayLate: number
  activeKiosks: number
}

export default function HRDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalDepartments: 0,
    totalSchedules: 0,
    activeContracts: 0,
    todayPresent: 0,
    todayAbsent: 0,
    todayLate: 0,
    activeKiosks: 0
  })
  const [loading, setLoading] = useState(true)
  const [tablesInitialized, setTablesInitialized] = useState(false)

  useEffect(() => {
    initializeAndFetchStats()
  }, [])

  const initializeAndFetchStats = async () => {
    try {
      setLoading(true)

      // First, check and initialize HR tables
      const initResponse = await fetch('/api/market/hr/init-tables', { method: 'POST' })
      if (initResponse.ok) {
        setTablesInitialized(true)
      }

      // Fetch stats
      await fetchStats()
    } catch (error) {
      console.error('Error initializing HR:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch employees count
      const employeesRes = await fetch('/api/market/hr/employees?status=all')
      if (employeesRes.ok) {
        const data = await employeesRes.json()
        if (data.success) {
          setStats(prev => ({
            ...prev,
            totalEmployees: data.data.total,
            activeEmployees: data.data.employees.filter((e: any) => e.status === 'active').length
          }))
        }
      }

      // Fetch departments
      const deptRes = await fetch('/api/market/hr/departments?status=active')
      if (deptRes.ok) {
        const data = await deptRes.json()
        if (data.success) {
          setStats(prev => ({ ...prev, totalDepartments: data.data.length }))
        }
      }

      // Fetch schedules
      const schedRes = await fetch('/api/market/hr/schedules?status=active')
      if (schedRes.ok) {
        const data = await schedRes.json()
        if (data.success) {
          setStats(prev => ({ ...prev, totalSchedules: data.data.length }))
        }
      }

      // Fetch contracts
      const contractRes = await fetch('/api/market/hr/contracts?status=active')
      if (contractRes.ok) {
        const data = await contractRes.json()
        if (data.success) {
          setStats(prev => ({ ...prev, activeContracts: data.data.length }))
        }
      }

      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0]
      const attendanceRes = await fetch(`/api/market/hr/attendance?startDate=${today}&endDate=${today}`)
      if (attendanceRes.ok) {
        const data = await attendanceRes.json()
        if (data.success) {
          const records = data.data.records
          setStats(prev => ({
            ...prev,
            todayPresent: records.filter((r: any) => r.status === 'present').length,
            todayLate: records.filter((r: any) => r.status === 'late').length,
            todayAbsent: prev.activeEmployees - records.length
          }))
        }
      }

      // Fetch kiosks
      const kiosksRes = await fetch('/api/market/hr/kiosks?status=active')
      if (kiosksRes.ok) {
        const data = await kiosksRes.json()
        if (data.success) {
          setStats(prev => ({ ...prev, activeKiosks: data.data.length }))
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const statCards = [
    {
      icon: Users,
      label: 'Empleados Activos',
      value: stats.activeEmployees,
      total: stats.totalEmployees,
      color: 'blue',
      href: '/dashboard/market/hr/employees'
    },
    {
      icon: Building2,
      label: 'Departamentos',
      value: stats.totalDepartments,
      color: 'purple',
      href: '/dashboard/market/hr/departments'
    },
    {
      icon: Clock,
      label: 'Horarios',
      value: stats.totalSchedules,
      color: 'green',
      href: '/dashboard/market/hr/schedules'
    },
    {
      icon: FileText,
      label: 'Contratos Activos',
      value: stats.activeContracts,
      color: 'amber',
      href: '/dashboard/market/hr/contracts'
    },
    {
      icon: CheckCircle,
      label: 'Presentes Hoy',
      value: stats.todayPresent,
      color: 'emerald',
      href: '/dashboard/market/hr/attendance'
    },
    {
      icon: AlertCircle,
      label: 'Tardanzas Hoy',
      value: stats.todayLate,
      color: 'orange',
      href: '/dashboard/market/hr/attendance'
    },
    {
      icon: Fingerprint,
      label: 'Kioscos Activos',
      value: stats.activeKiosks,
      color: 'indigo',
      href: '/dashboard/market/hr/kiosks'
    }
  ]

  const quickActions = [
    { label: 'Nuevo Empleado', href: '/dashboard/market/accounting/employees/create', icon: Users },
    { label: 'Nuevo Contrato', href: '/dashboard/market/hr/contracts/create', icon: FileText },
    { label: 'Crear Departamento', href: '/dashboard/market/hr/departments', icon: Building2 },
    { label: 'Ver Asistencia', href: '/dashboard/market/hr/attendance', icon: Calendar }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Recursos Humanos
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gestión integral del personal
            </p>
          </motion.div>

          {/* Stats Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map((card, idx) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link href={card.href}>
                    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow border-l-4 border-${card.color}-500`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg bg-${card.color}-100 dark:bg-${card.color}-900/30`}>
                          <card.icon className={`w-5 h-5 text-${card.color}-600 dark:text-${card.color}-400`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {card.value}
                        {card.total !== undefined && (
                          <span className="text-sm text-gray-500 font-normal">/{card.total}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Acciones Rápidas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <action.icon className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Module Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Link href="/dashboard/market/hr/employees">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white hover:shadow-lg transition-shadow">
                  <Users className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-bold mb-1">Empleados</h3>
                  <p className="text-sm text-blue-100">
                    Gestión de personal, datos y asignaciones
                  </p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Link href="/dashboard/market/hr/contracts">
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white hover:shadow-lg transition-shadow">
                  <FileText className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-bold mb-1">Contratos</h3>
                  <p className="text-sm text-amber-100">
                    Salarios, comisiones y términos laborales
                  </p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Link href="/dashboard/market/hr/attendance">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white hover:shadow-lg transition-shadow">
                  <Calendar className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-bold mb-1">Asistencia</h3>
                  <p className="text-sm text-emerald-100">
                    Control de entrada/salida y reportes
                  </p>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
