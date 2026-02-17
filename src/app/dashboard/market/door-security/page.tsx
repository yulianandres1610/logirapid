'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield,
  Users,
  Clock,
  Monitor,
  ArrowRight,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Plus
} from 'lucide-react'

interface DashboardStats {
  totalKiosks: number
  activeKiosks: number
  visitorsToday: number
  activeVisitors: number
  pendingValidations: number
}

interface RecentLog {
  id: number
  visitorName: string
  visitorIdNumber: string
  entryTime: string
  exitTime: string | null
  status: string
  kioskName: string
}

export default function DoorSecurityDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch kiosks for stats
      const kiosksRes = await fetch('/api/market/door-security/kiosks')
      const kiosksData = kiosksRes.ok ? await kiosksRes.json() : { success: false }

      // Fetch today's logs
      const today = new Date().toISOString().split('T')[0]
      const logsRes = await fetch(`/api/market/door-security/logs?date=${today}&limit=10`)
      const logsData = logsRes.ok ? await logsRes.json() : { success: false }

      if (kiosksData.success) {
        const kiosks = kiosksData.data.kiosks || []
        const activeVisitors = kiosks.reduce((sum: number, k: any) => sum + (k.activeVisitors || 0), 0)
        const visitorsToday = kiosks.reduce((sum: number, k: any) => sum + (k.todayVisitors || 0), 0)

        setStats({
          totalKiosks: kiosks.length,
          activeKiosks: kiosks.filter((k: any) => k.isActive).length,
          visitorsToday,
          activeVisitors,
          pendingValidations: 0 // Would need separate endpoint
        })
      }

      if (logsData.success) {
        setRecentLogs(logsData.data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeTables = async () => {
    try {
      const res = await fetch('/api/market/door-security/init-tables', {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        alert('Tablas inicializadas correctamente')
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error initializing tables:', error)
      alert('Error al inicializar tablas')
    }
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    href
  }: {
    title: string
    value: number | string
    icon: React.ComponentType<{ className?: string }>
    color: string
    href?: string
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 mt-4"
        >
          Ver detalles
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seguridad de Puerta</h1>
          <p className="text-gray-500 dark:text-gray-400">Control de acceso y visitantes</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={initializeTables}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Inicializar BD
          </button>
          <Link
            href="/dashboard/market/door-security/kiosks"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Kiosk
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Kiosks Activos"
          value={stats?.activeKiosks || 0}
          icon={Monitor}
          color="bg-teal-500"
          href="/dashboard/market/door-security/kiosks"
        />
        <StatCard
          title="Visitantes Hoy"
          value={stats?.visitorsToday || 0}
          icon={Users}
          color="bg-blue-500"
          href="/dashboard/market/door-security/logs"
        />
        <StatCard
          title="Dentro Ahora"
          value={stats?.activeVisitors || 0}
          icon={LogIn}
          color="bg-green-500"
          href="/dashboard/market/door-security/logs?status=active"
        />
        <StatCard
          title="Validaciones Pendientes"
          value={stats?.pendingValidations || 0}
          icon={AlertTriangle}
          color="bg-orange-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Actividad Reciente
            </h2>
            <Link
              href="/dashboard/market/door-security/logs"
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              Ver todo
            </Link>
          </div>
        </div>

        {recentLogs.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentLogs.map(log => (
              <div key={log.id} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  log.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {log.status === 'active' ? (
                    <LogIn className="w-5 h-5" />
                  ) : (
                    <LogOut className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{log.visitorName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {log.visitorIdNumber} • {log.kioskName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(log.entryTime).toLocaleTimeString('es', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {log.exitTime && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Salió: {new Date(log.exitTime).toLocaleTimeString('es', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                <div>
                  {log.status === 'active' ? (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                      Adentro
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                      Completada
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No hay actividad registrada hoy</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/market/door-security/kiosks"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-teal-200 dark:hover:border-teal-800 transition-colors group"
        >
          <Monitor className="w-8 h-8 text-teal-600 dark:text-teal-400 mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
            Gestionar Kiosks
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configurar kiosks de puerta y asignar guardias
          </p>
        </Link>

        <Link
          href="/dashboard/market/door-security/visitors"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-teal-200 dark:hover:border-teal-800 transition-colors group"
        >
          <Users className="w-8 h-8 text-teal-600 dark:text-teal-400 mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
            Visitantes
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ver historial y perfil de visitantes
          </p>
        </Link>

        <Link
          href="/dashboard/market/door-security/logs"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-teal-200 dark:hover:border-teal-800 transition-colors group"
        >
          <Clock className="w-8 h-8 text-teal-600 dark:text-teal-400 mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
            Historial de Visitas
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Registro completo de entradas y salidas
          </p>
        </Link>
      </div>
    </div>
  )
}
