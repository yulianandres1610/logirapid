'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  Warehouse,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Truck,
  Loader2,
  Printer,
  FileUp,
  ShoppingCart,
  Box,
  Receipt,
  Building2,
  MapPin,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Ban,
  History,
  Send,
  Edit3,
  FileDown
} from 'lucide-react'
import jsPDF from 'jspdf'
import Link from 'next/link'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { InvoiceGrid, InvoiceData } from '@/components/orders/InvoicePreviewCard'
import { InvoiceUploader, InvoiceFile } from '@/components/orders/InvoiceUploader'

interface PurchaseLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productBarcode: string | null
  productImage: string | null
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  quantity: number
  quantityReceived: number
  unitPrice: number
  totalPrice: number
  lotNumber: string | null
  expirationDate: string | null
  manufacturingDate: string | null
}

interface PurchaseOrder {
  id: number
  purchaseNumber: string
  supplierId: number
  supplierName: string
  supplierCode: string
  supplierContact: string | null
  supplierPhone: string | null
  supplierEmail: string | null
  supplierAddress: string | null
  warehouseId: number | null
  warehouseName: string | null
  warehouseAddress: string | null
  status: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  currency: string
  purchaseDate: string
  expectedDate: string | null
  receivedDate: string | null
  notes: string | null
  createdByName: string
  createdByRole: string | null
  confirmedByName: string | null
  receivedByName: string | null
  acceptedByName: string | null
  acceptedAt: string | null
  needsAcceptance: boolean
  validationStatus: string
  validatedByName: string | null
  validatedAt: string | null
  rejectionReason: string | null
  createdAt: string
  lines: PurchaseLine[]
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
  step: number
}> = {
  draft: {
    label: 'Borrador',
    color: 'gray',
    bgGradient: 'from-gray-500 to-slate-500',
    icon: FileText,
    step: 0
  },
  comprada: {
    label: 'Comprada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: ShoppingCart,
    step: 1
  },
  confirmed: {
    label: 'Confirmada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: CheckCircle,
    step: 1
  },
  pendiente: {
    label: 'Pendiente',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 2
  },
  recibido: {
    label: 'Recibida',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: Package,
    step: 3
  },
  received: {
    label: 'Recibida',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: Package,
    step: 3
  },
  cancelled: {
    label: 'Cancelada',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle,
    step: 0
  }
}

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Borrador', icon: FileText },
  { key: 'comprada', label: 'Comprada', icon: ShoppingCart },
  { key: 'pendiente', label: 'Pendiente', icon: Clock },
  { key: 'recibido', label: 'Recibida', icon: Package }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceFile[]>([])
  const [uploadingInvoices, setUploadingInvoices] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [downloadingPdf, setDownloadingPdf] = useState<'receipt' | 'letter' | null>(null)

  // Get user role from cookies
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';')
      const roleCookie = cookies.find(c => c.trim().startsWith('user-role='))
      if (roleCookie) {
        const role = decodeURIComponent(roleCookie.split('=')[1])
        setUserRole(role)
      }
    } catch (e) {
      console.error('Error reading role cookie:', e)
    }
  }, [])

  // PDF Generation Functions
  const generatePdfReceipt = async () => {
    if (!order) return
    setDownloadingPdf('receipt')

    try {
      // Receipt format: 80mm width (about 226 points)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200] // 80mm width, dynamic height
      })

      const pageWidth = 80
      const margin = 5
      let y = 10

      // Header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('FACTURA DE COMPRA', pageWidth / 2, y, { align: 'center' })
      y += 6

      doc.setFontSize(10)
      doc.text(order.purchaseNumber, pageWidth / 2, y, { align: 'center' })
      y += 8

      // Line separator
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6

      // Supplier info
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Proveedor:', margin, y)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.text(order.supplierName.substring(0, 30), margin, y)
      y += 4

      if (order.supplierCode) {
        doc.setFont('helvetica', 'normal')
        doc.text(`Código: ${order.supplierCode}`, margin, y)
        y += 4
      }
      y += 2

      // Date
      doc.text(`Fecha: ${formatDate(order.purchaseDate)}`, margin, y)
      y += 6

      // Line separator
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      // Products header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('Producto', margin, y)
      doc.text('Cant', pageWidth - margin - 20, y)
      doc.text('Total', pageWidth - margin - 5, y, { align: 'right' })
      y += 4

      // Products
      doc.setFont('helvetica', 'normal')
      for (const line of order.lines) {
        const productName = line.productName.substring(0, 25)
        doc.text(productName, margin, y)
        doc.text(String(line.quantity), pageWidth - margin - 18, y)
        doc.text(`$${line.totalPrice.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
        y += 4

        if (line.variantName) {
          doc.setFontSize(6)
          doc.text(`  ${line.variantName}`, margin, y)
          y += 3
          doc.setFontSize(7)
        }
      }
      y += 2

      // Line separator
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      // Totals
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('TOTAL:', margin, y)
      doc.text(`$${order.totalAmount.toFixed(2)} ${order.currency}`, pageWidth - margin, y, { align: 'right' })
      y += 8

      // Footer
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text('--- Generado por LogiRapid ---', pageWidth / 2, y, { align: 'center' })

      // Adjust page height
      const finalHeight = y + 10
      doc.internal.pageSize.height = finalHeight

      doc.save(`${order.purchaseNumber}-recibo.pdf`)
      showNotification('success', 'PDF descargado', 'Factura en formato recibo descargada')
    } catch (error) {
      console.error('Error generating receipt PDF:', error)
      showNotification('error', 'Error', 'No se pudo generar el PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const generatePdfLetter = async () => {
    if (!order) return
    setDownloadingPdf('letter')

    try {
      // Letter format: A4/Letter size
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      const pageWidth = 215.9
      const pageHeight = 279.4
      const margin = 20
      const contentWidth = pageWidth - margin * 2
      let y = 25

      // Header
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 54, 93) // Dark blue
      doc.text('FACTURA DE COMPRA', pageWidth / 2, y, { align: 'center' })
      y += 12

      // Order number and status
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text(order.purchaseNumber, pageWidth / 2, y, { align: 'center' })
      y += 8

      // Status badge
      const statusLabel = STATUS_CONFIG[order.status]?.label || order.status
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Estado: ${statusLabel}`, pageWidth / 2, y, { align: 'center' })
      y += 15

      // Horizontal line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 12

      // Two-column layout for supplier and order info
      doc.setTextColor(0, 0, 0)

      // Left column - Supplier
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PROVEEDOR', margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(order.supplierName, margin, y)
      y += 5

      if (order.supplierCode) {
        doc.setTextColor(100, 100, 100)
        doc.text(`Código: ${order.supplierCode}`, margin, y)
        y += 5
      }

      if (order.supplierContact) {
        doc.setTextColor(0, 0, 0)
        doc.text(`Contacto: ${order.supplierContact}`, margin, y)
        y += 5
      }

      if (order.supplierPhone) {
        doc.text(`Tel: ${order.supplierPhone}`, margin, y)
        y += 5
      }

      if (order.supplierEmail) {
        doc.text(`Email: ${order.supplierEmail}`, margin, y)
        y += 5
      }

      // Right column - Order dates (at the same height as supplier start)
      const rightX = pageWidth / 2 + 10
      let rightY = y - (order.supplierContact ? 20 : 15) - (order.supplierPhone ? 5 : 0) - (order.supplierEmail ? 5 : 0) - (order.supplierCode ? 5 : 0)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('INFORMACIÓN', rightX, rightY)
      rightY += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text(`Fecha de compra: ${formatDate(order.purchaseDate)}`, rightX, rightY)
      rightY += 5

      if (order.expectedDate) {
        doc.text(`Entrega esperada: ${formatDate(order.expectedDate)}`, rightX, rightY)
        rightY += 5
      }

      if (order.warehouseName) {
        doc.text(`Almacén: ${order.warehouseName}`, rightX, rightY)
        rightY += 5
      }

      doc.text(`Creado por: ${order.createdByName}`, rightX, rightY)

      y = Math.max(y, rightY) + 15

      // Horizontal line before products
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 10

      // Products table header
      doc.setFillColor(245, 247, 250)
      doc.rect(margin, y - 5, contentWidth, 10, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text('PRODUCTO', margin + 5, y)
      doc.text('SKU', margin + 85, y)
      doc.text('CANT', margin + 115, y, { align: 'center' })
      doc.text('P.UNIT', margin + 140, y, { align: 'right' })
      doc.text('TOTAL', pageWidth - margin - 5, y, { align: 'right' })
      y += 8

      // Products
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)

      for (const line of order.lines) {
        // Check if we need a new page
        if (y > pageHeight - 60) {
          doc.addPage()
          y = 25
        }

        const productName = line.productName.length > 40
          ? line.productName.substring(0, 40) + '...'
          : line.productName
        const sku = (line.variantSku || line.productSku || '').substring(0, 15)

        doc.text(productName, margin + 5, y)
        doc.text(sku, margin + 85, y)
        doc.text(String(line.quantity), margin + 115, y, { align: 'center' })
        doc.text(`$${line.unitPrice.toFixed(2)}`, margin + 140, y, { align: 'right' })
        doc.text(`$${line.totalPrice.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' })
        y += 6

        if (line.variantName) {
          doc.setTextColor(128, 90, 213) // Purple for variant
          doc.setFontSize(8)
          doc.text(`  ${line.variantName}`, margin + 5, y)
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(9)
          y += 5
        }

        if (line.lotNumber) {
          doc.setTextColor(100, 100, 100)
          doc.setFontSize(8)
          doc.text(`  Lote: ${line.lotNumber}`, margin + 5, y)
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(9)
          y += 5
        }
      }

      y += 5

      // Totals section
      doc.setDrawColor(200, 200, 200)
      doc.line(margin + 100, y, pageWidth - margin, y)
      y += 8

      doc.setFontSize(10)
      doc.text('Subtotal:', margin + 120, y)
      doc.text(`$${order.subtotal.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' })
      y += 6

      if (order.taxAmount > 0) {
        doc.text('Impuestos:', margin + 120, y)
        doc.text(`$${order.taxAmount.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' })
        y += 6
      }

      y += 3
      doc.setFillColor(26, 54, 93) // Dark blue
      doc.rect(margin + 100, y - 5, contentWidth - 100, 12, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text('TOTAL:', margin + 120, y + 2)
      doc.text(`$${order.totalAmount.toFixed(2)} ${order.currency}`, pageWidth - margin - 5, y + 2, { align: 'right' })
      y += 20

      // Notes section if exists
      if (order.notes) {
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('NOTAS:', margin, y)
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const splitNotes = doc.splitTextToSize(order.notes, contentWidth)
        doc.text(splitNotes, margin, y)
        y += splitNotes.length * 5 + 10
      }

      // Footer
      doc.setTextColor(150, 150, 150)
      doc.setFontSize(8)
      doc.text('Documento generado por LogiRapid', pageWidth / 2, pageHeight - 15, { align: 'center' })
      doc.text(new Date().toLocaleString('es-ES'), pageWidth / 2, pageHeight - 10, { align: 'center' })

      doc.save(`${order.purchaseNumber}-factura.pdf`)
      showNotification('success', 'PDF descargado', 'Factura en formato carta descargada')
    } catch (error) {
      console.error('Error generating letter PDF:', error)
      showNotification('error', 'Error', 'No se pudo generar el PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  useEffect(() => {
    fetchOrder()
    fetchInvoices()
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/purchases/${resolvedParams.id}`)
      const data = await response.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Error al cargar orden')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const response = await fetch(`/api/order-invoices/${resolvedParams.id}?type=purchase`)
      if (!response.ok) return
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) return
      const data = await response.json()
      if (data.success) {
        setInvoices(data.data.invoices || [])
      }
    } catch {
      // Silently ignore - invoices are optional
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/order-invoices/${resolvedParams.id}?invoiceId=${invoiceId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
      }
    } catch (err) {
      console.error('Error deleting invoice:', err)
    }
  }

  const handleUploadInvoices = async () => {
    if (pendingInvoices.length === 0) return

    setUploadingInvoices(true)
    try {
      // Separate local files from phone-uploaded files
      const localFiles = pendingInvoices.filter(inv => inv.file instanceof File && !inv.storagePath)
      const phoneUploads = pendingInvoices.filter(inv => inv.storagePath && inv.uploaded)

      let successCount = 0
      let hasError = false

      // Upload local files via FormData
      if (localFiles.length > 0) {
        const formData = new FormData()
        formData.append('orderType', 'purchase')
        formData.append('orderId', resolvedParams.id)

        for (const invoice of localFiles) {
          if (invoice.file) {
            formData.append('files', invoice.file)
          }
        }

        const response = await fetch('/api/upload/order-invoices', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()
        if (data.success) {
          successCount += data.data?.uploadedCount || localFiles.length
        } else {
          hasError = true
          console.error('Error uploading local files:', data.error)
        }
      }

      // Register phone-uploaded files via JSON
      if (phoneUploads.length > 0) {
        const existingFiles = phoneUploads
          .filter(inv => inv.storagePath)
          .map(inv => ({
            storagePath: inv.storagePath,
            fileName: inv.name,
            fileType: inv.type || 'image/jpeg',
            fileSize: inv.size || 0
          }))

        if (existingFiles.length > 0) {
          const response = await fetch('/api/upload/order-invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderType: 'purchase',
              orderId: resolvedParams.id,
              existingFiles
            })
          })

          const data = await response.json()
          if (data.success) {
            successCount += data.data?.registeredCount || phoneUploads.length
          } else {
            hasError = true
            console.error('Error registering phone uploads:', data.error)
          }
        }
      }

      if (successCount > 0) {
        await fetchInvoices()
        setPendingInvoices([])
        setShowUploader(false)
        showNotification('success', 'Facturas subidas', `Se subieron ${successCount} ${successCount === 1 ? 'factura' : 'facturas'} correctamente`)
      } else if (hasError) {
        showNotification('error', 'Error', 'Error al subir las facturas')
      }
    } catch (err) {
      console.error('Error uploading invoices:', err)
      showNotification('error', 'Error de conexión', 'No se pudieron subir las facturas. Intenta de nuevo.')
    } finally {
      setUploadingInvoices(false)
    }
  }

  const handleAcceptOrder = async () => {
    if (!order) return

    setAccepting(true)
    try {
      const response = await fetch(`/api/market/purchases/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Orden aceptada', 'La orden de compra ha sido aceptada exitosamente')
        fetchOrder() // Refresh order data
      } else {
        showNotification('error', 'Error', data.error || 'Error al aceptar la orden')
      }
    } catch (err) {
      console.error('Error accepting order:', err)
      showNotification('error', 'Error de conexión', 'No se pudo aceptar la orden. Intenta de nuevo.')
    } finally {
      setAccepting(false)
    }
  }

  const handleResubmit = async () => {
    if (!order) return

    setResubmitting(true)
    try {
      const response = await fetch(`/api/market/purchases/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resubmit' })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Reenviada a revisión', 'La orden ha sido reenviada para revisión')
        fetchOrder()
      } else {
        showNotification('error', 'Error', data.error || 'Error al reenviar la orden')
      }
    } catch (err) {
      console.error('Error resubmitting order:', err)
      showNotification('error', 'Error de conexión', 'No se pudo reenviar la orden. Intenta de nuevo.')
    } finally {
      setResubmitting(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'USD') => {
    const symbol = CURRENCY_SYMBOLS[currency] || '$'
    return `${symbol}${value.toFixed(2)}`
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return ''
    // Parse date safely to avoid timezone issues with DATE type from PostgreSQL
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      d = new Date(year, month - 1, day)
    } else {
      d = new Date(date)
    }
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate metrics
  const calculateMetrics = () => {
    if (!order) return { receivedProgress: 0, pendingUnits: 0 }

    const totalUnitsOrdered = order.lines.reduce((sum, line) => sum + line.quantity, 0)
    const totalUnitsReceived = order.lines.reduce((sum, line) => sum + line.quantityReceived, 0)

    const receivedProgress = totalUnitsOrdered > 0 ? (totalUnitsReceived / totalUnitsOrdered) * 100 : 0
    const pendingUnits = totalUnitsOrdered - totalUnitsReceived

    return { receivedProgress, pendingUnits, totalUnitsOrdered, totalUnitsReceived }
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
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !order) {
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
                {error || 'Orden no encontrada'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta compra.</p>
              <Link href="/dashboard/market/purchases">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a compras
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon
  const metrics = calculateMetrics()
  const totalItems = order.lines.length
  const totalUnits = order.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/purchases">
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
                {/* Download Receipt PDF Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generatePdfReceipt}
                  disabled={downloadingPdf !== null}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
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

                {/* Download Letter PDF Button */}
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

                {/* Print Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.print()}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="Imprimir página"
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">Imprimir</span>
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
                {/* Left: Order Info */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    `bg-gradient-to-br ${statusConfig.bgGradient}`
                  )}>
                    <Receipt className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.purchaseNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                        statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                      {order.validationStatus === 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <Ban className="w-3.5 h-3.5" />
                          Rechazada
                        </span>
                      )}
                      {order.validationStatus === 'pending_validation' && order.needsAcceptance && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pendiente Aceptación
                        </span>
                      )}
                      {order.acceptedByName && order.validationStatus !== 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aceptada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Orden de Compra</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.purchaseDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {order.createdByName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Total + Accept Button */}
                <div className="flex items-center gap-4">
                  {/* Botón Aceptar - Solo visible para MARKET_MANAGER, ADMIN, SUPER_ADMIN (NO comerciales) y no rechazadas */}
                  {order.needsAcceptance && order.validationStatus !== 'rejected' && userRole && ['MARKET_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole) && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAcceptOrder}
                      disabled={accepting}
                      className={cn(
                        'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors',
                        accepting
                          ? 'bg-green-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700',
                        'text-white'
                      )}
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Aceptando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Aceptar Orden
                        </>
                      )}
                    </motion.button>
                  )}
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Total</p>
                    <p className={cn(
                      'text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Rejection Banner */}
          {order.validationStatus === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto mb-6"
            >
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-200'
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
                  )}>
                    <Ban className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      'font-semibold mb-1',
                      theme === 'dark' ? 'text-red-300' : 'text-red-800'
                    )}>
                      Orden Rechazada
                    </h3>
                    {order.rejectionReason && (
                      <p className={cn(
                        'text-sm mb-2',
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                      )}>
                        <span className="font-medium">Motivo:</span> {order.rejectionReason}
                      </p>
                    )}
                    <p className={cn(
                      'text-xs',
                      theme === 'dark' ? 'text-red-500' : 'text-red-500'
                    )}>
                      {order.validatedByName && `Rechazada por ${order.validatedByName}`}
                      {order.validatedAt && ` el ${formatDateTime(order.validatedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashboard/market/purchases/create?editId=${order.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        )}
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar Orden
                      </motion.button>
                    </Link>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleResubmit}
                      disabled={resubmitting}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                        resubmitting
                          ? 'bg-blue-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700',
                        'text-white'
                      )}
                    >
                      {resubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Reenviar a Revisión
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Activity Log */}
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
                {/* Created */}
                <div className="flex items-start gap-4 relative">
                  <div className={cn(
                    'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                    theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'
                  )}>
                    <FileText className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="pt-1">
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Orden creada</p>
                    <p className="text-xs text-gray-500">
                      por {order.createdByName}
                      {order.createdByRole && <span className="ml-1 opacity-60">({order.createdByRole})</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>

                {/* Validated/Rejected */}
                {order.validatedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      order.validationStatus === 'rejected'
                        ? theme === 'dark' ? 'bg-red-900/50 ring-4 ring-gray-800' : 'bg-red-100 ring-4 ring-white'
                        : theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'
                    )}>
                      {order.validationStatus === 'rejected'
                        ? <Ban className="w-4 h-4 text-red-500" />
                        : <CheckCircle2 className="w-4 h-4 text-green-500" />
                      }
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        order.validationStatus === 'rejected'
                          ? theme === 'dark' ? 'text-red-300' : 'text-red-700'
                          : theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.validationStatus === 'rejected' ? 'Orden rechazada' : 'Orden aprobada'}
                      </p>
                      <p className="text-xs text-gray-500">
                        por {order.validatedByName}
                      </p>
                      {order.rejectionReason && (
                        <p className={cn(
                          'text-xs mt-1 italic',
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )}>
                          &quot;{order.rejectionReason}&quot;
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.validatedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Accepted */}
                {order.acceptedByName && order.acceptedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'
                    )}>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Orden aceptada</p>
                      <p className="text-xs text-gray-500">por {order.acceptedByName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.acceptedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Received */}
                {order.receivedByName && order.receivedDate && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                    )}>
                      <Package className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Mercancía recibida</p>
                      <p className="text-xs text-gray-500">por {order.receivedByName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.receivedDate)}</p>
                    </div>
                  </div>
                )}

                {/* Pending validation status */}
                {order.validationStatus === 'pending_validation' && !order.validatedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-orange-900/50 ring-4 ring-gray-800' : 'bg-orange-100 ring-4 ring-white'
                    )}>
                      <Clock className="w-4 h-4 text-orange-500 animate-pulse" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                      )}>Pendiente de aprobación</p>
                      <p className="text-xs text-gray-500">Esperando revisión de un administrador</p>
                    </div>
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
                Ciclo de Vida
              </h3>

              <div className="relative">
                {/* Progress line */}
                <div className={cn(
                  'absolute top-6 left-0 right-0 h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />
                <div
                  className={cn('absolute top-6 left-0 h-1 rounded-full transition-all duration-500', `bg-gradient-to-r ${statusConfig.bgGradient}`)}
                  style={{ width: `${Math.max(0, ((statusConfig.step) / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />

                {/* Steps */}
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
                  label: 'Productos',
                  value: totalItems,
                  icon: Box,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Unidades',
                  value: Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2),
                  icon: Package,
                  color: 'purple',
                  suffix: 'uds'
                },
                {
                  label: 'Recibido',
                  value: `${metrics.receivedProgress.toFixed(0)}%`,
                  icon: Truck,
                  color: 'emerald',
                  highlight: metrics.receivedProgress === 100
                },
                {
                  label: 'Pendiente',
                  value: Number.isInteger(metrics.pendingUnits) ? metrics.pendingUnits : metrics.pendingUnits.toFixed(2),
                  icon: Clock,
                  color: 'amber',
                  suffix: 'uds'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
                    stat.highlight && 'ring-2 ring-emerald-500/30'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'purple' && 'bg-purple-500',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'amber' && 'bg-amber-500'
                  )} />

                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600')
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

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Reception Progress */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'lg:col-span-1 p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Progreso de Recepción</h3>
                  <span className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium',
                    metrics.receivedProgress === 100
                      ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                      : theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'
                  )}>
                    {metrics.receivedProgress.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className={cn(
                  'h-4 rounded-full overflow-hidden mb-6',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.receivedProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Unidades ordenadas</span>
                    <span className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {Number.isInteger(metrics.totalUnitsOrdered) ? metrics.totalUnitsOrdered : metrics.totalUnitsOrdered?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Recibidas</span>
                    <span className="text-sm font-medium text-emerald-500">
                      {Number.isInteger(metrics.totalUnitsReceived) ? metrics.totalUnitsReceived : metrics.totalUnitsReceived?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Pendientes</span>
                    <span className={cn(
                      'text-sm font-medium',
                      metrics.pendingUnits > 0 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {Number.isInteger(metrics.pendingUnits) ? metrics.pendingUnits : metrics.pendingUnits?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Supplier Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                    )}>
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Proveedor</h3>
                  </div>
                  {order.supplierCode && (
                    <span className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-mono font-medium',
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}>
                      {order.supplierCode}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{order.supplierName}</p>

                  <div className={cn(
                    'pt-3 border-t space-y-2',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    {order.supplierContact && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierContact}</span>
                      </div>
                    )}
                    {order.supplierPhone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierPhone}</span>
                      </div>
                    )}
                    {order.supplierEmail && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm truncate',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Warehouse & Dates Card */}
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
                    <Warehouse className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Almacén Destino</h3>
                </div>

                {order.warehouseName ? (
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <MapPin className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{order.warehouseName}</p>
                      {order.warehouseAddress && (
                        <p className="text-sm text-gray-500 mt-1">{order.warehouseAddress}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">Sin almacén asignado</p>
                )}

                {/* Dates */}
                <div className={cn(
                  'pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Fecha compra:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{formatDate(order.purchaseDate)}</span>
                  </div>
                  {order.expectedDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Entrega esperada:</span>
                      <span className="text-gray-600">{formatDate(order.expectedDate)}</span>
                    </div>
                  )}
                  {order.receivedDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Recibida:</span>
                      <span className="text-emerald-500">{formatDate(order.receivedDate)}</span>
                    </div>
                  )}
                  {order.acceptedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Aceptada:</span>
                      <span className="text-green-500">{formatDateTime(order.acceptedAt)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Products Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <Package className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Productos</h3>
                    <p className="text-sm text-gray-500">{order.lines.length} productos en esta orden</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordenado</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recibido</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Unitario</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lote</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {order.lines.map((line, idx) => {
                      const receiveProgress = line.quantity > 0
                        ? (line.quantityReceived / line.quantity) * 100
                        : 0

                      return (
                        <motion.tr
                          key={line.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'w-12 h-12 rounded-xl overflow-hidden shrink-0',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {line.productImage ? (
                                  <Image
                                    src={line.productImage}
                                    alt={line.productName}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className={cn(
                                  'font-medium truncate max-w-[200px]',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.productName}</p>
                                {line.variantName && (
                                  <p className="text-xs text-purple-500 font-medium mt-0.5">
                                    {line.variantName}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 font-mono">
                                  SKU: {line.variantSku || line.productSku}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'text-lg font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{line.quantity}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                'inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold',
                                line.quantityReceived > 0
                                  ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                                  : theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                              )}>
                                {line.quantityReceived}
                              </span>
                              {line.quantity > 0 && (
                                <div className={cn(
                                  'w-full h-1 rounded-full max-w-[40px]',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, receiveProgress)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.unitPrice, order.currency)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(line.totalPrice, order.currency)}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {line.lotNumber ? (
                              <div className="text-center">
                                <p className={cn(
                                  'text-sm font-mono',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.lotNumber}</p>
                                {line.expirationDate && (
                                  <p className="text-xs text-amber-500">
                                    Vence: {formatDate(line.expirationDate)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className={cn(
                                'text-xs px-2 py-1 rounded-lg',
                                theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                              )}>Sin lote</span>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                  {/* Table Footer */}
                  <tfoot className={cn(
                    'border-t-2',
                    theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <tr>
                      <td colSpan={4} className="py-4 px-6 text-right font-semibold text-gray-500">
                        Total:
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{formatCurrency(order.totalAmount, order.currency)}</span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>

            {/* Notes & Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                    )}>
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Notas</h3>
                  </div>
                  <p className={cn(
                    'text-sm leading-relaxed',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  )}>{order.notes}</p>
                </motion.div>
              )}

              {/* Invoices */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
                  !order.notes && 'lg:col-span-2'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <FileUp className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Facturas Originales</h3>
                      {invoices.length > 0 && (
                        <p className="text-sm text-gray-500">{invoices.length} {invoices.length === 1 ? 'archivo' : 'archivos'}</p>
                      )}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUploader(!showUploader)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      showUploader
                        ? theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    )}
                  >
                    <FileUp className="w-4 h-4" />
                    {showUploader ? 'Cancelar' : 'Subir Facturas'}
                  </motion.button>
                </div>

                {/* Uploader Section */}
                <AnimatePresence>
                  {showUploader && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'mb-6 p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <InvoiceUploader
                          invoices={pendingInvoices}
                          onInvoicesChange={setPendingInvoices}
                          orderType="purchase"
                          disabled={uploadingInvoices}
                        />

                        {pendingInvoices.length > 0 && (
                          <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleUploadInvoices}
                              disabled={uploadingInvoices}
                              className={cn(
                                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors',
                                uploadingInvoices
                                  ? 'bg-purple-400 cursor-not-allowed'
                                  : 'bg-purple-600 hover:bg-purple-700',
                                'text-white'
                              )}
                            >
                              {uploadingInvoices ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Subiendo...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Guardar {pendingInvoices.length} {pendingInvoices.length === 1 ? 'factura' : 'facturas'}
                                </>
                              )}
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {loadingInvoices ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : (
                  <InvoiceGrid
                    invoices={invoices}
                    onDelete={handleDeleteInvoice}
                    showDelete={true}
                    emptyMessage="No hay facturas adjuntas a esta compra"
                  />
                )}
              </motion.div>
            </div>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
