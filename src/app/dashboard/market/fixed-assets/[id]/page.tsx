'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  CheckCircle2,
  AlertTriangle,
  Wrench,
  X,
  ArrowRight,
  ClipboardCheck,
  Building2,
  Hash,
  Package,
  TrendingDown,
  Clock,
  FileText,
  History,
  Tag,
  Layers,
  CircleDot,
  Check,
  Monitor
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import JsBarcode from 'jsbarcode'

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
  responsibleEmail?: string
  responsiblePhone?: string
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
  invoiceImageUrl: string
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

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: string
  printers: PrinterInfo[]
}

interface PrinterInfo {
  id: number
  printerName: string
  printerId: string
  printerType: string
  isOnline: boolean
  isDefault: boolean
  supportedDocumentTypes: string[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgGradient: string; icon: React.ElementType; step: number }> = {
  active: { label: 'Activo', color: 'emerald', bgGradient: 'from-emerald-500 to-teal-500', icon: CheckCircle2, step: 1 },
  in_repair: { label: 'En Reparacion', color: 'amber', bgGradient: 'from-amber-500 to-orange-500', icon: Wrench, step: 2 },
  disposed: { label: 'Dado de Baja', color: 'gray', bgGradient: 'from-gray-500 to-slate-500', icon: Trash2, step: 3 },
  lost: { label: 'Perdido', color: 'red', bgGradient: 'from-red-500 to-rose-500', icon: AlertTriangle, step: 0 }
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Malo'
}

const MOVEMENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  creation: { label: 'Registro inicial', icon: Box, color: 'blue' },
  transfer: { label: 'Transferencia', icon: ArrowRight, color: 'purple' },
  assignment: { label: 'Cambio de responsable', icon: User, color: 'cyan' },
  status_change: { label: 'Cambio de estado', icon: AlertTriangle, color: 'amber' },
  repair: { label: 'Enviado a reparacion', icon: Wrench, color: 'orange' },
  disposal: { label: 'Dado de baja', icon: Trash2, color: 'gray' },
  audit: { label: 'Auditoria', icon: ClipboardCheck, color: 'indigo' },
  label_printed: { label: 'Etiqueta impresa', icon: Printer, color: 'green' },
  edit: { label: 'Editado', icon: Edit, color: 'teal' }
}

