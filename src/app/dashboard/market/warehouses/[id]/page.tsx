'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Warehouse,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  User,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  Edit,
  Package,
  Box,
  TrendingUp,
  Calendar,
  Building,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WarehouseData {
  id: number
  code: string
  name: string
  isCentral: boolean
  warehouseType: string
  address: string
  city: string
  state: string
  municipality: string
  country: string
  latitude: number | null
  longitude: number | null
  managerName: string
  phone: string
  email: string
  isActive: boolean
  allowNegativeStock: boolean
  productsCount: number
  totalStock: number
  createdAt: string
  updatedAt: string
}

const WAREHOUSE_TYPES: Record<string, { label: string; color: string }> = {
  storage: { label: 'Almacenaje', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  distribution: { label: 'Distribución', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  retail: { label: 'Punto de Venta', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
}

export default function WarehouseDetailPage() {
  const { theme } = useTheme()
  const params = useParams()
  const router = useRouter()
  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const response = await fetch(`/api/market/warehouses/${params.id}`)
        const data = await response.json()

        if (data.success) {
          setWarehouse(data.data)
        } else {
          setError(data.error || 'Error al cargar el almacén')
        }
      } catch (err) {
        console.error('Error fetching warehouse:', err)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchWarehouse()
    }
  }, [params.id])

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !warehouse) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Warehouse className="w-16 h-16 text-gray-400" />
            <p className="text-lg text-gray-500">{error || 'Almacén no encontrado'}</p>
            <Link href="/dashboard/market/warehouses">
              <button className="flex items-center gap-2 px-4 py-2 text-blue-500 hover:text-blue-600">
                <ArrowLeft className="w-4 h-4" />
                Volver a almacenes
              </button>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/warehouses">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border relative',
                    warehouse.isActive
                      ? theme === 'dark' ? 'bg-blue-900/30 border-blue-800/50' : 'bg-blue-50 border-blue-200'
                      : theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
                  )}>
                    <Warehouse className={cn(
                      'w-7 h-7',
                      warehouse.isActive
                        ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        : 'text-gray-400'
                    )} />
                    {warehouse.isCentral && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {warehouse.name}
                    </h1>
                    <p className="text-sm text-gray-500 font-mono">{warehouse.code}</p>
                  </div>
                </div>
              </div>
              <Link href={`/dashboard/market/warehouses/${warehouse.id}/edit`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </motion.button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Products Count */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl p-6'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                  )}>
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Productos</p>
                    <p className="text-2xl font-bold">{warehouse.productsCount}</p>
                  </div>
                </div>
              </motion.div>

              {/* Total Stock */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl p-6'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                  )}>
                    <Box className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Stock Total</p>
                    <p className="text-2xl font-bold">{warehouse.totalStock.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>

              {/* Warehouse Type */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl p-6'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'
                  )}>
                    <Building className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipo</p>
                    <span className={cn(
                      "text-sm px-2.5 py-1 rounded-full font-medium",
                      WAREHOUSE_TYPES[warehouse.warehouseType]?.color || 'bg-gray-100 text-gray-600'
                    )}>
                      {WAREHOUSE_TYPES[warehouse.warehouseType]?.label || warehouse.warehouseType}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl p-6'
                )}
              >
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1",
                  warehouse.isActive ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'
                )}></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    warehouse.isActive
                      ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                      : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'
                  )}>
                    {warehouse.isActive ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <p className={cn(
                      'text-lg font-semibold',
                      warehouse.isActive ? 'text-green-600' : 'text-red-600'
                    )}>
                      {warehouse.isActive ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Location Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Ubicación
                </h3>
                <div className="space-y-4">
                  {warehouse.address && (
                    <div>
                      <p className="text-sm text-gray-500">Dirección</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {warehouse.address}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {warehouse.city && (
                      <div>
                        <p className="text-sm text-gray-500">Ciudad</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.city}
                        </p>
                      </div>
                    )}
                    {warehouse.municipality && (
                      <div>
                        <p className="text-sm text-gray-500">Municipio</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.municipality}
                        </p>
                      </div>
                    )}
                    {warehouse.state && (
                      <div>
                        <p className="text-sm text-gray-500">Provincia</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.state}
                        </p>
                      </div>
                    )}
                    {warehouse.country && (
                      <div>
                        <p className="text-sm text-gray-500">País</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.country}
                        </p>
                      </div>
                    )}
                  </div>
                  {(warehouse.latitude && warehouse.longitude) && (
                    <div>
                      <p className="text-sm text-gray-500">Coordenadas</p>
                      <p className="font-mono text-sm">
                        {warehouse.latitude}, {warehouse.longitude}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Contact Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  Contacto
                </h3>
                <div className="space-y-4">
                  {warehouse.managerName && (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Encargado</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.managerName}
                        </p>
                      </div>
                    </div>
                  )}
                  {warehouse.phone && (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Phone className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Teléfono</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.phone}
                        </p>
                      </div>
                    </div>
                  )}
                  {warehouse.email && (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Mail className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Correo</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {warehouse.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Configuration */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-500" />
                  Configuración
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Almacén Central</span>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      warehouse.isCentral
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {warehouse.isCentral ? 'Sí' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Permitir Stock Negativo</span>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      warehouse.allowNegativeStock
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {warehouse.allowNegativeStock ? 'Sí' : 'No'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Dates */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Fechas
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Creado</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {new Date(warehouse.createdAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Última Actualización</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {new Date(warehouse.updatedAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
