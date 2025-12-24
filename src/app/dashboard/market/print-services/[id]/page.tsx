'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Printer,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  Copy,
  Key,
  FileText
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

interface PrintServicePrinter {
  id: number
  printerName: string
  printerId: string | null
  driverName: string | null
  printerType: string
  connectionType: string
  networkAddress: string | null
  isOnline: boolean
  isDefault: boolean
  supportsEscpos: boolean
  supportsRaw: boolean
  paperWidthMm: number | null
  dpi: number | null
  lastStatusCheck: string | null
  createdAt: string
  supportedDocumentTypes?: string[]
}

const ALL_DOCUMENT_TYPES = [
  { id: 'pos_receipt', label: 'Recibo POS', description: 'Recibos de punto de venta' },
  { id: 'purchase_invoice', label: 'Factura de Compra', description: 'Facturas de proveedores' },
  { id: 'sales_report', label: 'Reporte de Ventas', description: 'Reportes de ventas diarias' },
  { id: 'cash_register_report', label: 'Reporte de Caja', description: 'Arqueos y cierres de caja' },
  { id: 'inventory_count_report', label: 'Reporte de Conteo', description: 'Conteos de inventario' },
  { id: 'invoice', label: 'Factura', description: 'Facturas generales' },
  { id: 'product_label', label: 'Etiqueta Producto', description: 'Etiquetas de productos' },
  { id: 'shipping_label', label: 'Etiqueta Envío', description: 'Etiquetas de paquetes' }
]

const PRINTER_TYPES = [
  { id: 'thermal_80mm', label: 'Térmica 80mm', description: 'Impresora de recibos' },
  { id: 'label_4x6', label: 'Etiquetas 4x6', description: 'Impresora de etiquetas de envío' },
  { id: 'label_barcode', label: 'Código de Barras', description: 'Impresora de etiquetas pequeñas' },
  { id: 'standard', label: 'Estándar', description: 'Impresora de documentos' }
]

interface PrintJob {
  id: number
  jobNumber: string
  documentType: string
  status: string
  copies: number
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: 'pending' | 'active' | 'offline' | 'disabled'
  apiKey: string
  lastSeenAt: string | null
  lastIpAddress: string | null
  platform: string | null
  hostname: string | null
  version: string | null
  warehouseId: number | null
  warehouseName: string | null
  printers: PrintServicePrinter[]
  recentJobs: PrintJob[]
  createdAt: string
  updatedAt: string
}

export const dynamic = 'force-dynamic'

