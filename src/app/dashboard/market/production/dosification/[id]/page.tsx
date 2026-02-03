'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Package,
  Scale,
  Warehouse,
  Clock,
  CheckCircle,
  Play,
  X,
  PackageCheck,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  FileText,
  ArrowRight,
  Printer,
  Loader2,
  History,
  Box,
  Boxes,
  Receipt,
  FileDown,
  Wifi,
  WifiOff,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: string
  printers: Array<{
    id: number
    printerName: string
    printerId: string
    printerType: string
    isOnline: boolean
    isDefault: boolean
    supportedDocumentTypes: string[]
  }>
}

interface ProductionOrder {
  id: number
  orderNumber: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  sourceProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
    unit: string
    variantId: number | null
    variantName: string | null
  }
  targetProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
    unit: string
    variantId: number | null
    variantName: string | null
  }
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  targetWarehouse: {
    id: number
    name: string
    code: string
  }
  sourceQuantity: number
  sourceUnitCost: number
  sourceWeightKg: number
  targetPortionWeightKg: number
  targetQuantity: number
  expectedTotalWeightKg: number
  wasteSurplus: {
    kg: number
    type: 'waste' | 'surplus' | 'exact'
  }
  actualQuantity: number | null
  actualWasteSurplusKg: number | null
  costs: {
    rawMaterial: number
    materials: number
    labor: number
    total: number
    perUnit: number
  }
  documents: {
    productionDocPrinted: boolean
    receptionDocPrinted: boolean
  }
  lotNumber: string | null
  expirationDate: string | null
  materials: Array<{
    id: number
    productId: number
    productName: string
    productSku: string | null
    productImage: string | null
    variantId: number | null
    variantName: string | null
    warehouseId: number
    warehouseName: string
    quantity: number
    unitCost: number
    totalCost: number
  }>
  activityLog: Array<{
    id: number
    action: string
    details: any
    performedBy: string
    performedAt: string
  }>
  createdBy: string
  completedBy: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  notes: string | null
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
  step: number
}> = {
  pending: {
    label: 'Pendiente',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 0
  },
  in_progress: {
    label: 'En Proceso',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: Play,
    step: 1
  },
  completed: {
    label: 'Completada',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle,
    step: 2
  },
  cancelled: {
    label: 'Cancelada',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: X,
    step: 0
  }
}

const LIFECYCLE_STEPS = [
  { key: 'pending', label: 'Pendiente', icon: Clock },
  { key: 'in_progress', label: 'En Proceso', icon: Play },
  { key: 'completed', label: 'Completada', icon: CheckCircle }
]

