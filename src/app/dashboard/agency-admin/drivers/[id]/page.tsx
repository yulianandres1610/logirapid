'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  ArrowLeft,
  BarChart3,
  Package,
  PackageCheck,
  Phone,
  Mail,
  User,
  Box,
  ScanLine,
  PackagePlus
} from 'lucide-react'

// Tabs components
import DashboardTab from './tabs/DashboardTab'
import EmpaquesTab from './tabs/EmpaquesTab'
import BultosTab from './tabs/BultosTab'
import RecepcionTab from './tabs/RecepcionTab'
import RecepcionBultosTab from './tabs/RecepcionBultosTab'

interface DriverDetails {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  role: string
  status: string | null
  isActive: boolean
  createdAt: string
  lastLogin: string | null
  cajas_vacias_count: number
  bultos_count: number
  cajas_vacias_capacity: number
  bultos_capacity: number
  companyId: number | null
  companyName: string | null
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'empaques', label: 'Cajas Vacias', icon: Box },
  { id: 'recepcion', label: 'Recepcion Cajas', icon: ScanLine },
  { id: 'bultos', label: 'Bultos', icon: PackageCheck },
  { id: 'recepcion-bultos', label: 'Recepcion Bultos', icon: PackagePlus }
]

export default function DriverDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const basePath = '/dashboard/agency-admin/drivers'
  const { showNotification } = useNotifications()
  const driverId = params.id as string

  const [driver, setDriver] = useState<DriverDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get active tab from URL, default to 'dashboard'
  const activeTab = searchParams.get('tab') || 'dashboard'

  useEffect(() => {
    fetchDriver()
  }, [driverId])

  const fetchDriver = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/drivers/${driverId}`)

      if (!response.ok) {
        throw new Error('Error al cargar driver')
      }

      const data = await response.json()
      if (data.success) {
        setDriver(data.data)
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error fetching driver:', error)
      showNotification('error', 'Error', 'No se pudo cargar la informacion del driver')
      router.push(basePath)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!driver) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">Driver no encontrado</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Back button */}
            <button
              onClick={() => router.push(basePath)}
              className="mb-4 flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a Drivers
            </button>

            {/* Driver info header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {driver.firstName} {driver.lastName}
                    </h1>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      driver.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {driver.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ID: {driver.id}
                  </p>

                  {/* Quick info */}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      {driver.email}
                    </div>
                    {driver.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {driver.phone}
                      </div>
                    )}
                  </div>

                  {/* Stock info */}
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Box className="h-4 w-4 text-purple-500" />
                      <span className="text-gray-600 dark:text-gray-400">Cajas Vacias:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {driver.cajas_vacias_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-amber-500" />
                      <span className="text-gray-600 dark:text-gray-400">Bultos:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {driver.bultos_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id

                  return (
                    <button
                      key={tab.id}
                      onClick={() => router.push(`${basePath}/${driverId}?tab=${tab.id}`)}
                      className={`
                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                        ${isActive
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }
                      `}
                    >
                      <Icon className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-500'}
                      `} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && <DashboardTab driver={driver} refreshKey={refreshKey} />}
          {activeTab === 'empaques' && <EmpaquesTab driver={driver} />}
          {activeTab === 'recepcion' && <RecepcionTab driver={driver} />}
          {activeTab === 'bultos' && <BultosTab driver={driver} />}
          {activeTab === 'recepcion-bultos' && <RecepcionBultosTab driver={driver} onRefresh={fetchDriver} />}
        </div>
      </div>
    </DashboardLayout>
  )
}
