'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  Search,
  Save,
  Check,
  XCircle,
  MapPin,
  Box,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Audit {
  id: number
  companyId: number
  auditNumber: string
  auditDate: string
  warehouseId: number
  warehouseName: string
  categoryId: number
  categoryName: string
  totalAssets: number
  assetsFound: number
  assetsMissing: number
  assetsSurplus: number
  status: string
  createdByName: string
  completedByName: string
  approvedByName: string
  createdAt: string
  completedAt: string
  approvedAt: string
  notes: string
}

interface ScannedItem {
  id: number
  assetId: number
  assetCode: string
  assetName: string
  scannedBarcode: string
  scanStatus: string
  registeredLocation: string
  registeredWarehouseName: string
  foundLocation: string
  foundWarehouseName: string
  observedCondition: string
  scannedByName: string
  scannedAt: string
  notes: string
}

interface PendingAsset {
  id: number
  assetCode: string
  barcode: string
  name: string
  warehouseId: number
  warehouseName: string
  locationCode: string
  status: string
  condition: string
  responsibleName: string
}

interface Summary {
  totalExpected: number
  found: number
  missing: number
  markedMissing: number
  surplus: number
  pending: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  in_progress: { label: 'En Progreso', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', icon: Clock },
  completed: { label: 'Completada', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle },
  approved: { label: 'Aprobada', color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: CheckCircle2 }
}

const SCAN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  found: { label: 'Encontrado', color: 'text-green-500 bg-green-500/10' },
  missing: { label: 'Faltante', color: 'text-red-500 bg-red-500/10' },
  surplus: { label: 'No registrado', color: 'text-yellow-500 bg-yellow-500/10' }
}

