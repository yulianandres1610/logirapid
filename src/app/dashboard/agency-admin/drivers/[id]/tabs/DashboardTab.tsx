'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Package,
  PackageCheck,
  Box,
  Truck
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface DashboardTabProps {
  driver: any
  refreshKey?: number
}

interface Statistics {
  cajasVaciasCount: number
  bultosCount: number
  cajasVaciasCapacity: number
  bultosCapacity: number
  cajasVaciasPercentage: number
  bultosPercentage: number
  totalRoutes: number
  completedRoutes: number
  activeRoutes: number
  totalPackages: number
  deliveredPackages: number
  estadoBreakdown: Record<string, number>
  activityData: { date: string; count: number }[]
}

export default function DashboardTab({ driver, refreshKey = 0 }: DashboardTabProps) {
  const [statistics, setStatistics] = useState<Statistics>({
    cajasVaciasCount: 0,
    bultosCount: 0,
    cajasVaciasCapacity: 50,
    bultosCapacity: 100,
    cajasVaciasPercentage: 0,
    bultosPercentage: 0,
    totalRoutes: 0,
    completedRoutes: 0,
    activeRoutes: 0,
    totalPackages: 0,
    deliveredPackages: 0,
    estadoBreakdown: {},
    activityData: []
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    fetchStatistics()
  }, [driver.id, timeRange, refreshKey])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/drivers/${driver.id}/statistics?range=${timeRange}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStatistics(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Cajas Vacias"
          value={statistics.cajasVaciasCount}
          icon={Box}
          color="from-purple-500 to-purple-600"
          subtitle="Asignadas al driver"
        />
        <StatCard
          title="Bultos"
          value={statistics.bultosCount}
          icon={Package}
          color="from-amber-500 to-amber-600"
          subtitle="Asignados al driver"
        />
        <StatCard
          title="Rutas Activas"
          value={statistics.activeRoutes}
          icon={Truck}
          color="from-blue-500 to-blue-600"
          subtitle={`${statistics.completedRoutes} completadas`}
        />
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Actividad del Driver
        </h2>
        <div className="flex gap-2">
          {[
            { value: 'day', label: 'Dia' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
            { value: 'year', label: 'Ano' }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                timeRange === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Activity Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Empaques Asignados por {timeRange === 'day' ? 'Hora' : timeRange === 'week' ? 'Dia' : timeRange === 'month' ? 'Dia del Mes' : 'Mes'}
          </h3>
          {statistics.activityData && statistics.activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statistics.activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                  }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Empaques" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
              No hay datos de actividad para este periodo
            </div>
          )}
        </div>

        {/* Inventory Display - Double Circular */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <Package className="h-5 w-5 mr-2 text-orange-600" />
            Inventario Asignado
          </h3>
          <div className="flex items-center justify-around h-[300px]">
            {/* Cajas Vacias */}
            {(() => {
              const glowColor = 'bg-purple-500/10'
              const textGradient = 'from-purple-600 to-purple-700'
              const badgeBg = 'bg-purple-50 dark:bg-purple-900/20'
              const badgeBorder = 'border-purple-200 dark:border-purple-800'
              const badgeDot = 'bg-purple-500'
              const badgeText = 'text-purple-700 dark:text-purple-300'

              return (
                <div className="relative">
                  <div className="relative w-44 h-44">
                    <div className={`absolute inset-0 ${glowColor} rounded-full blur-xl`}></div>
                    <svg className="transform -rotate-90 w-44 h-44 relative z-10">
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                        className="dark:stroke-gray-700"
                      />
                      <defs>
                        <linearGradient id="cajasPurpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#7C3AED" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="url(#cajasPurpleGradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray="439.6 439.6"
                        strokeLinecap="round"
                        className="drop-shadow-lg"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-4xl font-bold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent`}>
                        {statistics.cajasVaciasCount}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        unidades
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${badgeBg} rounded-full border ${badgeBorder}`}>
                      <div className={`w-2 h-2 ${badgeDot} rounded-full animate-pulse`}></div>
                      <p className={`text-sm font-semibold ${badgeText}`}>
                        Cajas Vacias
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Bultos */}
            {(() => {
              const glowColor = 'bg-amber-500/10'
              const textGradient = 'from-amber-600 to-amber-700'
              const badgeBg = 'bg-amber-50 dark:bg-amber-900/20'
              const badgeBorder = 'border-amber-200 dark:border-amber-800'
              const badgeDot = 'bg-amber-500'
              const badgeText = 'text-amber-700 dark:text-amber-300'

              return (
                <div className="relative">
                  <div className="relative w-44 h-44">
                    <div className={`absolute inset-0 ${glowColor} rounded-full blur-xl`}></div>
                    <svg className="transform -rotate-90 w-44 h-44 relative z-10">
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                        className="dark:stroke-gray-700"
                      />
                      <defs>
                        <linearGradient id="bultosAmberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="url(#bultosAmberGradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray="439.6 439.6"
                        strokeLinecap="round"
                        className="drop-shadow-lg"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-4xl font-bold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent`}>
                        {statistics.bultosCount}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        unidades
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${badgeBg} rounded-full border ${badgeBorder}`}>
                      <div className={`w-2 h-2 ${badgeDot} rounded-full animate-pulse`}></div>
                      <p className={`text-sm font-semibold ${badgeText}`}>
                        Bultos
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Estado Breakdown */}
      {Object.keys(statistics.estadoBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <PackageCheck className="h-5 w-5 mr-2 text-green-600" />
            Desglose por Estado
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.estadoBreakdown).map(([estado, count]) => (
              <div
                key={estado}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center"
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {estado.replace(/_/g, ' ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
