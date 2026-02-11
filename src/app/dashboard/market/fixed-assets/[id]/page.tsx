'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Edit,
  Printer,
  Trash2,
  Box,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Barcode,
  History,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  Save,
  X,
  ArrowRight,
  ClipboardCheck
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface FixedAsset {
  id: number
  companyId: number
  assetCode: string
  barcode: string
  name: string
  description: string
  categoryId: number
  categoryName: string
  categoryCode: string
  assetType: string
  warehouseId: number
  warehouseName: string
  locationCode: string
  responsibleEmployeeId: number
  responsibleName: string
  responsiblePosition: string
  acquisitionDate: string
  acquisitionCost: number
  currency: string
  currentValue: number
  supplierId: number
  supplierName: string
  invoiceNumber: string
  serialNumber: string
  brand: string
  model: string
  status: string
  condition: string
  lastAuditDate: string
  lastAuditByName: string
  notes: string
  imageUrl: string
  createdBy: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

interface Movement {
  id: number
  movementType: string
  fromWarehouseId: number
  fromWarehouseName: string
  toWarehouseId: number
  toWarehouseName: string
  fromLocation: string
  toLocation: string
  fromResponsibleId: number
  fromResponsibleName: string
  toResponsibleId: number
  toResponsibleName: string
  fromStatus: string
  toStatus: string
  reason: string
  createdByName: string
  createdAt: string
}

interface AuditRecord {
  id: number
  auditNumber: string
  auditDate: string
  scanStatus: string
  foundLocation: string
  observedCondition: string
  scannedAt: string
  scannedByName: string
  notes: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Activo', color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: CheckCircle2 },
  in_repair: { label: 'En Reparación', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: Wrench },
  disposed: { label: 'Dado de Baja', color: 'text-gray-500 bg-gray-500/10 border-gray-500/30', icon: Trash2 },
  lost: { label: 'Perdido', color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: AlertTriangle }
}

const MOVEMENT_TYPES: Record<string, { label: string; icon: React.ElementType }> = {
  creation: { label: 'Registro inicial', icon: Box },
  transfer: { label: 'Transferencia', icon: ArrowRight },
  assignment: { label: 'Cambio de responsable', icon: User },
  status_change: { label: 'Cambio de estado', icon: AlertTriangle },
  repair: { label: 'Enviado a reparación', icon: Wrench },
  disposal: { label: 'Dado de baja', icon: Trash2 }
}

export default function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [asset, setAsset] = useState<FixedAsset | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [audits, setAudits] = useState<AuditRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'audits'>('details')

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [serviceCode, setServiceCode] = useState('')

  const fetchAsset = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/market/fixed-assets/${resolvedParams.id}`)
      const data = await res.json()

      if (data.success) {
        setAsset(data.data.asset)
        setMovements(data.data.movements || [])
        setAudits(data.data.audits || [])
      } else {
        setError(data.error || 'Error al cargar el activo')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    fetchAsset()
  }, [fetchAsset])

  const deleteAsset = async () => {
    if (!confirm('¿Dar de baja este activo? El activo quedará marcado como "disposed".')) return

    try {
      const res = await fetch(`/api/market/fixed-assets/${resolvedParams.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Dado de baja por usuario' })
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Activo dado de baja', 'El activo ha sido marcado como dado de baja')
        router.push('/dashboard/market/fixed-assets')
      } else {
        showNotification('error', 'Error', data.error || 'Error al dar de baja')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo completar la operación')
    }
  }

  const handlePrint = async () => {
    if (!serviceCode.trim()) {
      showNotification('error', 'Error', 'Debe ingresar el código del servicio de impresión')
      return
    }

    setPrintLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/${resolvedParams.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCode,
          copies: 1
        })
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Etiqueta enviada', `Trabajo de impresión ${data.data.jobNumber} creado`)
        setShowPrintModal(false)
        setServiceCode('')
      } else {
        showNotification('error', 'Error', data.error || 'Error al imprimir')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo enviar la impresión')
    } finally {
      setPrintLoading(false)
    }
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES')
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !asset) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              "max-w-2xl mx-auto p-8 rounded-xl text-center",
              theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            )}>
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg">{error || 'Activo no encontrado'}</p>
              <Link
                href="/dashboard/market/fixed-assets"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al listado
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active
  const StatusIcon = statusConfig.icon

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-4">
                <Link
                  href="/dashboard/market/fixed-assets"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )} />
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {asset.name}
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {asset.assetCode}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
                <Link
                  href={`/dashboard/market/fixed-assets/${asset.id}/edit`}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    "bg-blue-500 hover:bg-blue-600 text-white"
                  )}
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Link>
                {asset.status !== 'disposed' && (
                  <button
                    onClick={deleteAsset}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                      "bg-red-500 hover:bg-red-600 text-white"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                    Dar de Baja
                  </button>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              statusConfig.color
            )}>
              <StatusIcon className="w-6 h-6" />
              <div>
                <p className="font-semibold">{statusConfig.label}</p>
                <p className="text-sm opacity-80">
                  Última actualización: {formatDateTime(asset.updatedAt)}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn(
              "flex border-b",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              {[
                { key: 'details', label: 'Detalles', icon: Box },
                { key: 'history', label: 'Historial', icon: History },
                { key: 'audits', label: 'Auditorías', icon: ClipboardCheck }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-500'
                      : cn(
                          'border-transparent',
                          theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                        )
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <h3 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <Box className="w-5 h-5 text-blue-500" />
                    Información Básica
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Código</dt>
                      <dd className={cn("font-mono", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.assetCode}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Barcode</dt>
                      <dd className={cn("font-mono", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.barcode}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Categoría</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.categoryName || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Condición</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {asset.condition === 'new' ? 'Nuevo' :
                         asset.condition === 'good' ? 'Bueno' :
                         asset.condition === 'fair' ? 'Regular' : 'Malo'}
                      </dd>
                    </div>
                    {asset.description && (
                      <div>
                        <dt className={cn("text-sm mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Descripción</dt>
                        <dd className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{asset.description}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Location */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <h3 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <MapPin className="w-5 h-5 text-green-500" />
                    Ubicación
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Almacén</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.warehouseName || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Ubicación específica</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.locationCode || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Responsable</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.responsibleName || '-'}</dd>
                    </div>
                  </dl>
                </div>

                {/* Financial */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <h3 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <DollarSign className="w-5 h-5 text-yellow-500" />
                    Información Financiera
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fecha adquisición</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(asset.acquisitionDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Costo adquisición</dt>
                      <dd className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(asset.acquisitionCost, asset.currency)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Valor actual</dt>
                      <dd className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(asset.currentValue || asset.acquisitionCost, asset.currency)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Proveedor</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.supplierName || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Factura</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.invoiceNumber || '-'}</dd>
                    </div>
                  </dl>
                </div>

                {/* Technical */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <h3 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <Barcode className="w-5 h-5 text-purple-500" />
                    Información Técnica
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Número de serie</dt>
                      <dd className={cn("font-mono", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.serialNumber || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Marca</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.brand || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Modelo</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{asset.model || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Última auditoría</dt>
                      <dd className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(asset.lastAuditDate)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className={cn(
                "rounded-xl overflow-hidden",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                {movements.length === 0 ? (
                  <div className="p-8 text-center">
                    <History className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      No hay movimientos registrados
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {movements.map((mov, idx) => {
                      const movType = MOVEMENT_TYPES[mov.movementType] || MOVEMENT_TYPES.status_change
                      const MovIcon = movType.icon

                      return (
                        <div key={mov.id} className={cn(
                          "p-4 flex gap-4",
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        )}>
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <MovIcon className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                          </div>
                          <div className="flex-1">
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {movType.label}
                            </p>
                            {mov.reason && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                {mov.reason}
                              </p>
                            )}
                            {(mov.fromWarehouseName || mov.toWarehouseName) && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                {mov.fromWarehouseName || 'Sin ubicación'} → {mov.toWarehouseName || 'Sin ubicación'}
                              </p>
                            )}
                            {(mov.fromResponsibleName || mov.toResponsibleName) && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                {mov.fromResponsibleName || 'Sin responsable'} → {mov.toResponsibleName || 'Sin responsable'}
                              </p>
                            )}
                            {(mov.fromStatus || mov.toStatus) && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                Estado: {mov.fromStatus} → {mov.toStatus}
                              </p>
                            )}
                            <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              {formatDateTime(mov.createdAt)} • {mov.createdByName}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audits' && (
              <div className={cn(
                "rounded-xl overflow-hidden",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                {audits.length === 0 ? (
                  <div className="p-8 text-center">
                    <ClipboardCheck className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      No hay registros de auditoría
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {audits.map(audit => (
                      <div key={audit.id} className={cn(
                        "p-4",
                        theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      )}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {audit.auditNumber}
                            </p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              Estado: {audit.scanStatus === 'found' ? '✓ Encontrado' : audit.scanStatus === 'missing' ? '✗ Faltante' : audit.scanStatus}
                            </p>
                            {audit.foundLocation && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                Ubicación encontrada: {audit.foundLocation}
                              </p>
                            )}
                            {audit.observedCondition && (
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                Condición observada: {audit.observedCondition}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {formatDate(audit.auditDate)}
                            </p>
                            <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              {audit.scannedByName}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Print Modal */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "w-full max-w-md p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Imprimir Etiqueta
                </h3>
                <button onClick={() => setShowPrintModal(false)}>
                  <X className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Código del Servicio de Impresión
                  </label>
                  <input
                    type="text"
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                    placeholder="Ej: PRINT-001"
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                <div className={cn(
                  "p-4 rounded-lg",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                )}>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Se imprimirá una etiqueta 2x1" con:
                  </p>
                  <ul className={cn("text-sm mt-2 space-y-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    <li>• Nombre: {asset.name}</li>
                    <li>• Código: {asset.assetCode}</li>
                    <li>• Código de barras: {asset.barcode}</li>
                    <li>• Ubicación: {asset.warehouseName || '-'}</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={printLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {printLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    Imprimir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
