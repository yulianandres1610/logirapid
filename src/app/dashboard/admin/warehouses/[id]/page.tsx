'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  ArrowLeft,
  BarChart3,
  Package,
  PackageCheck,
  MapPin,
  Building2,
  Phone,
  Mail,
  Calendar,
  Warehouse,
  Edit,
  ScanLine,
  PackagePlus,
  Send
} from 'lucide-react'

// Tabs components
import DashboardTab from './tabs/DashboardTab'
import EmpaquesTab from './tabs/EmpaquesTab'
import BultosTab from './tabs/BultosTab'
import RecepcionTab from './tabs/RecepcionTab'
import GestionBultosTab from './tabs/GestionBultosTab'

interface WarehouseDetails {
  id: number
  name: string
  code: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  type: string
  status: string
  managerName: string | null
  managerEmail: string | null
  managerPhone: string | null
  operatingHours: any
  customOperatingHours: any
  totalArea: number | null
  capacity: number | null
  cajas_vacias_capacity: number | null
  bultos_capacity: number | null
  openingDate: string | null
  notes: string | null
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'recepcion', label: 'Recepción Cajas Vacías', icon: ScanLine },
  { id: 'gestion-bultos', label: 'Gestión de Bultos', icon: Send },
  { id: 'empaques', label: 'Cajas Vacías', icon: Package },
  { id: 'bultos', label: 'Bultos', icon: PackageCheck }
]

export default function WarehouseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showNotification } = useNotifications()
  const warehouseId = params.id as string

  const [warehouse, setWarehouse] = useState<WarehouseDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get active tab from URL, default to 'dashboard'
  const activeTab = searchParams.get('tab') || 'dashboard'

  useEffect(() => {
    fetchWarehouse()
  }, [warehouseId])

  const fetchWarehouse = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/warehouses/${warehouseId}`)

      if (!response.ok) {
        throw new Error('Error al cargar almacén')
      }

      const data = await response.json()
      setWarehouse(data)
      // Incrementar refreshKey para forzar actualización de componentes hijos
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error fetching warehouse:', error)
      showNotification('error', 'Error', 'No se pudo cargar la información del almacén')
      router.push('/dashboard/admin/warehouses')
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

  if (!warehouse) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Warehouse className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">Almacén no encontrado</p>
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
              onClick={() => router.push('/dashboard/admin/warehouses')}
              className="mb-4 flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a Almacenes
            </button>

            {/* Warehouse info header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {warehouse.name}
                    </h1>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      warehouse.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {warehouse.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Código: {warehouse.code}
                  </p>

                  {/* Quick info */}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {warehouse.address}, {warehouse.city}, {warehouse.state}
                    </div>
                    {warehouse.managerName && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {warehouse.managerName}
                      </div>
                    )}
                    {warehouse.managerEmail && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {warehouse.managerEmail}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/dashboard/admin/warehouses/${warehouseId}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
              >
                <Edit className="h-4 w-4" />
                Editar Almacén
              </button>
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
                      onClick={() => router.push(`/dashboard/admin/warehouses/${warehouseId}?tab=${tab.id}`)}
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
          {activeTab === 'dashboard' && <DashboardTab warehouse={warehouse} refreshKey={refreshKey} />}
          {activeTab === 'recepcion' && <RecepcionTab warehouse={warehouse} />}
          {activeTab === 'gestion-bultos' && <GestionBultosTab warehouse={warehouse} onRefresh={fetchWarehouse} />}
          {activeTab === 'empaques' && <EmpaquesTab warehouse={warehouse} />}
          {activeTab === 'bultos' && <BultosTab warehouse={warehouse} />}
        </div>
      </div>
    </DashboardLayout>
  )
}
