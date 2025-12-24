'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Printer,
  Plus,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Settings,
  Trash2,
  Copy,
  Wifi,
  WifiOff,
  Server,
  Key,
  Download,
  Monitor
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

interface PrintServicePrinter {
  id: number
  printerName: string
  printerType: string
  isOnline: boolean
  connectionType: string
  paperWidthMm?: number
}

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: 'pending' | 'active' | 'offline' | 'disabled'
  lastSeenAt: string | null
  lastIpAddress: string | null
  platform: string | null
  hostname: string | null
  version: string | null
  warehouseId: number | null
  warehouseName: string | null
  printers: PrintServicePrinter[]
  pendingJobs: number
  createdAt: string
}

interface Warehouse {
  id: number
  name: string
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function MarketPrintServicesPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  const [services, setServices] = useState<PrintService[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [newCredentials, setNewCredentials] = useState<{ apiKey: string; apiSecret: string } | null>(null)
  const [creating, setCreating] = useState(false)

  // Form state
  const [newService, setNewService] = useState({
    serviceName: '',
    warehouseId: ''
  })

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/print/services?${params}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.data?.services || [])
      } else {
        throw new Error('Failed to fetch')
      }
    } catch (error) {
      console.error('Error fetching print services:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los servicios de impresión')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter, showNotification])

  const fetchWarehouses = useCallback(async () => {
    try {
      const response = await fetch('/api/warehouses?limit=100')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data.data?.warehouses || data.data || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }, [])

  useEffect(() => {
    fetchServices()
    fetchWarehouses()
  }, [fetchServices, fetchWarehouses])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchServices, 30000)
    return () => clearInterval(interval)
  }, [fetchServices])

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newService.serviceName.trim()) {
      showNotification('error', 'Error', 'El nombre del servicio es requerido')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/print/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: newService.serviceName,
          warehouseId: newService.warehouseId ? parseInt(newService.warehouseId) : undefined
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Save credentials to show in modal
        setNewCredentials({
          apiKey: data.data.apiKey,
          apiSecret: data.data.apiSecret
        })
        setShowCreateModal(false)
        setShowCredentialsModal(true)
        setNewService({ serviceName: '', warehouseId: '' })
        fetchServices()
        showNotification('success', 'Creado', 'Servicio de impresión creado correctamente')
      } else {
        throw new Error(data.error || 'Error al crear')
      }
    } catch (error) {
      console.error('Error creating service:', error)
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Error al crear servicio')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteService = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el servicio "${name}"? Esta acción no se puede deshacer.`)) return

    try {
      const response = await fetch(`/api/print/services/${id}`, { method: 'DELETE' })
      if (response.ok) {
        showNotification('success', 'Eliminado', 'Servicio eliminado correctamente')
        fetchServices()
      } else {
        throw new Error('Failed to delete')
      }
    } catch {
      showNotification('error', 'Error', 'No se pudo eliminar el servicio')
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', `${label} copiado al portapapeles`)
  }

  const getStatusBadge = (status: string, lastSeenAt: string | null) => {
    // Check if service is really online (seen within 2 minutes)
    const isRecentlyActive = lastSeenAt && (Date.now() - new Date(lastSeenAt).getTime()) < 2 * 60 * 1000

    if (status === 'active' && isRecentlyActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          En línea
        </span>
      )
    } else if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="w-3 h-3" />
          Sin respuesta
        </span>
      )
    } else if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Clock className="w-3 h-3" />
          Pendiente
        </span>
      )
    } else if (status === 'disabled') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
          <XCircle className="w-3 h-3" />
          Deshabilitado
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <WifiOff className="w-3 h-3" />
          Desconectado
        </span>
      )
    }
  }

  const formatLastSeen = (date: string | null) => {
    if (!date) return 'Nunca'
    const d = new Date(date)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'Hace menos de 1 min'
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Printer className="w-7 h-7" />
              Servicios de Impresión
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configura impresoras para tu POS: recibos térmicos, etiquetas de productos y más
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchServices}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Servicio
            </Button>
          </div>
        </div>

        {/* Info Card - How to install */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Monitor className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Impresión silenciosa para tu Punto de Venta
              </h3>
              <ol className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                <li>Crea un servicio de impresión para cada terminal o ubicación</li>
                <li>Descarga e instala la aplicación LogiRapid Print Service</li>
                <li>Configura las credenciales API generadas en la aplicación</li>
                <li>Las impresoras se detectarán automáticamente</li>
                <li>Configura qué impresora usar para recibos POS y etiquetas</li>
              </ol>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                La impresión silenciosa permite imprimir recibos directamente sin diálogos de impresión
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar servicios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">Todos los estados</option>
            <option value="active">En línea</option>
            <option value="pending">Pendiente</option>
            <option value="offline">Desconectado</option>
            <option value="disabled">Deshabilitado</option>
          </select>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingBox text="Cargando servicios..." />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Server className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay servicios de impresión
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Crea un servicio para imprimir recibos POS y etiquetas automáticamente
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Servicio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      service.status === 'active' ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"
                    )}>
                      <Printer className={cn(
                        "w-5 h-5",
                        service.status === 'active' ? "text-green-600" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {service.serviceName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {service.serviceCode}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(service.status, service.lastSeenAt)}
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm mb-4">
                  {service.hostname && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Host:</span>
                      <span className="font-mono text-xs">{service.hostname}</span>
                    </div>
                  )}
                  {service.platform && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Plataforma:</span>
                      <span className="capitalize">{service.platform}</span>
                    </div>
                  )}
                  {service.version && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Versión:</span>
                      <span>v{service.version}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Última conexión:</span>
                    <span>{formatLastSeen(service.lastSeenAt)}</span>
                  </div>
                  {service.warehouseName && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Almacén:</span>
                      <span>{service.warehouseName}</span>
                    </div>
                  )}
                </div>

                {/* Printers */}
                {service.printers && service.printers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Impresoras ({service.printers.length})
                    </p>
                    <div className="space-y-1">
                      {service.printers.slice(0, 3).map((printer) => (
                        <div
                          key={printer.id}
                          className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1"
                        >
                          <span className="truncate">{printer.printerName}</span>
                          {printer.isOnline ? (
                            <Wifi className="w-3 h-3 text-green-500 flex-shrink-0" />
                          ) : (
                            <WifiOff className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                      {service.printers.length > 3 && (
                        <p className="text-xs text-gray-400 text-center">
                          +{service.printers.length - 3} más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending jobs badge */}
                {service.pendingJobs > 0 && (
                  <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      {service.pendingJobs} trabajo{service.pendingJobs !== 1 ? 's' : ''} pendiente{service.pendingJobs !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/dashboard/market/print-services/${service.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/dashboard/market/print-services/${service.id}`)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Config
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleDeleteService(service.id, service.serviceName)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Server className="w-5 h-5" />
                Nuevo Servicio de Impresión
              </h2>
              <form onSubmit={handleCreateService} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del servicio *
                  </label>
                  <input
                    type="text"
                    value={newService.serviceName}
                    onChange={(e) => setNewService({ ...newService, serviceName: e.target.value })}
                    placeholder="ej: Impresora POS Terminal 1"
                    className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                {warehouses.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Almacén (opcional)
                    </label>
                    <select
                      value={newService.warehouseId}
                      onChange={(e) => setNewService({ ...newService, warehouseId: e.target.value })}
                      className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Sin almacén específico</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Asociar a un almacén permite configurar impresoras por ubicación
                    </p>
                  </div>
                )}
                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear Servicio'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {showCredentialsModal && newCredentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Credenciales del Servicio
                </h2>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Importante:</strong> Guarda estas credenciales ahora. El API Secret no se mostrará de nuevo.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCredentials.apiKey}
                      readOnly
                      className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(newCredentials.apiKey, 'API Key')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Secret
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCredentials.apiSecret}
                      readOnly
                      className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(newCredentials.apiSecret, 'API Secret')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Formato para Authorization Header
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={`Bearer ${newCredentials.apiKey}:${newCredentials.apiSecret}`}
                      readOnly
                      className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`Bearer ${newCredentials.apiKey}:${newCredentials.apiSecret}`, 'Authorization')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button onClick={() => {
                  setShowCredentialsModal(false)
                  setNewCredentials(null)
                }}>
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
