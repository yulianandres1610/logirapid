'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Users,
  Search,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Box,
  Truck,
  RefreshCw,
  User
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

interface Driver {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  country?: string
  role: string
  status?: string
  isActive: boolean
  createdAt: string
  lastLogin?: string
  cajas_vacias_count: number
  bultos_count: number
  cajas_vacias_capacity: number
  bultos_capacity: number
  companyId?: number
  companyName?: string
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

export default function DriversPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const basePath = pathname?.startsWith('/dashboard/agency-admin')
    ? '/dashboard/agency-admin/drivers'
    : '/dashboard/admin/drivers'

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalDrivers, setTotalDrivers] = useState(0)
  const DRIVERS_PER_PAGE = 25
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Fetch drivers
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: DRIVERS_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/drivers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDrivers(data.data || [])
        setTotalDrivers(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching drivers:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los drivers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, statusFilter])

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter])

  // Calculate statistics
  const stats = {
    total: totalDrivers,
    active: drivers.filter(driver => driver.isActive).length,
    withStock: drivers.filter(driver =>
      (driver.cajas_vacias_count > 0 || driver.bultos_count > 0)
    ).length,
    totalCajasVacias: drivers.reduce((sum, d) => sum + (d.cajas_vacias_count || 0), 0),
    totalBultos: drivers.reduce((sum, d) => sum + (d.bultos_count || 0), 0)
  }

  const STATUSES = {
    active: { label: 'Activo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle }
  }

  // Handle view driver details
  const handleViewDriver = (driverId: number) => {
    router.push(`${basePath}/${driverId}`)
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="space-y-6">
          {/* Panel de Drivers - Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total de Drivers */}
            <div
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Drivers</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.total}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En sistema</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drivers Activos */}
            <div
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-green-900/30 border border-green-800/50'
                        : 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200'
                    )}>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Activos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.active}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-green-100 dark:bg-green-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.total > 0 ? (stats.active / stats.total * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cajas Vacias Total */}
            <div
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-violet-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-purple-900/30 border border-purple-800/50'
                        : 'bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200'
                    )}>
                      <Box className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Cajas Vacias</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.totalCajasVacias.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>
                    En manos de drivers
                  </span>
                </div>
              </div>
            </div>

            {/* Bultos Total */}
            <div
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Package className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Bultos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.totalBultos.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>
                    En manos de drivers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm'
                    : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                    : 'bg-white border-gray-300 text-black text-sm'
                )}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>

              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  onClick={fetchData}
                  className={cn(
                    'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                    'bg-blue-600 hover:bg-blue-700 text-black dark:text-white font-medium',
                    'rounded-lg transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>

          {/* Drivers Table */}
          <div className={cn(
            'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            {loading ? (
              <div className="p-8">
                <LoadingBox size="lg" text="Cargando drivers..." />
              </div>
            ) : drivers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-black dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all'
                    ? 'No se encontraron drivers con los filtros aplicados'
                    : 'No hay drivers registrados'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    'border-b border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Contacto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                        Cajas Vacias
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                        Bultos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Empresa
                      </th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {drivers.map((driver) => (
                      <tr
                        key={driver.id}
                        onClick={() => router.push(`${basePath}/${driver.id}`)}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer'
                        )}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-base font-bold text-black dark:text-gray-100">
                                {driver.firstName} {driver.lastName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                ID: {driver.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="flex items-center gap-2 text-black dark:text-gray-100">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {driver.email}
                            </div>
                            {driver.phone && (
                              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
                                <Phone className="w-3 h-3" />
                                {driver.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            driver.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          )}>
                            {driver.isActive ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {driver.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                              <span className="font-medium text-black dark:text-gray-100">
                                {driver.cajas_vacias_count || 0}
                              </span>
                            </div>
                            <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(driver.cajas_vacias_capacity || 50) > 0 ? ((driver.cajas_vacias_count || 0) / (driver.cajas_vacias_capacity || 50) * 100) : 0}%`,
                                  backgroundColor: (() => {
                                    const count = driver.cajas_vacias_count || 0
                                    const capacity = driver.cajas_vacias_capacity || 50
                                    const remaining = capacity - count
                                    if (count === capacity && capacity > 0) return '#8b5cf6'
                                    if (remaining <= 5 && remaining >= 0) return '#cc0a46'
                                    return '#8b5cf6'
                                  })()
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                              <span className="font-medium text-black dark:text-gray-100">
                                {driver.bultos_count || 0}
                              </span>
                            </div>
                            <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(driver.bultos_capacity || 100) > 0 ? ((driver.bultos_count || 0) / (driver.bultos_capacity || 100) * 100) : 0}%`,
                                  backgroundColor: (() => {
                                    const count = driver.bultos_count || 0
                                    const capacity = driver.bultos_capacity || 100
                                    const remaining = capacity - count
                                    if (count === capacity && capacity > 0) return '#f59e0b'
                                    if (remaining <= 10 && remaining >= 0) return '#cc0a46'
                                    return '#f59e0b'
                                  })()
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-black dark:text-gray-100">
                            {driver.companyName || 'Sin asignar'}
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewDriver(driver.id)
                              }}
                              className={cn(
                                'relative p-2 rounded-lg transition-all duration-200',
                                theme === 'dark'
                                  ? 'text-blue-400 hover:bg-blue-900/30'
                                  : 'text-blue-600 hover:bg-blue-50'
                              )}
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalDrivers > DRIVERS_PER_PAGE && (
              <div
                className={cn(
                  'mt-6 p-4 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-black dark:text-gray-400">
                    Mostrando {((currentPage - 1) * DRIVERS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * DRIVERS_PER_PAGE, totalDrivers)} de {totalDrivers} drivers
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalDrivers / DRIVERS_PER_PAGE)) }, (_, i) => {
                        const totalPages = Math.ceil(totalDrivers / DRIVERS_PER_PAGE)
                        let pageNum

                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              'w-8 h-8 p-0',
                              currentPage === pageNum && theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : currentPage === pageNum
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : ''
                            )}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalDrivers / DRIVERS_PER_PAGE)}
                      className="flex items-center gap-1"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