export default function MarketPrintServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const serviceId = parseInt(id)

  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  const [service, setService] = useState<PrintService | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'printers' | 'jobs'>('printers')
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [newCredentials, setNewCredentials] = useState<{ apiKey: string; apiSecret: string } | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  // Printer configuration modal state
  const [showPrinterConfigModal, setShowPrinterConfigModal] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState<PrintServicePrinter | null>(null)
  const [printerConfig, setPrinterConfig] = useState<{
    printerType: string
    supportedDocumentTypes: string[]
  }>({ printerType: 'standard', supportedDocumentTypes: [] })
  const [savingPrinter, setSavingPrinter] = useState(false)

  const fetchService = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/print/services/${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        const serviceData = data.data
        setService({
          id: serviceData.service.id,
          serviceCode: serviceData.service.serviceCode,
          serviceName: serviceData.service.serviceName,
          status: serviceData.service.status,
          apiKey: serviceData.service.apiKey,
          lastSeenAt: serviceData.service.lastSeenAt,
          lastIpAddress: serviceData.service.lastIpAddress,
          platform: serviceData.service.platform,
          hostname: serviceData.service.hostname,
          version: serviceData.service.version,
          warehouseId: serviceData.service.warehouseId,
          warehouseName: serviceData.service.warehouseName,
          printers: serviceData.printers || [],
          recentJobs: serviceData.recentJobs || [],
          createdAt: serviceData.service.createdAt,
          updatedAt: serviceData.service.updatedAt
        })
      } else if (response.status === 404) {
        showNotification('error', 'Error', 'Servicio no encontrado')
        router.push('/dashboard/market/print-services')
      } else {
        throw new Error('Failed to fetch')
      }
    } catch (error) {
      console.error('Error fetching service:', error)
      showNotification('error', 'Error', 'No se pudo cargar el servicio')
    } finally {
      setLoading(false)
    }
  }, [serviceId, router, showNotification])

  useEffect(() => {
    if (!isNaN(serviceId)) {
      fetchService()
    }
  }, [serviceId, fetchService])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchService, 30000)
    return () => clearInterval(interval)
  }, [fetchService])

  const handleRegenerateCredentials = async () => {
    setRegenerating(true)
    try {
      const response = await fetch(`/api/print/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateCredentials: true })
      })

      const data = await response.json()

      if (response.ok && data.success && data.data) {
        setNewCredentials(data.data)
        showNotification('success', 'Regenerado', 'Credenciales regeneradas correctamente')
        fetchService()
      } else {
        throw new Error(data.error || 'Error al regenerar')
      }
    } catch (error) {
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Error al regenerar credenciales')
    } finally {
      setRegenerating(false)
      setShowRegenerateModal(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', `${label} copiado al portapapeles`)
  }

  const openPrinterConfig = (printer: PrintServicePrinter) => {
    setSelectedPrinter(printer)
    setPrinterConfig({
      printerType: printer.printerType || 'standard',
      supportedDocumentTypes: printer.supportedDocumentTypes || ALL_DOCUMENT_TYPES.map(t => t.id)
    })
    setShowPrinterConfigModal(true)
  }

  const handleSavePrinterConfig = async () => {
    if (!selectedPrinter || !service) return

    setSavingPrinter(true)
    try {
      const response = await fetch(`/api/print/services/${service.id}/printers/${selectedPrinter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerType: printerConfig.printerType,
          supportedDocumentTypes: printerConfig.supportedDocumentTypes
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        showNotification('success', 'Guardado', 'Configuración de impresora actualizada')
        setShowPrinterConfigModal(false)
        fetchService()
      } else {
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (error) {
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Error al guardar configuración')
    } finally {
      setSavingPrinter(false)
    }
  }

  const toggleDocumentType = (docType: string) => {
    setPrinterConfig(prev => ({
      ...prev,
      supportedDocumentTypes: prev.supportedDocumentTypes.includes(docType)
        ? prev.supportedDocumentTypes.filter(t => t !== docType)
        : [...prev.supportedDocumentTypes, docType]
    }))
  }

  const getStatusBadge = (status: string, lastSeenAt: string | null) => {
    const isRecentlyActive = lastSeenAt && (Date.now() - new Date(lastSeenAt).getTime()) < 2 * 60 * 1000

    if (status === 'active' && isRecentlyActive) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          En línea
        </span>
      )
    } else if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4" />
          Sin respuesta
        </span>
      )
    } else if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Clock className="w-4 h-4" />
          Pendiente conexión
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-4 h-4" />
          {status === 'disabled' ? 'Deshabilitado' : 'Desconectado'}
        </span>
      )
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completado</span>
      case 'failed':
        return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Fallido</span>
      case 'printing':
        return <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Imprimiendo</span>
      case 'sent':
        return <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Enviado</span>
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Pendiente</span>
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <LoadingBox text="Cargando servicio..." />
        </div>
      </DashboardLayout>
    )
  }

  if (!service) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Servicio no encontrado</p>
          <Button variant="outline" onClick={() => router.push('/dashboard/market/print-services')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/market/print-services')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {service.serviceName}
                </h1>
                {getStatusBadge(service.status, service.lastSeenAt)}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {service.serviceCode}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchService}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Service Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Connection Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Información de Conexión</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Hostname:</span>
                <span className="font-mono text-gray-900 dark:text-white">{service.hostname || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">IP:</span>
                <span className="font-mono text-gray-900 dark:text-white">{service.lastIpAddress || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Plataforma:</span>
                <span className="capitalize text-gray-900 dark:text-white">{service.platform || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Versión:</span>
                <span className="text-gray-900 dark:text-white">{service.version ? `v${service.version}` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Última conexión:</span>
                <span className="text-gray-900 dark:text-white">{formatDate(service.lastSeenAt)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Estadísticas</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Impresoras:</span>
                <span className="text-gray-900 dark:text-white">{service.printers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">En línea:</span>
                <span className="text-green-600">{service.printers?.filter(p => p.isOnline).length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Trabajos recientes:</span>
                <span className="text-gray-900 dark:text-white">{service.recentJobs?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Creado:</span>
                <span className="text-gray-900 dark:text-white">{formatDate(service.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* API Credentials */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Credenciales API
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">API Key</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={service.apiKey}
                    readOnly
                    className="flex-1 px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                  />
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(service.apiKey, 'API Key')}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowRegenerateModal(true)}
              >
                Regenerar Credenciales
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('printers')}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'printers'
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              )}
            >
              <Printer className="w-4 h-4 inline mr-2" />
              Impresoras ({service.printers?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'jobs'
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              )}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Trabajos Recientes ({service.recentJobs?.length || 0})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'printers' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {service.printers && service.printers.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impresora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conexión</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Documentos</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {service.printers.map((printer) => (
                    <tr key={printer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{printer.printerName}</p>
                          {printer.driverName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{printer.driverName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                        {printer.printerType?.replace('_', ' ') || 'Sin configurar'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <span className="capitalize">{printer.connectionType}</span>
                        {printer.networkAddress && (
                          <span className="text-xs text-gray-400 ml-1">({printer.networkAddress})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {printer.isOnline ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <Wifi className="w-3 h-3" /> En línea
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <WifiOff className="w-3 h-3" /> Offline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {printer.supportedDocumentTypes && printer.supportedDocumentTypes.length > 0 ? (
                            printer.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length ? (
                              <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                Todos ({printer.supportedDocumentTypes.length})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {printer.supportedDocumentTypes.length} tipos
                              </span>
                            )
                          ) : (
                            <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                              Sin configurar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPrinterConfig(printer)}
                          className="gap-1"
                        >
                          <Settings className="w-3 h-3" />
                          Configurar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Printer className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay impresoras registradas
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Las impresoras se detectan automáticamente cuando el servicio se conecta
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {service.recentJobs && service.recentJobs.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trabajo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Copias</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {service.recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono text-gray-900 dark:text-white">{job.jobNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                        {job.documentType.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {job.copies}
                      </td>
                      <td className="px-4 py-3">
                        {getJobStatusBadge(job.status)}
                        {job.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={job.errorMessage}>
                            {job.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(job.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay trabajos recientes
                </p>
              </div>
            )}
          </div>
        )}

        {/* Regenerate Credentials Modal */}
        {showRegenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Regenerar Credenciales
              </h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Advertencia:</strong> Al regenerar las credenciales, el servicio Electron actual dejará de funcionar hasta que se configure con las nuevas credenciales.
                </p>
              </div>

              {newCredentials ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva API Key</label>
                    <div className="flex gap-2">
                      <input type="text" value={newCredentials.apiKey} readOnly className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-lg" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(newCredentials.apiKey, 'API Key')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nuevo API Secret</label>
                    <div className="flex gap-2">
                      <input type="text" value={newCredentials.apiSecret} readOnly className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-lg" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(newCredentials.apiSecret, 'API Secret')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => {
                    setShowRegenerateModal(false)
                    setNewCredentials(null)
                  }}>
                    Cerrar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowRegenerateModal(false)} disabled={regenerating}>
                    Cancelar
                  </Button>
                  <Button onClick={handleRegenerateCredentials} disabled={regenerating}>
                    {regenerating ? 'Regenerando...' : 'Confirmar'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Printer Configuration Modal */}
        {showPrinterConfigModal && selectedPrinter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Configurar Impresora
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {selectedPrinter.printerName}
              </p>

              {/* Printer Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Impresora
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRINTER_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setPrinterConfig(prev => ({ ...prev, printerType: type.id }))}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        printerConfig.printerType === type.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      )}
                    >
                      <p className={cn(
                        "text-sm font-medium",
                        printerConfig.printerType === type.id
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-900 dark:text-white"
                      )}>
                        {type.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Supported Document Types */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Documentos Soportados
                  </label>
                  <button
                    onClick={() => setPrinterConfig(prev => ({
                      ...prev,
                      supportedDocumentTypes: prev.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                        ? []
                        : ALL_DOCUMENT_TYPES.map(t => t.id)
                    }))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {printerConfig.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {ALL_DOCUMENT_TYPES.map(docType => (
                    <label
                      key={docType.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        printerConfig.supportedDocumentTypes.includes(docType.id)
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={printerConfig.supportedDocumentTypes.includes(docType.id)}
                        onChange={() => toggleDocumentType(docType.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {docType.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {docType.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setShowPrinterConfigModal(false)}
                  disabled={savingPrinter}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePrinterConfig}
                  disabled={savingPrinter || printerConfig.supportedDocumentTypes.length === 0}
                >
                  {savingPrinter ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