export default function FixedAssetAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [audit, setAudit] = useState<Audit | null>(null)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Scan mode
  const [scanMode, setScanMode] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Tab
  const [activeTab, setActiveTab] = useState<'scanned' | 'pending'>('pending')

  // Action loading
  const [actionLoading, setActionLoading] = useState(false)

  const fetchAudit = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/market/fixed-assets/audits/${resolvedParams.id}`)
      const data = await res.json()

      if (data.success) {
        setAudit(data.data.audit)
        setScannedItems(data.data.scannedItems || [])
        setPendingAssets(data.data.pendingAssets || [])
        setSummary(data.data.summary)
      } else {
        setError(data.error || 'Error al cargar la auditoría')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    fetchAudit()
  }, [fetchAudit])

  // Focus scan input when scan mode is activated
  useEffect(() => {
    if (scanMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scanMode])

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!scanInput.trim()) return

    setScanLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/audits/${resolvedParams.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: scanInput.trim()
        })
      })

      const data = await res.json()

      if (data.success) {
        const statusMsg = data.data.scanStatus === 'found'
          ? `${data.data.assetName || 'Activo'} encontrado`
          : data.data.scanStatus === 'surplus'
          ? 'Activo no registrado en el sistema'
          : 'Activo marcado como faltante'

        showNotification(
          data.data.scanStatus === 'found' ? 'success' : 'warning',
          statusMsg,
          ''
        )

        setScanInput('')
        fetchAudit()
      } else {
        showNotification('error', 'Error', data.error || 'Error al escanear')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setScanLoading(false)
      scanInputRef.current?.focus()
    }
  }

  const markAssetAsMissing = async (assetId: number) => {
    setScanLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/audits/${resolvedParams.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          markAs: 'missing'
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('info', 'Activo marcado como faltante', '')
        fetchAudit()
      } else {
        showNotification('error', 'Error', data.error || 'Error al marcar')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setScanLoading(false)
    }
  }

  const completeAudit = async () => {
    if (!confirm('¿Completar la auditoría? Los activos no escaneados serán marcados como faltantes.')) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/audits/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Auditoría completada', '')
        fetchAudit()
      } else {
        showNotification('error', 'Error', data.error || 'Error al completar')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setActionLoading(false)
    }
  }

  const approveAudit = async () => {
    if (!confirm('¿Aprobar la auditoría? Los activos faltantes serán marcados como perdidos.')) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/audits/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Auditoría aprobada', `${data.data.lostAssetsCount} activos marcados como perdidos`)
        fetchAudit()
      } else {
        showNotification('error', 'Error', data.error || 'Error al aprobar')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setActionLoading(false)
    }
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

  if (error || !audit) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              "max-w-2xl mx-auto p-8 rounded-xl text-center",
              theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            )}>
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg">{error || 'Auditoría no encontrada'}</p>
              <Link
                href="/dashboard/market/fixed-assets/audits"
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

  const statusConfig = STATUS_CONFIG[audit.status] || STATUS_CONFIG.in_progress
  const StatusIcon = statusConfig.icon

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-4">
                <Link
                  href="/dashboard/market/fixed-assets/audits"
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
                    {audit.auditNumber}
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {formatDate(audit.auditDate)} • {audit.warehouseName || 'Todos los almacenes'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchAudit}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                </button>
                {audit.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => setScanMode(!scanMode)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        scanMode
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      )}
                    >
                      <Scan className="w-5 h-5" />
                      {scanMode ? 'Escaneando...' : 'Escanear'}
                    </button>
                    <button
                      onClick={completeAudit}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Completar
                    </button>
                  </>
                )}
                {audit.status === 'completed' && (
                  <button
                    onClick={approveAudit}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Aprobar
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
              <div className="flex-1">
                <p className="font-semibold">{statusConfig.label}</p>
                <p className="text-sm opacity-80">Creado por {audit.createdByName}</p>
              </div>
            </div>

            {/* Scan Input */}
            {scanMode && audit.status === 'in_progress' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl border-2 border-dashed",
                  theme === 'dark' ? 'border-green-500/50 bg-green-900/20' : 'border-green-500/50 bg-green-50'
                )}
              >
                <form onSubmit={handleScan} className="flex gap-2">
                  <div className="relative flex-1">
                    <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Escanee o ingrese el código de barras..."
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-lg border-2 focus:outline-none focus:border-green-500",
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={scanLoading || !scanInput.trim()}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {scanLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode(false)}
                    className={cn(
                      "px-4 py-3 rounded-lg",
                      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </form>
              </motion.div>
            )}

            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className={cn(
                  "p-4 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total Esperado</p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {summary.totalExpected}
                  </p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Encontrados</p>
                  <p className="text-2xl font-bold text-green-500">{summary.found}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Pendientes</p>
                  <p className="text-2xl font-bold text-blue-500">{summary.pending}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Faltantes</p>
                  <p className="text-2xl font-bold text-red-500">{summary.markedMissing}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
                )}>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No Registrados</p>
                  <p className="text-2xl font-bold text-yellow-500">{summary.surplus}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className={cn(
              "flex border-b",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <button
                onClick={() => setActiveTab('pending')}
                className={cn(
                  "px-4 py-3 border-b-2 transition-colors",
                  activeTab === 'pending'
                    ? 'border-blue-500 text-blue-500'
                    : cn('border-transparent', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                )}
              >
                Pendientes ({pendingAssets.length})
              </button>
              <button
                onClick={() => setActiveTab('scanned')}
                className={cn(
                  "px-4 py-3 border-b-2 transition-colors",
                  activeTab === 'scanned'
                    ? 'border-blue-500 text-blue-500'
                    : cn('border-transparent', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                )}
              >
                Escaneados ({scannedItems.length})
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'pending' && (
              <div className={cn(
                "rounded-xl overflow-hidden border",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                {pendingAssets.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Todos los activos han sido verificados
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={cn(theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                        <tr>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Activo</th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Código</th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Ubicación</th>
                          <th className={cn(
                            "px-4 py-3 text-right text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody className={cn(
                        "divide-y",
                        theme === 'dark' ? 'divide-gray-700 bg-gray-800/30' : 'divide-gray-200 bg-white'
                      )}>
                        {pendingAssets.map(asset => (
                          <tr key={asset.id} className={cn(
                            theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                          )}>
                            <td className="px-4 py-3">
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {asset.name}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className={cn("font-mono text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {asset.assetCode}
                              </p>
                              <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                {asset.barcode}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <MapPin className={cn("w-3 h-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                  {asset.warehouseName || '-'}
                                  {asset.locationCode && ` / ${asset.locationCode}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {audit.status === 'in_progress' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setScanInput(asset.barcode)
                                        setScanMode(true)
                                      }}
                                      className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => markAssetAsMissing(asset.id)}
                                      className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'scanned' && (
              <div className={cn(
                "rounded-xl overflow-hidden border",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                {scannedItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <Scan className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      No hay activos escaneados
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={cn(theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                        <tr>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Activo</th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Código Escaneado</th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Estado</th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Fecha</th>
                        </tr>
                      </thead>
                      <tbody className={cn(
                        "divide-y",
                        theme === 'dark' ? 'divide-gray-700 bg-gray-800/30' : 'divide-gray-200 bg-white'
                      )}>
                        {scannedItems.map(item => {
                          const scanConfig = SCAN_STATUS_CONFIG[item.scanStatus] || SCAN_STATUS_CONFIG.found

                          return (
                            <tr key={item.id} className={cn(
                              theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                            )}>
                              <td className="px-4 py-3">
                                <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {item.assetName || 'No registrado'}
                                </p>
                                {item.assetCode && (
                                  <p className={cn("text-xs font-mono", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    {item.assetCode}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className={cn("font-mono text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                  {item.scannedBarcode}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                                  scanConfig.color
                                )}>
                                  {scanConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  {formatDateTime(item.scannedAt)}
                                </p>
                                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                  {item.scannedByName}
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