export default function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState<'materials' | 'reception' | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<'receipt' | 'letter' | null>(null)

  // Printer selection state
  const [showPrinterModal, setShowPrinterModal] = useState(false)
  const [printServices, setPrintServices] = useState<PrintService[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [pendingPrintType, setPendingPrintType] = useState<'materials' | 'reception' | null>(null)

  useEffect(() => {
    fetchOrder()
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/production/orders/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrder(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrintServices = async () => {
    setLoadingPrinters(true)
    try {
      const response = await fetch('/api/print/services')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.services) {
          // Filter to only active services with online printers
          const activeServices = data.data.services.filter(
            (s: PrintService) => (s.status === 'active' || s.status === 'offline') && s.printers.length > 0
          )
          setPrintServices(activeServices)
          // Auto-select default printer if exists
          for (const service of activeServices) {
            const defaultPrinter = service.printers.find((p: PrintService['printers'][0]) => p.isDefault && p.isOnline)
            if (defaultPrinter) {
              setSelectedPrinter({ serviceId: service.id, printerId: defaultPrinter.id })
              break
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching print services:', error)
    } finally {
      setLoadingPrinters(false)
    }
  }

  const openPrinterModal = (documentType: 'materials' | 'reception') => {
    setPendingPrintType(documentType)
    setShowPrinterModal(true)
    if (printServices.length === 0) {
      fetchPrintServices()
    }
  }

  const confirmPrint = async () => {
    if (!pendingPrintType || !selectedPrinter) {
      showNotification('error', 'Error', 'Seleccione una impresora')
      return
    }
    setShowPrinterModal(false)
    await handlePrint(pendingPrintType, selectedPrinter.serviceId, selectedPrinter.printerId)
    setPendingPrintType(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatWeight = (kg: number) => {
    return kg.toFixed(3) + ' kg'
  }

  // Silent print using print service
  const handlePrint = async (documentType: 'materials' | 'reception', printServiceId?: number, printerId?: number) => {
    if (!order) return
    setPrinting(documentType)
    try {
      const response = await fetch(`/api/market/production/orders/${order.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          printServiceId,
          printerId
        })
      })
      const data = await response.json()
      if (data.success) {
        setOrder(prev => prev ? {
          ...prev,
          documents: {
            ...prev.documents,
            [documentType === 'materials' ? 'productionDocPrinted' : 'receptionDocPrinted']: true
          }
        } : null)
        showNotification('success', 'Imprimiendo', `Documento enviado a la impresora: ${data.data.jobNumber}`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al imprimir')
      }
    } catch (error) {
      console.error('Error printing:', error)
      showNotification('error', 'Error', 'Error al enviar a imprimir')
    } finally {
      setPrinting(null)
    }
  }

  // Generate PDF receipt (thermal ticket format)
  const generatePdfReceipt = async () => {
    if (!order) return
    setDownloadingPdf('receipt')

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200]
      })

      const pageWidth = 80
      const margin = 5
      let y = 10

      // Header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ORDEN DE PRODUCCION', pageWidth / 2, y, { align: 'center' })
      y += 6

      doc.setFontSize(10)
      doc.text(order.orderNumber, pageWidth / 2, y, { align: 'center' })
      y += 8

      // Status
      const statusConfig = STATUS_CONFIG[order.status]
      doc.setFontSize(8)
      doc.text(`Estado: ${statusConfig.label}`, pageWidth / 2, y, { align: 'center' })
      y += 6

      // Line separator
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6

      // Source product
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('PRODUCTO FUENTE:', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.text(order.sourceProduct.name.substring(0, 30), margin, y)
      y += 4
      doc.text(`Cantidad: ${order.sourceQuantity} - Peso: ${formatWeight(order.sourceWeightKg)}`, margin, y)
      y += 6

      // Target product
      doc.setFont('helvetica', 'bold')
      doc.text('PRODUCTO FINAL:', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.text(order.targetProduct.name.substring(0, 30), margin, y)
      y += 4
      doc.text(`Cantidad: ${order.actualQuantity ?? order.targetQuantity} x ${formatWeight(order.targetPortionWeightKg)}`, margin, y)
      y += 6

      // Materials
      if (order.materials.length > 0) {
        doc.line(margin, y, pageWidth - margin, y)
        y += 4
        doc.setFont('helvetica', 'bold')
        doc.text('MATERIALES:', margin, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const m of order.materials) {
          doc.text(`- ${m.productName.substring(0, 25)} x${m.quantity}`, margin, y)
          y += 3.5
        }
        y += 2
      }

      // Lot info
      if (order.lotNumber) {
        doc.line(margin, y, pageWidth - margin, y)
        y += 5
        doc.setFont('helvetica', 'bold')
        doc.text(`LOTE: ${order.lotNumber}`, margin, y)
        y += 4
        if (order.expirationDate) {
          doc.setFont('helvetica', 'normal')
          doc.text(`Vence: ${formatDate(order.expirationDate)}`, margin, y)
          y += 4
        }
      }

      // Costs
      doc.line(margin, y, pageWidth - margin, y)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('COSTO TOTAL:', margin, y)
      doc.text(formatCurrency(order.costs.total), pageWidth - margin, y, { align: 'right' })
      y += 5
      doc.text('COSTO/UNIDAD:', margin, y)
      doc.text(formatCurrency(order.costs.perUnit), pageWidth - margin, y, { align: 'right' })
      y += 8

      // Footer
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text('--- Generado por LogiRapid ---', pageWidth / 2, y, { align: 'center' })

      const finalHeight = y + 10
      doc.internal.pageSize.height = finalHeight

      doc.save(`${order.orderNumber}-recibo.pdf`)
      showNotification('success', 'PDF descargado', 'Recibo de produccion descargado')
    } catch (error) {
      console.error('Error generating receipt PDF:', error)
      showNotification('error', 'Error', 'No se pudo generar el PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  // Generate PDF letter format
  const generatePdfLetter = async () => {
    if (!order) return
    setDownloadingPdf('letter')

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      const pageWidth = 215.9
      const margin = 20
      let y = 25

      // Header
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 54, 93)
      doc.text('ORDEN DE PRODUCCION', pageWidth / 2, y, { align: 'center' })
      y += 12

      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text(order.orderNumber, pageWidth / 2, y, { align: 'center' })
      y += 8

      const statusConfig = STATUS_CONFIG[order.status]
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Estado: ${statusConfig.label}`, pageWidth / 2, y, { align: 'center' })
      y += 15

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 12

      // Products section
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('PRODUCTO FUENTE', margin, y)
      doc.text('PRODUCTO FINAL', pageWidth / 2 + 10, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(order.sourceProduct.name, margin, y)
      doc.text(order.targetProduct.name, pageWidth / 2 + 10, y)
      y += 5

      doc.setTextColor(100, 100, 100)
      doc.text(`${order.sourceQuantity} unidad(es) - ${formatWeight(order.sourceWeightKg)}`, margin, y)
      doc.text(`${order.actualQuantity ?? order.targetQuantity} x ${formatWeight(order.targetPortionWeightKg)}`, pageWidth / 2 + 10, y)
      y += 5

      doc.text(`Almacen: ${order.sourceWarehouse.name}`, margin, y)
      doc.text(`Almacen: ${order.targetWarehouse.name}`, pageWidth / 2 + 10, y)
      y += 12

      // Materials table
      if (order.materials.length > 0) {
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('MATERIALES', margin, y)
        y += 8

        doc.setFillColor(245, 247, 250)
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F')
        doc.setFontSize(9)
        doc.text('Material', margin + 5, y)
        doc.text('Cantidad', pageWidth - margin - 50, y)
        doc.text('Costo', pageWidth - margin - 5, y, { align: 'right' })
        y += 6

        doc.setFont('helvetica', 'normal')
        for (const m of order.materials) {
          doc.text(m.productName.substring(0, 40), margin + 5, y)
          doc.text(String(m.quantity), pageWidth - margin - 50, y)
          doc.text(formatCurrency(m.totalCost), pageWidth - margin - 5, y, { align: 'right' })
          y += 5
        }
        y += 8
      }

      // Lot info
      if (order.lotNumber) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('INFORMACION DE LOTE', margin, y)
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(`Numero de Lote: ${order.lotNumber}`, margin, y)
        y += 5
        if (order.expirationDate) {
          doc.text(`Fecha de Vencimiento: ${formatDate(order.expirationDate)}`, margin, y)
          y += 5
        }
        y += 8
      }

      // Costs section
      doc.setDrawColor(200, 200, 200)
      doc.line(margin + 100, y, pageWidth - margin, y)
      y += 8

      doc.setFontSize(10)
      doc.text('Materia Prima:', margin + 120, y)
      doc.text(formatCurrency(order.costs.rawMaterial), pageWidth - margin - 5, y, { align: 'right' })
      y += 6

      if (order.costs.materials > 0) {
        doc.text('Materiales:', margin + 120, y)
        doc.text(formatCurrency(order.costs.materials), pageWidth - margin - 5, y, { align: 'right' })
        y += 6
      }

      if (order.costs.labor > 0) {
        doc.text('Mano de Obra:', margin + 120, y)
        doc.text(formatCurrency(order.costs.labor), pageWidth - margin - 5, y, { align: 'right' })
        y += 6
      }

      y += 3
      doc.setFillColor(26, 54, 93)
      doc.rect(margin + 100, y - 5, pageWidth - margin - 100 - margin, 12, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text('COSTO TOTAL:', margin + 120, y + 2)
      doc.text(formatCurrency(order.costs.total), pageWidth - margin - 5, y + 2, { align: 'right' })
      y += 15

      doc.setTextColor(0, 0, 0)
      doc.text('COSTO POR UNIDAD:', margin + 120, y)
      doc.setTextColor(16, 185, 129)
      doc.text(formatCurrency(order.costs.perUnit), pageWidth - margin - 5, y, { align: 'right' })
      y += 15

      // Notes
      if (order.notes) {
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('NOTAS:', margin, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const splitNotes = doc.splitTextToSize(order.notes, pageWidth - margin * 2)
        doc.text(splitNotes, margin, y)
        y += splitNotes.length * 5 + 10
      }

      // Footer
      doc.setTextColor(150, 150, 150)
      doc.setFontSize(8)
      doc.text('Documento generado por LogiRapid', pageWidth / 2, 270, { align: 'center' })
      doc.text(new Date().toLocaleString('es-ES'), pageWidth / 2, 275, { align: 'center' })

      doc.save(`${order.orderNumber}-orden.pdf`)
      showNotification('success', 'PDF descargado', 'Orden de produccion descargada')
    } catch (error) {
      console.error('Error generating letter PDF:', error)
      showNotification('error', 'Error', 'No se pudo generar el PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!order) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <Package className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Orden no encontrada
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta orden.</p>
              <Link href="/dashboard/market/production/dosification">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a ordenes
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status]
  const StatusIcon = statusConfig.icon

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/production/dosification">
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
                {/* Silent Print Buttons */}
                {(order.status === 'pending' || order.status === 'in_progress') && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openPrinterModal('materials')}
                    disabled={printing !== null}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                      printing === 'materials' && 'opacity-50 cursor-not-allowed'
                    )}
                    title="Imprimir recibo de materiales (ticket termico)"
                  >
                    {printing === 'materials' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm hidden sm:inline">Materiales</span>
                  </motion.button>
                )}

                {order.status === 'completed' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openPrinterModal('reception')}
                    disabled={printing !== null}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                      printing === 'reception' && 'opacity-50 cursor-not-allowed'
                    )}
                    title="Imprimir recibo de recepcion (ticket termico)"
                  >
                    {printing === 'reception' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm hidden sm:inline">Recepcion</span>
                  </motion.button>
                )}

                {/* Download PDF Buttons */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generatePdfReceipt}
                  disabled={downloadingPdf !== null}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                    downloadingPdf === 'receipt' && 'opacity-50 cursor-not-allowed'
                  )}
                  title="Descargar PDF formato recibo"
                >
                  {downloadingPdf === 'receipt' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )}
                  <span className="font-medium text-sm hidden sm:inline">Recibo</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generatePdfLetter}
                  disabled={downloadingPdf !== null}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                    downloadingPdf === 'letter' && 'opacity-50 cursor-not-allowed'
                  )}
                  title="Descargar PDF formato carta"
                >
                  {downloadingPdf === 'letter' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span className="font-medium text-sm hidden sm:inline">Carta</span>
                </motion.button>
              </div>
            </div>

            {/* Order Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    `bg-gradient-to-br ${statusConfig.bgGradient}`
                  )}>
                    <Scale className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.orderNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Orden de Produccion / Dosificacion</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {order.createdBy}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Receive Production Button - Only when in_progress */}
                  {order.status === 'in_progress' && (
                    <Link href={`/dashboard/market/production/dosification/${order.id}/receive`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors',
                          'bg-emerald-600 hover:bg-emerald-700 text-white'
                        )}
                      >
                        <PackageCheck className="w-5 h-5" />
                        Recibir Produccion
                      </motion.button>
                    </Link>
                  )}
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Costo Total</p>
                    <p className={cn(
                      'text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(order.costs.total)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

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
                Ciclo de Vida
              </h3>

              <div className="relative">
                <div className={cn(
                  'absolute top-6 left-0 right-0 h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />
                <div
                  className={cn('absolute top-6 left-0 h-1 rounded-full transition-all duration-500', `bg-gradient-to-r ${statusConfig.bgGradient}`)}
                  style={{ width: `${Math.max(0, ((statusConfig.step) / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />

                <div className="relative flex justify-between">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const isActive = statusConfig.step >= index
                    const isCurrent = statusConfig.step === index
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
                  label: 'Peso Fuente',
                  value: formatWeight(order.sourceWeightKg),
                  icon: Scale,
                  color: 'blue'
                },
                {
                  label: 'Cantidad Final',
                  value: order.actualQuantity ?? order.targetQuantity,
                  icon: Package,
                  color: 'emerald',
                  suffix: 'uds'
                },
                {
                  label: 'Peso/Unidad',
                  value: formatWeight(order.targetPortionWeightKg),
                  icon: Box,
                  color: 'purple'
                },
                {
                  label: order.wasteSurplus.type === 'waste' ? 'Merma' : order.wasteSurplus.type === 'surplus' ? 'Sobrante' : 'Diferencia',
                  value: formatWeight(Math.abs(order.actualWasteSurplusKg ?? order.wasteSurplus.kg)),
                  icon: order.wasteSurplus.type === 'waste' ? AlertTriangle : CheckCircle,
                  color: order.wasteSurplus.type === 'waste' ? 'red' : order.wasteSurplus.type === 'surplus' ? 'green' : 'gray'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'green' && (theme === 'dark' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'),
                      stat.color === 'red' && (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'),
                      stat.color === 'gray' && (theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.value}
                      {stat.suffix && <span className="text-sm font-normal text-gray-500 ml-1">{stat.suffix}</span>}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Products & Warehouses Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Source Product */}
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
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <Package className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Producto Fuente</h3>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  {order.sourceProduct.imageUrl ? (
                    <img
                      src={order.sourceProduct.imageUrl}
                      alt={order.sourceProduct.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className={cn(
                      'w-16 h-16 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className={cn(
                      'font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{order.sourceProduct.name}</p>
                    {order.sourceProduct.sku && (
                      <p className="text-sm text-gray-500 font-mono">SKU: {order.sourceProduct.sku}</p>
                    )}
                  </div>
                </div>

                <div className={cn(
                  'pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cantidad:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{order.sourceQuantity} {order.sourceProduct.unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Peso total:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatWeight(order.sourceWeightKg)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Costo unitario:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(order.sourceUnitCost)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                    <Warehouse className="w-4 h-4" />
                    {order.sourceWarehouse.name}
                  </div>
                </div>
              </motion.div>

              {/* Target Product */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-emerald-900/50' : 'bg-emerald-100'
                  )}>
                    <PackageCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Producto Final</h3>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  {order.targetProduct.imageUrl ? (
                    <img
                      src={order.targetProduct.imageUrl}
                      alt={order.targetProduct.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className={cn(
                      'w-16 h-16 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-emerald-100'
                    )}>
                      <PackageCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                  )}
                  <div>
                    <p className={cn(
                      'font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{order.targetProduct.name}</p>
                    {order.targetProduct.sku && (
                      <p className="text-sm text-gray-500 font-mono">SKU: {order.targetProduct.sku}</p>
                    )}
                  </div>
                </div>

                <div className={cn(
                  'pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-emerald-800' : 'border-emerald-200'
                )}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cantidad:</span>
                    <span className={cn(
                      'font-bold',
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    )}>{order.actualQuantity ?? order.targetQuantity} unidades</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Peso por unidad:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatWeight(order.targetPortionWeightKg)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                    <Warehouse className="w-4 h-4" />
                    {order.targetWarehouse.name}
                  </div>
                </div>

                {/* Lot info */}
                {order.lotNumber && (
                  <div className={cn(
                    'mt-4 p-3 rounded-xl',
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                  )}>
                    <p className="text-xs text-emerald-600 mb-1">Numero de Lote</p>
                    <p className={cn(
                      'font-mono font-bold',
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                    )}>{order.lotNumber}</p>
                    {order.expirationDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Vence: {formatDate(order.expirationDate)}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Materials Table */}
            {order.materials.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'rounded-2xl border overflow-hidden',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className={cn(
                  'px-6 py-4 border-b flex items-center gap-3',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <Boxes className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Materiales</h3>
                    <p className="text-sm text-gray-500">{order.materials.length} materiales en esta orden</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}>
                      <tr>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Unitario</th>
                        <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100')}>
                      {order.materials.map((m) => (
                        <tr key={m.id} className={cn('transition-colors', theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50')}>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {m.productImage ? (
                                <img src={m.productImage} alt={m.productName} className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{m.productName}</p>
                                <p className="text-xs text-gray-500">{m.warehouseName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{m.quantity}</span>
                          </td>
                          <td className="py-4 px-4 text-right text-gray-500">{formatCurrency(m.unitCost)}</td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatCurrency(m.totalCost)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className={cn('border-t-2', theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50')}>
                      <tr>
                        <td colSpan={3} className="py-4 px-6 text-right font-semibold text-gray-500">Total Materiales:</td>
                        <td className="py-4 px-4 text-right">
                          <span className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatCurrency(order.costs.materials)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Costs Summary & Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Costs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100')}>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Desglose de Costos</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Materia prima ({order.sourceQuantity} x {formatCurrency(order.sourceUnitCost)})</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(order.costs.rawMaterial)}</span>
                  </div>
                  {order.costs.materials > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Materiales</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(order.costs.materials)}</span>
                    </div>
                  )}
                  {order.costs.labor > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Mano de obra</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(order.costs.labor)}</span>
                    </div>
                  )}
                  <div className={cn('flex justify-between pt-3 border-t font-bold', theme === 'dark' ? 'border-gray-600' : 'border-gray-200')}>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>TOTAL</span>
                    <span className="text-emerald-600">{formatCurrency(order.costs.total)}</span>
                  </div>
                  <div className={cn('flex justify-between text-lg pt-2', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                    <span className="font-bold">COSTO/UNIDAD</span>
                    <span className="font-bold">{formatCurrency(order.costs.perUnit)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Notes */}
              {order.notes && (
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
                    <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100')}>
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Notas</h3>
                  </div>
                  <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{order.notes}</p>
                </motion.div>
              )}
            </div>

            {/* Activity Log - At the end */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={cn(
                'p-6 rounded-2xl border',
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
                <div className={cn(
                  'absolute left-[17px] top-2 bottom-2 w-0.5',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />

                <div className="space-y-4">
                  {order.activityLog.map((log, idx) => (
                    <div key={log.id} className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        idx === 0
                          ? theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                          : theme === 'dark' ? 'bg-gray-700 ring-4 ring-gray-800' : 'bg-gray-100 ring-4 ring-white'
                      )}>
                        {log.action === 'created' && <FileText className="w-4 h-4 text-blue-500" />}
                        {log.action === 'materials_delivered' && <Boxes className="w-4 h-4 text-amber-500" />}
                        {log.action === 'received' && <PackageCheck className="w-4 h-4 text-emerald-500" />}
                        {!['created', 'materials_delivered', 'received'].includes(log.action) && (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="pt-1">
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {log.action === 'created' && 'Orden creada'}
                          {log.action === 'materials_delivered' && 'Materiales entregados'}
                          {log.action === 'received' && 'Produccion recibida'}
                          {!['created', 'materials_delivered', 'received'].includes(log.action) &&
                            log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          }
                        </p>
                        <p className="text-xs text-gray-500">por {log.performedBy}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.performedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Printer Selection Modal */}
        <AnimatePresence>
          {showPrinterModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowPrinterModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-md rounded-2xl p-6',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                    )}>
                      <Printer className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Seleccionar Impresora</h3>
                      <p className="text-sm text-gray-500">
                        {pendingPrintType === 'materials' ? 'Recibo de Materiales' : 'Recibo de Recepcion'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPrinterModal(false)}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {loadingPrinters ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  </div>
                ) : printServices.length === 0 ? (
                  <div className={cn(
                    'text-center py-8 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                  )}>
                    <WifiOff className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className={cn(
                      'font-medium mb-1',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>No hay impresoras disponibles</p>
                    <p className="text-sm text-gray-500">
                      Verifique que el servicio de impresion este activo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {printServices.map((service) => (
                      <div key={service.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded',
                            service.status === 'active'
                              ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                              : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                          )}>
                            {service.serviceName}
                          </span>
                          {service.status === 'active' ? (
                            <Wifi className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <WifiOff className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        {service.printers.map((printer) => (
                          <button
                            key={printer.id}
                            onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                            className={cn(
                              'w-full p-3 rounded-xl border transition-all text-left mb-2',
                              selectedPrinter?.printerId === printer.id
                                ? theme === 'dark'
                                  ? 'bg-amber-900/30 border-amber-500 ring-2 ring-amber-500/30'
                                  : 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30'
                                : theme === 'dark'
                                  ? 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-10 h-10 rounded-xl flex items-center justify-center',
                                  printer.isOnline
                                    ? theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                                    : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                                )}>
                                  <Printer className={cn(
                                    'w-5 h-5',
                                    printer.isOnline ? 'text-emerald-500' : 'text-gray-400'
                                  )} />
                                </div>
                                <div>
                                  <p className={cn(
                                    'font-medium text-sm',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {printer.printerName}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      'text-xs',
                                      printer.printerType === 'thermal' ? 'text-amber-500' : 'text-blue-500'
                                    )}>
                                      {printer.printerType === 'thermal' ? 'Termica' : 'Normal'}
                                    </span>
                                    {printer.isDefault && (
                                      <span className="text-xs text-gray-500">(Predeterminada)</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {printer.isOnline ? (
                                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    En linea
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-500">Desconectada</span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowPrinterModal(false)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmPrint}
                    disabled={!selectedPrinter || printing !== null}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                      selectedPrinter
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {printing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        Imprimir
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
