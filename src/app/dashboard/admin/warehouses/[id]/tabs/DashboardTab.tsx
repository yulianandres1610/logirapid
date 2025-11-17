'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Package,
  PackageCheck,
  TrendingUp,
  Calendar,
  Box
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface DashboardTabProps {
  warehouse: any
  refreshKey?: number
}

interface Statistics {
  totalPackages: number
  empaquesDisponibles: number
  paquetesEnUbicacion: number
  capacidadUsada: number
  capacidadTotal: number
  packagesPerMonth: any[]
  packagesPerDay: any[]
  packagesPerWeek: any[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function DashboardTab({ warehouse, refreshKey = 0 }: DashboardTabProps) {
  const [statistics, setStatistics] = useState<Statistics>({
    totalPackages: 0,
    empaquesDisponibles: 0,
    paquetesEnUbicacion: 0,
    capacidadUsada: 0,
    capacidadTotal: warehouse.capacity || 1000,
    packagesPerMonth: [],
    packagesPerDay: [],
    packagesPerWeek: []
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    fetchStatistics()
  }, [warehouse.id, timeRange, refreshKey])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/warehouses/${warehouse.id}/statistics?range=${timeRange}`)

      if (response.ok) {
        const data = await response.json()
        setStatistics(data)
      }
    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const capacityPercentage = warehouse.capacity
    ? Math.round((statistics.capacidadUsada / warehouse.capacity) * 100)
    : 0

  // Calcular porcentaje total del almacén basado en cajas vacías y bultos
  const totalCapacity = (warehouse.cajas_vacias_capacity || 0) + (warehouse.bultos_capacity || 0)
  const totalUsed = statistics.empaquesDisponibles + statistics.paquetesEnUbicacion
  const totalCapacityPercentage = totalCapacity > 0
    ? Math.round((totalUsed / totalCapacity) * 100)
    : 0

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Paquetes"
          value={statistics.totalPackages}
          icon={Package}
          color="from-blue-500 to-blue-600"
          subtitle="Paquetes recibidos"
        />
        <StatCard
          title="Cajas Vacías"
          value={statistics.empaquesDisponibles}
          icon={Box}
          color="from-green-500 to-green-600"
          subtitle="En este almacén"
        />
        <StatCard
          title="Bultos"
          value={statistics.paquetesEnUbicacion}
          icon={PackageCheck}
          color="from-blue-500 to-blue-600"
          subtitle="Actualmente almacenados"
        />
        <StatCard
          title="Capacidad del Almacén"
          value={`${totalCapacityPercentage}%`}
          icon={TrendingUp}
          color="from-orange-500 to-orange-600"
          subtitle={`${totalUsed} de ${totalCapacity} unidades totales`}
        />
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Estadísticas de Paquetes Recibidos
        </h2>
        <div className="flex gap-2">
          {[
            { value: 'day', label: 'Día' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
            { value: 'year', label: 'Año' }
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
        {/* Bar Chart - Packages Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Paquetes Recibidos por {timeRange === 'day' ? 'Hora' : timeRange === 'week' ? 'Día' : timeRange === 'month' ? 'Día del Mes' : 'Mes'}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statistics.packagesPerMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="name"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
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
              />
              <Bar dataKey="paquetes" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Capacity Gauge - Doble Circular Moderno */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-orange-600" />
            Capacidad de Inventario
          </h3>
          <div className="flex items-center justify-around h-[300px]">
            {/* Cajas Vacías */}
            {(() => {
              const cajasPercentage = warehouse.cajas_vacias_capacity > 0
                ? Math.round((statistics.empaquesDisponibles / warehouse.cajas_vacias_capacity) * 100)
                : 0
              const espaciosDisponibles = statistics.empaquesDisponibles || 0
              const isLowCapacity = espaciosDisponibles <= 10
              const glowColor = isLowCapacity ? 'bg-[#cc0a46]/10' : 'bg-blue-500/10'
              const gradientId = isLowCapacity ? 'cajasRedGradient' : 'cajasBlueGradient'
              const textGradient = isLowCapacity ? 'from-[#cc0a46] to-[#a00838]' : 'from-blue-600 to-blue-700'
              const badgeBg = isLowCapacity ? 'bg-[#cc0a46]/10' : 'bg-blue-50 dark:bg-blue-900/20'
              const badgeBorder = isLowCapacity ? 'border-[#cc0a46]' : 'border-blue-200 dark:border-blue-800'
              const badgeDot = isLowCapacity ? 'bg-[#cc0a46]' : 'bg-blue-500'
              const badgeText = isLowCapacity ? 'text-[#cc0a46]' : 'text-blue-700 dark:text-blue-300'
              const percentageText = isLowCapacity ? 'text-[#cc0a46]' : 'text-blue-600 dark:text-blue-400'

              return (
                <div className="relative">
                  <div className="relative w-44 h-44">
                    {/* Círculo de fondo con efecto glow */}
                    <div className={`absolute inset-0 ${glowColor} rounded-full blur-xl`}></div>
                    <svg className="transform -rotate-90 w-44 h-44 relative z-10">
                      {/* Círculo de fondo */}
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                        className="dark:stroke-gray-700"
                      />
                      {/* Gradiente para el círculo de progreso */}
                      <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={isLowCapacity ? "#cc0a46" : "#3B82F6"} />
                          <stop offset="100%" stopColor={isLowCapacity ? "#a00838" : "#2563EB"} />
                        </linearGradient>
                      </defs>
                      {/* Círculo de progreso con gradiente */}
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${((statistics.empaquesDisponibles / (warehouse.cajas_vacias_capacity || 100)) * 439.6)} 439.6`}
                        strokeLinecap="round"
                        className="drop-shadow-lg"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent`}>
                        {statistics.empaquesDisponibles}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        de {warehouse.cajas_vacias_capacity || 100}
                      </span>
                      <span className={`text-sm font-semibold ${percentageText} mt-1`}>
                        {cajasPercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${badgeBg} rounded-full border ${badgeBorder}`}>
                      <div className={`w-2 h-2 ${badgeDot} rounded-full animate-pulse`}></div>
                      <p className={`text-sm font-semibold ${badgeText}`}>
                        Cajas Vacías
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Bultos */}
            {(() => {
              const bultosPercentage = warehouse.bultos_capacity > 0
                ? Math.round((statistics.paquetesEnUbicacion / warehouse.bultos_capacity) * 100)
                : 0
              const espaciosDisponibles = statistics.paquetesEnUbicacion || 0
              const isLowCapacity = espaciosDisponibles <= 10
              const glowColor = isLowCapacity ? 'bg-[#cc0a46]/10' : 'bg-blue-500/10'
              const gradientId = isLowCapacity ? 'bultosRedGradient' : 'bultosBlueGradient'
              const textGradient = isLowCapacity ? 'from-[#cc0a46] to-[#a00838]' : 'from-blue-600 to-blue-700'
              const badgeBg = isLowCapacity ? 'bg-[#cc0a46]/10' : 'bg-blue-50 dark:bg-blue-900/20'
              const badgeBorder = isLowCapacity ? 'border-[#cc0a46]' : 'border-blue-200 dark:border-blue-800'
              const badgeDot = isLowCapacity ? 'bg-[#cc0a46]' : 'bg-blue-500'
              const badgeText = isLowCapacity ? 'text-[#cc0a46]' : 'text-blue-700 dark:text-blue-300'
              const percentageText = isLowCapacity ? 'text-[#cc0a46]' : 'text-blue-600 dark:text-blue-400'

              return (
                <div className="relative">
                  <div className="relative w-44 h-44">
                    {/* Círculo de fondo con efecto glow */}
                    <div className={`absolute inset-0 ${glowColor} rounded-full blur-xl`}></div>
                    <svg className="transform -rotate-90 w-44 h-44 relative z-10">
                      {/* Círculo de fondo */}
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                        className="dark:stroke-gray-700"
                      />
                      {/* Gradiente para el círculo de progreso */}
                      <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={isLowCapacity ? "#cc0a46" : "#3B82F6"} />
                          <stop offset="100%" stopColor={isLowCapacity ? "#a00838" : "#2563EB"} />
                        </linearGradient>
                      </defs>
                      {/* Círculo de progreso con gradiente */}
                      <circle
                        cx="88"
                        cy="88"
                        r="70"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${((statistics.paquetesEnUbicacion / (warehouse.bultos_capacity || 100)) * 439.6)} 439.6`}
                        strokeLinecap="round"
                        className="drop-shadow-lg"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent`}>
                        {statistics.paquetesEnUbicacion}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        de {warehouse.bultos_capacity || 100}
                      </span>
                      <span className={`text-sm font-semibold ${percentageText} mt-1`}>
                        {bultosPercentage}%
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

    </div>
  )
}