const LIFECYCLE_STEPS = [
  { key: 'active', label: 'Activo', icon: CheckCircle2 },
  { key: 'in_repair', label: 'En Reparacion', icon: Wrench },
  { key: 'disposed', label: 'Dado de Baja', icon: Trash2 }
]

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

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [printServices, setPrintServices] = useState<PrintService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null)
  const [labelSize, setLabelSize] = useState<'3x2' | '2x1'>('3x2')
  const [copies, setCopies] = useState(1)

  // Barcode ref for preview
  const barcodeRef = useRef<SVGSVGElement>(null)

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
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    fetchAsset()
  }, [fetchAsset])

  // Generate barcode when asset is loaded
  useEffect(() => {
    if (asset?.barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, asset.barcode, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
          background: 'transparent',
          lineColor: theme === 'dark' ? '#e5e7eb' : '#1f2937'
        })
      } catch (e) {
        console.error('Error generating barcode:', e)
      }
    }
  }, [asset?.barcode, theme, showPrintModal])

  const fetchPrintServices = async () => {
    setLoadingServices(true)
    try {
      const res = await fetch('/api/print/services')
      const data = await res.json()
      if (data.success) {
        // Filter to show only active/online services with label-compatible printers
        const services = (data.data.services || []).filter((s: PrintService) =>
          s.status === 'active' || s.status === 'offline'
        )
        setPrintServices(services)

        // Auto-select first service with online printer
        const serviceWithOnline = services.find((s: PrintService) =>
          s.status === 'active' && s.printers.some(p => p.isOnline)
        )
        if (serviceWithOnline) {
          setSelectedServiceId(serviceWithOnline.id)
          const onlinePrinter = serviceWithOnline.printers.find((p: PrinterInfo) => p.isOnline && p.isDefault) ||
            serviceWithOnline.printers.find((p: PrinterInfo) => p.isOnline)
          if (onlinePrinter) {
            setSelectedPrinterId(onlinePrinter.id)
          }
        }
      }
    } catch {
      console.error('Error fetching print services')
    } finally {
      setLoadingServices(false)
    }
  }

  const deleteAsset = async () => {
    if (!confirm('Dar de baja este activo? El activo quedara marcado como "disposed".')) return

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
      showNotification('error', 'Error de conexion', 'No se pudo completar la operacion')
    }
  }

  const handleOpenPrintModal = () => {
    setShowPrintModal(true)
    fetchPrintServices()
  }

  const handlePrintWithService = async () => {
    if (!selectedServiceId || !selectedPrinterId) {
      showNotification('error', 'Error', 'Seleccione una impresora')
      return
    }

    setPrintLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/${resolvedParams.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printServiceId: selectedServiceId,
          printerId: selectedPrinterId,
          labelSize,
          copies
        })
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Etiqueta enviada', `Trabajo de impresion ${data.data.jobNumber} creado`)
        setShowPrintModal(false)
      } else {
        showNotification('error', 'Error', data.error || 'Error al imprimir')
      }
    } catch {
      showNotification('error', 'Error de conexion', 'No se pudo enviar la impresion')
    } finally {
      setPrintLoading(false)
    }
  }

  const handleBrowserPrint = () => {
    if (!asset) return

    // Create printable content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      showNotification('error', 'Error', 'No se pudo abrir la ventana de impresion')
      return
    }

    const is3x2 = labelSize === '3x2'
    const width = is3x2 ? '76mm' : '51mm'
    const height = is3x2 ? '51mm' : '25mm'

    // Generate barcode SVG
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, asset.barcode, {
      format: 'CODE128',
      width: is3x2 ? 2 : 1.5,
      height: is3x2 ? 35 : 20,
      displayValue: true,
      fontSize: is3x2 ? 10 : 8,
      margin: 2
    })
    const barcodeDataUrl = canvas.toDataURL('image/png')

    const location = asset.warehouseName
      ? `${asset.warehouseName}${asset.locationCode ? ` / ${asset.locationCode}` : ''}`
      : asset.locationCode || ''

    // Build extra info for 3x2 label
    const brandModel = [asset.brand, asset.model].filter(Boolean).join(' ')
    const categoryInfo = asset.categoryName || ''

    const htmlContent = is3x2 ? `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta ${asset.assetCode}</title>
        <style>
          @page { size: ${width} ${height}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; width: ${width}; height: ${height}; padding: 2mm; }
          .label { width: 100%; height: 100%; display: flex; flex-direction: column; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1mm; }
          .code { font-size: 14pt; font-family: monospace; font-weight: bold; letter-spacing: 0.5px; }
          .category { font-size: 7pt; color: #666; text-align: right; max-width: 50%; }
          .name { font-size: 10pt; font-weight: 600; line-height: 1.2; margin-bottom: 1mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
          .info { font-size: 7pt; color: #333; display: flex; justify-content: space-between; margin-bottom: 1mm; }
          .info-left { }
          .info-right { text-align: right; color: #666; }
          .barcode { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
          .barcode img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <div class="code">${asset.assetCode}</div>
            <div class="category">${categoryInfo}</div>
          </div>
          <div class="name">${asset.name}</div>
          <div class="info">
            <div class="info-left">${brandModel || ''}</div>
            <div class="info-right">${location}</div>
          </div>
          <div class="barcode">
            <img src="${barcodeDataUrl}" alt="barcode" />
          </div>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    ` : `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta ${asset.assetCode}</title>
        <style>
          @page { size: ${width} ${height}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; width: ${width}; height: ${height}; padding: 1mm; }
          .label { width: 100%; height: 100%; display: flex; flex-direction: column; }
          .top { display: flex; justify-content: space-between; align-items: center; }
          .code { font-size: 10pt; font-family: monospace; font-weight: bold; }
          .location { font-size: 6pt; color: #666; max-width: 45%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .name { font-size: 7pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
          .barcode { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
          .barcode img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="top">
            <div class="code">${asset.assetCode}</div>
            <div class="location">${location}</div>
          </div>
          <div class="name">${asset.name}</div>
          <div class="barcode">
            <img src="${barcodeDataUrl}" alt="barcode" />
          </div>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
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
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate depreciation
  const calculateDepreciation = () => {
    if (!asset) return { percent: 0, amount: 0 }
    const depreciation = asset.acquisitionCost - (asset.currentValue || asset.acquisitionCost)
    const percent = asset.acquisitionCost > 0 ? (depreciation / asset.acquisitionCost) * 100 : 0
    return { percent, amount: depreciation }
  }

  // Calculate age in months
  const calculateAge = () => {
    if (!asset?.acquisitionDate) return '-'
    const acquisition = new Date(asset.acquisitionDate)
    const now = new Date()
    const months = (now.getFullYear() - acquisition.getFullYear()) * 12 + (now.getMonth() - acquisition.getMonth())
    if (months < 12) return `${months} meses`
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    return remainingMonths > 0 ? `${years} años ${remainingMonths} meses` : `${years} años`
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
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
              "max-w-xl mx-auto p-8 rounded-2xl text-center",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'Activo no encontrado'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este activo.</p>
              <Link href="/dashboard/market/fixed-assets">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al listado
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active
  const StatusIcon = statusConfig.icon
  const depreciation = calculateDepreciation()

  // Get selected service and printer info
  const selectedService = printServices.find(s => s.id === selectedServiceId)
  const selectedPrinter = selectedService?.printers.find(p => p.id === selectedPrinterId)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/fixed-assets">
                <motion.button
                  whileHover={{ scale: 1.02, x: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-medium">Volver</span>
                </motion.button>
              </Link>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenPrintModal}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium">Imprimir</span>
                </motion.button>

                <Link href={`/dashboard/market/fixed-assets/${asset.id}/edit`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="font-medium">Editar</span>
                  </motion.button>
                </Link>

                {asset.status !== 'disposed' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={deleteAsset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">Dar de Baja</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Asset Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Asset Info */}
                <div className="flex items-start gap-4">
                  {asset.imageUrl ? (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
                      <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                      `bg-gradient-to-br ${statusConfig.bgGradient}`
                    )}>
                      <Box className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {asset.assetCode}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className={cn(
                      'text-lg font-medium mb-2',
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                    )}>{asset.name}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(asset.acquisitionDate)}
                      </span>
                      {asset.responsibleName && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          {asset.responsibleName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Value */}
                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Valor Actual</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatCurrency(asset.currentValue || asset.acquisitionCost, asset.currency)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'max-w-6xl mx-auto mb-6 p-6 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
            )}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={cn(
                'p-2 rounded-xl',
                theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'
              )}>
                <History className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>Historial de Actividad</h3>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className={cn(
                'absolute left-[17px] top-2 bottom-2 w-0.5',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />

              <div className="space-y-4">
                {/* Creation event */}
                <div className="flex items-start gap-4 relative">
                  <div className={cn(
                    'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                    theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'
                  )}>
                    <Box className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="pt-1">
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Activo registrado</p>
                    <p className="text-xs text-gray-500">
                      por {asset.createdByName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(asset.createdAt)}</p>
                  </div>
                </div>

                {/* Movement events */}
                {movements.map((mov) => {
                  const movConfig = MOVEMENT_CONFIG[mov.movementType] || MOVEMENT_CONFIG.status_change
                  const MovIcon = movConfig.icon

                  return (
                    <div key={mov.id} className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        movConfig.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'),
                        movConfig.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 ring-4 ring-gray-800' : 'bg-purple-100 ring-4 ring-white'),
                        movConfig.color === 'cyan' && (theme === 'dark' ? 'bg-cyan-900/50 ring-4 ring-gray-800' : 'bg-cyan-100 ring-4 ring-white'),
                        movConfig.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 ring-4 ring-gray-800' : 'bg-amber-100 ring-4 ring-white'),
                        movConfig.color === 'orange' && (theme === 'dark' ? 'bg-orange-900/50 ring-4 ring-gray-800' : 'bg-orange-100 ring-4 ring-white'),
                        movConfig.color === 'gray' && (theme === 'dark' ? 'bg-gray-700 ring-4 ring-gray-800' : 'bg-gray-100 ring-4 ring-white'),
                        movConfig.color === 'indigo' && (theme === 'dark' ? 'bg-indigo-900/50 ring-4 ring-gray-800' : 'bg-indigo-100 ring-4 ring-white'),
                        movConfig.color === 'green' && (theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'),
                        movConfig.color === 'teal' && (theme === 'dark' ? 'bg-teal-900/50 ring-4 ring-gray-800' : 'bg-teal-100 ring-4 ring-white')
                      )}>
                        <MovIcon className={cn(
                          'w-4 h-4',
                          movConfig.color === 'blue' && 'text-blue-500',
                          movConfig.color === 'purple' && 'text-purple-500',
                          movConfig.color === 'cyan' && 'text-cyan-500',
                          movConfig.color === 'amber' && 'text-amber-500',
                          movConfig.color === 'orange' && 'text-orange-500',
                          movConfig.color === 'gray' && 'text-gray-500',
                          movConfig.color === 'indigo' && 'text-indigo-500',
                          movConfig.color === 'green' && 'text-green-500',
                          movConfig.color === 'teal' && 'text-teal-500'
                        )} />
                      </div>
                      <div className="pt-1 flex-1">
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{movConfig.label}</p>
                        {mov.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">{mov.reason}</p>
                        )}
                        {(mov.fromWarehouseName || mov.toWarehouseName) && mov.movementType === 'transfer' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {mov.fromWarehouseName || 'Sin ubicacion'} → {mov.toWarehouseName || 'Sin ubicacion'}
                          </p>
                        )}
                        {(mov.fromResponsibleName || mov.toResponsibleName) && mov.movementType === 'assignment' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {mov.fromResponsibleName || 'Sin responsable'} → {mov.toResponsibleName || 'Sin responsable'}
                          </p>
                        )}
                        {(mov.fromStatus || mov.toStatus) && mov.movementType === 'status_change' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {STATUS_CONFIG[mov.fromStatus]?.label || mov.fromStatus} → {STATUS_CONFIG[mov.toStatus]?.label || mov.toStatus}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateTime(mov.createdAt)} {mov.createdByName && `• ${mov.createdByName}`}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* Audit events */}
                {audits.slice(0, 3).map((audit) => (
                  <div key={audit.id} className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      audit.scanStatus === 'found'
                        ? theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                        : theme === 'dark' ? 'bg-red-900/50 ring-4 ring-gray-800' : 'bg-red-100 ring-4 ring-white'
                    )}>
                      <ClipboardCheck className={cn(
                        'w-4 h-4',
                        audit.scanStatus === 'found' ? 'text-emerald-500' : 'text-red-500'
                      )} />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Auditoria {audit.auditNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {audit.scanStatus === 'found' ? 'Encontrado' : 'No encontrado'}
                        {audit.foundLocation && ` en ${audit.foundLocation}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDateTime(audit.scannedAt || audit.auditDate)} • {audit.scannedByName}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Show more indicator */}
                {(movements.length > 0 || audits.length > 3) && (
                  <div className="flex items-center gap-4 pl-[17px]">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500">
                      {movements.length + audits.length} eventos en total
                    </p>
                  </div>
                )}

                {/* Empty state */}
                {movements.length === 0 && audits.length === 0 && (
                  <div className="flex items-center gap-4 pl-[17px]">
                    <p className="text-sm text-gray-500">Sin movimientos adicionales registrados</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Lifecycle Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <h3 className={cn(
                'text-sm font-medium mb-6',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Ciclo de Vida del Activo
              </h3>

              <div className="relative">
                {/* Progress line */}
                <div className={cn(
                  'absolute top-6 left-0 right-0 h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />
                <div
                  className={cn('absolute top-6 left-0 h-1 rounded-full transition-all duration-500', `bg-gradient-to-r ${statusConfig.bgGradient}`)}
                  style={{ width: `${Math.max(0, ((statusConfig.step - 1) / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const isActive = statusConfig.step >= (index + 1)
                    const isCurrent = statusConfig.step === (index + 1)
                    const StepIcon = step.icon

                    return (
                      <div key={step.key} className="flex flex-col items-center">
                        <motion.div
                          initial={false}
                          animate={{ scale: isCurrent ? 1.1 : 1 }}
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 z-10',
                            isActive
                              ? `bg-gradient-to-br ${statusConfig.bgGradient} text-white shadow-lg`
                              : theme === 'dark'
                                ? 'bg-gray-700 text-gray-500'
                                : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          <StepIcon className="w-5 h-5" />
                        </motion.div>
                        <span className={cn(
                          'mt-3 text-xs font-medium',
                          isActive
                            ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                            : 'text-gray-500'
                        )}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Codigo',
                  value: asset.assetCode,
                  icon: Hash,
                  color: 'blue'
                },
                {
                  label: 'Categoria',
                  value: asset.categoryName || 'Sin categoria',
                  icon: Tag,
                  color: 'purple'
                },
                {
                  label: 'Condicion',
                  value: CONDITION_LABELS[asset.condition] || asset.condition,
                  icon: Layers,
                  color: 'emerald'
                },
                {
                  label: 'Ultima Auditoria',
                  value: asset.lastAuditDate ? formatDate(asset.lastAuditDate) : 'Sin auditar',
                  icon: ClipboardCheck,
                  color: 'amber'
                },
                {
                  label: 'Costo Adquisicion',
                  value: formatCurrency(asset.acquisitionCost, asset.currency),
                  icon: DollarSign,
                  color: 'blue'
                },
                {
                  label: 'Valor Actual',
                  value: formatCurrency(asset.currentValue || asset.acquisitionCost, asset.currency),
                  icon: TrendingDown,
                  color: 'purple'
                },
                {
                  label: 'Depreciacion',
                  value: `${depreciation.percent.toFixed(1)}%`,
                  icon: TrendingDown,
                  color: depreciation.percent > 50 ? 'red' : 'amber'
                },
                {
                  label: 'Tiempo de Vida',
                  value: calculateAge(),
                  icon: Clock,
                  color: 'emerald'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'purple' && 'bg-purple-500',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'amber' && 'bg-amber-500',
                    stat.color === 'red' && 'bg-red-500'
                  )} />

                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600'),
                      stat.color === 'red' && (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn(
                      'text-lg font-bold truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.value}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Location Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                  )}>
                    <MapPin className="w-5 h-5 text-green-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Ubicacion</h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <Building2 className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{asset.warehouseName || 'Sin almacen'}</p>
                    {asset.locationCode && (
                      <p className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <Hash className="w-3.5 h-3.5" />
                        {asset.locationCode}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Responsible Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Responsable</h3>
                </div>

                <div className="space-y-3">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.responsibleName || 'Sin asignar'}</p>

                  {asset.responsiblePosition && (
                    <p className="text-sm text-gray-500">{asset.responsiblePosition}</p>
                  )}
                </div>
              </motion.div>

              {/* Supplier Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <Package className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Proveedor</h3>
                </div>

                <div className="space-y-3">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.supplierName || 'Sin proveedor'}</p>

                  {asset.invoiceNumber && (
                    <div className={cn(
                      'pt-3 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>Factura: {asset.invoiceNumber}</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Technical Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={cn(
                  'p-2 rounded-xl',
                  theme === 'dark' ? 'bg-cyan-900/30' : 'bg-cyan-100'
                )}>
                  <Barcode className="w-5 h-5 text-cyan-500" />
                </div>
                <h3 className={cn(
                  'font-semibold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>Informacion Tecnica</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Marca</p>
                  <p className={cn(
                    'font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.brand || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Modelo</p>
                  <p className={cn(
                    'font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.model || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Numero de Serie</p>
                  <p className={cn(
                    'font-medium font-mono',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.serialNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Codigo de Barras</p>
                  <p className={cn(
                    'font-medium font-mono',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{asset.barcode}</p>
                </div>
              </div>

              {/* Barcode visualization */}
              <div className={cn(
                'mt-6 p-4 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
              )}>
                <svg ref={barcodeRef} className="mx-auto" />
              </div>
            </motion.div>

            {/* Notes */}
            {asset.notes && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                  )}>
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Notas / Observaciones</h3>
                </div>
                <p className={cn(
                  'text-sm leading-relaxed',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                )}>{asset.notes}</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Print Modal */}
        <AnimatePresence>
          {showPrintModal && asset && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "w-full max-w-lg rounded-2xl overflow-hidden",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                {/* Modal Header */}
                <div className={cn(
                  'px-6 py-4 border-b flex items-center justify-between',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                    )}>
                      <Tag className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Imprimir Etiqueta de Activo
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">{asset.assetCode}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <X className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6">
                  {/* Printer Selection */}
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Seleccionar Impresora
                    </label>

                    {loadingServices ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      </div>
                    ) : printServices.length === 0 ? (
                      <div className={cn(
                        'p-4 rounded-xl text-center',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">No hay servicios de impresion disponibles</p>
                        <p className="text-xs text-gray-400 mt-1">Configure un servicio de impresion primero</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {printServices.map(service => (
                          <div key={service.id}>
                            {service.printers.map(printer => (
                              <button
                                key={printer.id}
                                onClick={() => {
                                  setSelectedServiceId(service.id)
                                  setSelectedPrinterId(printer.id)
                                }}
                                className={cn(
                                  'w-full p-3 rounded-xl border text-left transition-all',
                                  selectedServiceId === service.id && selectedPrinterId === printer.id
                                    ? theme === 'dark'
                                      ? 'border-blue-500 bg-blue-900/30'
                                      : 'border-blue-500 bg-blue-50'
                                    : theme === 'dark'
                                      ? 'border-gray-700 hover:border-gray-600 bg-gray-700/30'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'w-3 h-3 rounded-full',
                                    printer.isOnline ? 'bg-green-500' : 'bg-gray-400'
                                  )} />
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      'font-medium truncate',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>{printer.printerName}</p>
                                    <p className="text-xs text-gray-500">
                                      {service.serviceName} • {printer.isOnline ? 'En linea' : 'Desconectada'}
                                    </p>
                                  </div>
                                  {selectedServiceId === service.id && selectedPrinterId === printer.id && (
                                    <Check className="w-5 h-5 text-blue-500" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Label Size Selection */}
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Tamano de Etiqueta
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setLabelSize('3x2')}
                        className={cn(
                          'p-4 rounded-xl border text-center transition-all',
                          labelSize === '3x2'
                            ? theme === 'dark'
                              ? 'border-blue-500 bg-blue-900/30'
                              : 'border-blue-500 bg-blue-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className={cn(
                          'w-16 h-10 mx-auto mb-2 rounded border-2 border-dashed',
                          labelSize === '3x2'
                            ? 'border-blue-400'
                            : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                        )} />
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>3" x 2"</p>
                        <p className="text-xs text-gray-500">(76x51mm)</p>
                      </button>
                      <button
                        onClick={() => setLabelSize('2x1')}
                        className={cn(
                          'p-4 rounded-xl border text-center transition-all',
                          labelSize === '2x1'
                            ? theme === 'dark'
                              ? 'border-blue-500 bg-blue-900/30'
                              : 'border-blue-500 bg-blue-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className={cn(
                          'w-12 h-6 mx-auto mb-2 rounded border-2 border-dashed',
                          labelSize === '2x1'
                            ? 'border-blue-400'
                            : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                        )} />
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>2" x 1"</p>
                        <p className="text-xs text-gray-500">(51x25mm)</p>
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Vista Previa
                    </label>
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-white' : 'bg-gray-50 border-gray-200'
                    )}>
                      {labelSize === '3x2' ? (
                        <div className="w-[220px] h-[147px] mx-auto p-2 border border-gray-300 bg-white flex flex-col">
                          <div className="flex justify-between items-start">
                            <span className="font-mono font-bold text-sm text-gray-900">{asset.assetCode}</span>
                            <span className="text-[9px] text-gray-500 text-right max-w-[50%] truncate">{asset.categoryName || ''}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 leading-tight mt-0.5 line-clamp-2">{asset.name}</p>
                          <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                            <span>{[asset.brand, asset.model].filter(Boolean).join(' ')}</span>
                            <span>{asset.warehouseName || ''}{asset.locationCode ? ` / ${asset.locationCode}` : ''}</span>
                          </div>
                          <div className="flex-1 flex items-center justify-center mt-1">
                            <svg className="w-full h-auto max-h-[70px]" ref={el => {
                              if (el) {
                                try {
                                  JsBarcode(el, asset.barcode, {
                                    format: 'CODE128',
                                    width: 2,
                                    height: 50,
                                    displayValue: true,
                                    fontSize: 11,
                                    margin: 2,
                                    background: 'transparent'
                                  })
                                } catch (e) { console.error(e) }
                              }
                            }} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-[180px] h-[88px] mx-auto p-1.5 border border-gray-300 bg-white flex flex-col">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-[11px] text-gray-900">{asset.assetCode}</span>
                            <span className="text-[7px] text-gray-500 max-w-[45%] truncate text-right">
                              {asset.warehouseName || ''}{asset.locationCode ? ` / ${asset.locationCode}` : ''}
                            </span>
                          </div>
                          <p className="text-[8px] text-gray-700 truncate leading-tight">{asset.name}</p>
                          <div className="flex-1 flex items-center justify-center">
                            <svg className="w-full h-auto max-h-[45px]" ref={el => {
                              if (el) {
                                try {
                                  JsBarcode(el, asset.barcode, {
                                    format: 'CODE128',
                                    width: 1.5,
                                    height: 35,
                                    displayValue: true,
                                    fontSize: 9,
                                    margin: 1,
                                    background: 'transparent'
                                  })
                                } catch (e) { console.error(e) }
                              }
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Copies */}
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Copias
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        disabled={copies <= 1}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                          copies <= 1
                            ? 'opacity-50 cursor-not-allowed'
                            : '',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        -
                      </button>
                      <span className={cn(
                        'text-xl font-bold w-12 text-center',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{copies}</span>
                      <button
                        onClick={() => setCopies(Math.min(99, copies + 1))}
                        disabled={copies >= 99}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                          copies >= 99
                            ? 'opacity-50 cursor-not-allowed'
                            : '',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className={cn(
                  'px-6 py-4 border-t flex items-center justify-between',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <button
                    onClick={handleBrowserPrint}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <Monitor className="w-4 h-4" />
                    Imprimir (Navegador)
                  </button>

                  <button
                    onClick={handlePrintWithService}
                    disabled={printLoading || !selectedPrinterId}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                      printLoading || !selectedPrinterId
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700',
                      'text-white'
                    )}
                  >
                    {printLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        Imprimir ({copies})
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
