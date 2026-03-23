'use client'

import { useEffect, useState, useRef, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Send,
  Receipt,
  Clock,
  Printer,
  Download,
  X,
  Package,
  Calendar,
  User,
  Building2,
  MapPin,
  Tag,
  DollarSign,
  ChevronDown,
  Copy,
  Check,
  Link2,
  PenTool,
  Loader2,
  Mail,
  ExternalLink,
  ShoppingCart,
  History,
  AlertCircle,
  Image as ImageIcon,
  XCircle,
  Trash2,
  Ban
} from 'lucide-react'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

interface QuoteLine {
  id: number
  productId: number
  variantId: number | null
  productName: string
  productSku: string | null
  productImage: string | null
  quantity: number
  unitPrice: number
  originalPrice: number | null
  discountPercent: number
  discountAmount: number
  subtotal: number
  notes: string | null
  estimatedDelivery: string | null
}

interface Quote {
  id: number
  quoteNumber: string
  customer: {
    id: number
    code: string
    businessName: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    taxId: string | null
  }
  warehouseId: number | null
  warehouseName: string | null
  pricelistId: number | null
  pricelistName: string | null
  status: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  currency: string
  validUntil: string | null
  notes: string | null
  internalNotes: string | null
  convertedToInvoiceId: number | null
  salesRepId: number | null
  salesRepName: string | null
  salesRepEmail: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  sentAt: string | null
  acceptedAt: string | null
  signatureToken: string | null
  signatureData: string | null
  signedAt: string | null
  signerName: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  lines: QuoteLine[]
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
  sent: {
    label: 'Enviada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: Send,
    step: 1
  },
  accepted: {
    label: 'Aceptada',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle,
    step: 2
  },
  rejected: {
    label: 'Rechazada',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: X,
    step: 1
  },
  expired: {
    label: 'Vencida',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 1
  },
  converted: {
    label: 'Convertida',
    color: 'purple',
    bgGradient: 'from-purple-500 to-indigo-500',
    icon: Receipt,
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
  { key: 'sent', label: 'Enviada', icon: Send },
  { key: 'accepted', label: 'Aceptada', icon: CheckCircle },
  { key: 'converted', label: 'Facturada', icon: Receipt }
]

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const resolvedParams = use(params)
  const quoteId = resolvedParams.id

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [exchangeRate, setExchangeRate] = useState(411)

  // Modals
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPdfDropdown, setShowPdfDropdown] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)

  // Send modal fields
  const [sendEmail, setSendEmail] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [attachPdf, setAttachPdf] = useState(true)
  const [pdfCurrency, setPdfCurrency] = useState<'usd' | 'cup' | 'dual'>('usd')

  const pdfDropdownRef = useRef<HTMLDivElement>(null)
  const linkDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchQuote()
    fetchExchangeRates()
  }, [quoteId])

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(e.target as Node)) {
        setShowPdfDropdown(false)
      }
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(e.target as Node)) {
        setShowLinkDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setQuote(result.data)
          if (result.data.customer?.email) {
            setSendEmail(result.data.customer.email)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/market/pos/exchange-rates')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.rates) {
          setExchangeRate(result.rates.CUP || 411)
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  // ===================== ACTIONS =====================

  const handleSendEmail = async () => {
    if (!quote) return
    setSending(true)

    try {
      let pdfBase64: string | undefined
      if (attachPdf) {
        const pdfDoc = await buildPdf(pdfCurrency)
        const pdfArrayBuffer = pdfDoc.output('arraybuffer')
        const bytes = new Uint8Array(pdfArrayBuffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        pdfBase64 = btoa(binary)
      }

      const signatureUrl = quote.signatureToken
        ? `${window.location.origin}/quote-sign/${quote.signatureToken}`
        : undefined

      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sendEmail || undefined,
          message: sendMessage || undefined,
          pdfBase64,
          signatureUrl
        })
      })

      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Cotización enviada', result.message || 'Cotización enviada exitosamente')
        setShowSendModal(false)
        fetchQuote()
      } else {
        showNotification('error', 'Error', result.error || 'Error al enviar cotización')
      }
    } catch (error) {
      console.error('Error sending quote:', error)
      showNotification('error', 'Error', 'Error de conexión al enviar')
    } finally {
      setSending(false)
    }
  }

  const handleConvert = async () => {
    setConverting(true)
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/convert`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          showNotification('success', 'Convertida', 'Cotización convertida a factura exitosamente')
          router.push(`/dashboard/market/wholesale/invoices/${result.data.invoiceId}`)
        } else {
          showNotification('error', 'Error', result.error || 'Error al convertir')
        }
      }
    } catch (error) {
      console.error('Error converting quote:', error)
      showNotification('error', 'Error', 'Error de conexión')
    } finally {
      setConverting(false)
      setShowConvertModal(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showNotification('error', 'Error', 'Debes indicar un motivo de cancelación')
      return
    }
    setCancelling(true)
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellationReason: cancelReason.trim() })
      })
      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Cancelada', result.message || 'Cotización cancelada exitosamente')
        setShowCancelModal(false)
        setCancelReason('')
        fetchQuote()
      } else {
        showNotification('error', 'Error', result.error || 'Error al cancelar')
      }
    } catch (error) {
      console.error('Error cancelling quote:', error)
      showNotification('error', 'Error', 'Error de conexión')
    } finally {
      setCancelling(false)
    }
  }

  const handleForceDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}?force=true`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Eliminada', result.message || 'Cotización eliminada permanentemente')
        router.push('/dashboard/market/wholesale/quotes')
      } else {
        showNotification('error', 'Error', result.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error deleting quote:', error)
      showNotification('error', 'Error', 'Error de conexión')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const handleGenerateLink = async (mode: 'usd' | 'cup' | 'dual' = 'usd') => {
    if (!quote) return
    setGeneratingLink(true)
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/generate-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          rate: mode !== 'usd' ? exchangeRate : undefined
        })
      })
      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Enlace generado', 'Enlace de firma generado exitosamente')
        fetchQuote()
        // Copy to clipboard
        if (result.data?.url) {
          await navigator.clipboard.writeText(result.data.url)
          setCopiedLink(true)
          setTimeout(() => setCopiedLink(false), 3000)
        }
      } else {
        showNotification('error', 'Error', result.error || 'Error al generar enlace')
      }
    } catch (error) {
      console.error('Error generating link:', error)
      showNotification('error', 'Error', 'Error de conexión')
    } finally {
      setGeneratingLink(false)
      setShowLinkDropdown(false)
    }
  }

  const copySignatureLink = async (mode: 'usd' | 'cup' | 'dual' = 'usd') => {
    if (!quote?.signatureToken) return
    let url = `${window.location.origin}/quote-sign/${quote.signatureToken}`
    const urlParams = new URLSearchParams()
    if (mode && mode !== 'usd') {
      urlParams.set('mode', mode)
    }
    if (exchangeRate && mode !== 'usd') {
      urlParams.set('r', exchangeRate.toString())
    }
    if (urlParams.toString()) {
      url += `?${urlParams.toString()}`
    }
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    showNotification('success', 'Copiado', `Enlace ${mode.toUpperCase()} copiado al portapapeles`)
    setTimeout(() => setCopiedLink(false), 3000)
    setShowLinkDropdown(false)
  }

  // ===================== PDF HELPERS =====================

  const generateBarcodeDataUrl = (code: string): string => {
    try {
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000'
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error generating barcode:', error)
      return ''
    }
  }

  const loadImageAsDataUrl = (src: string): Promise<{ dataUrl: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight })
        } else {
          resolve({ dataUrl: '', width: 0, height: 0 })
        }
      }
      img.onerror = () => resolve({ dataUrl: '', width: 0, height: 0 })
      img.src = src
    })
  }

  // ===================== PDF GENERATION =====================

  const buildPdf = async (mode: 'usd' | 'cup' | 'dual'): Promise<jsPDF> => {
    if (!quote) throw new Error('No quote data')

    // Brand detection
    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const primaryRgb = brandName === 'servisumic' ? [235, 91, 12] : [204, 10, 70]
    const secondaryRgb = brandName === 'servisumic' ? [63, 59, 57] : [3, 96, 229]

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pageWidth = 215.9
    const pageHeight = 279.4
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    let y = 14

    // Load logo
    const logoImg = await loadImageAsDataUrl(brand.logos.light)

    // ---- HEADER: Logo + Title + Barcode ----
    if (logoImg.dataUrl) {
      try {
        const maxH = 18
        const aspect = logoImg.width / logoImg.height
        const logoH = maxH
        const logoW = logoH * aspect
        doc.addImage(logoImg.dataUrl, 'PNG', margin, y, logoW, logoH, undefined, 'FAST')
      } catch { /* skip logo if error */ }
    }

    // Title "OFERTA" on the right side
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2])
    doc.text('OFERTA', pageWidth - margin, y + 6, { align: 'right' })

    // Quote number
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.quoteNumber, pageWidth - margin, y + 14, { align: 'right' })

    // Barcode
    const barcodeCode = quote.quoteNumber.replace(/-/g, '')
    const barcodeDataUrl = generateBarcodeDataUrl(barcodeCode)
    if (barcodeDataUrl) {
      try {
        doc.addImage(barcodeDataUrl, 'PNG', pageWidth - margin - 55, y + 17, 55, 12, undefined, 'FAST')
      } catch { /* skip barcode if error */ }
      // Barcode text
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text(barcodeCode, pageWidth - margin - 27.5, y + 32, { align: 'center' })
    }

    y += 38

    // ---- Orange accent bar ----
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.rect(margin, y, contentWidth, 2, 'F')
    y += 10

    // ---- CLIENT INFO + QUOTE INFO side by side ----
    const leftStartY = y
    const rightX = pageWidth / 2 + 10

    // Client section
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.text('CLIENTE', margin, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    doc.text(quote.customer.businessName, margin, y)
    y += 5

    if (quote.customer.taxId) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.text(`RUC/NIT: ${quote.customer.taxId}`, margin, y)
      y += 5
    }
    if (quote.customer.address) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      const addrLines = doc.splitTextToSize(quote.customer.address, contentWidth / 2 - 10)
      doc.text(addrLines, margin, y)
      y += addrLines.length * 4 + 1
    }
    if (quote.customer.phone) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.text(`Tel: ${quote.customer.phone}`, margin, y)
      y += 5
    }

    // Right side - Quote info
    let rightY = leftStartY

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.text('INFORMACI\u00D3N', rightX, rightY)
    rightY += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(`Fecha: ${formatDate(quote.createdAt)}`, rightX, rightY)
    rightY += 5

    if (quote.validUntil) {
      doc.text(`V\u00E1lida hasta: ${formatDate(quote.validUntil)}`, rightX, rightY)
      rightY += 5
    }
    if (quote.warehouseName) {
      doc.text(`Almac\u00E9n: ${quote.warehouseName}`, rightX, rightY)
      rightY += 5
    }

    const statusLabel = STATUS_CONFIG[quote.status]?.label || quote.status
    doc.text(`Estado: ${statusLabel}`, rightX, rightY)
    rightY += 5

    y = Math.max(y, rightY) + 12

    // ---- TABLE ----
    // Table header with dark background
    const tableHeaderH = 10
    doc.setFillColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2])
    doc.rect(margin, y - 6, contentWidth, tableHeaderH, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)

    // Check if any line has delivery estimate
    const hasDeliveryEstimates = quote.lines.some(l => l.estimatedDelivery)

    if (mode === 'dual') {
      doc.text('PRODUCTO', margin + 4, y)
      doc.text('CANT', margin + 65, y, { align: 'center' })
      if (hasDeliveryEstimates) doc.text('ENTREGA', margin + 85, y, { align: 'center' })
      doc.text('P.UNIT USD', margin + 110, y, { align: 'right' })
      doc.text('P.UNIT CUP', margin + 135, y, { align: 'right' })
      doc.text('TOTAL USD', margin + 155, y, { align: 'right' })
      doc.text('TOTAL CUP', pageWidth - margin - 4, y, { align: 'right' })
    } else if (mode === 'cup') {
      doc.text('PRODUCTO', margin + 4, y)
      doc.text('SKU', margin + 80, y)
      doc.text('CANT', margin + 105, y, { align: 'center' })
      if (hasDeliveryEstimates) doc.text('ENTREGA', margin + 125, y, { align: 'center' })
      doc.text('P.UNIT CUP', margin + 150, y, { align: 'right' })
      doc.text('TOTAL CUP', pageWidth - margin - 4, y, { align: 'right' })
    } else {
      doc.text('PRODUCTO', margin + 4, y)
      doc.text('SKU', margin + 80, y)
      doc.text('CANT', margin + 105, y, { align: 'center' })
      if (hasDeliveryEstimates) doc.text('ENTREGA', margin + 128, y, { align: 'center' })
      doc.text('P.UNIT', margin + 150, y, { align: 'right' })
      doc.text('TOTAL', pageWidth - margin - 4, y, { align: 'right' })
    }
    y += 8

    // Table rows
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)

    for (let i = 0; i < quote.lines.length; i++) {
      if (y > pageHeight - 60) {
        doc.addPage()
        y = 25
      }

      const line = quote.lines[i]

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248)
        doc.rect(margin, y - 4, contentWidth, 7, 'F')
      }

      doc.setTextColor(40, 40, 40)
      const productName = line.productName.length > 35
        ? line.productName.substring(0, 35) + '...'
        : line.productName

      // Delivery text helper
      const deliveryText = (est: string | null | undefined) => {
        if (!est) return ''
        const map: Record<string, string> = { '1-24h': '1-24 h', '1-3d': '1-3 días', '1-30d': '1-30 días' }
        return map[est] || ''
      }

      if (mode === 'dual') {
        doc.text(productName, margin + 4, y)
        doc.text(String(line.quantity), margin + 65, y, { align: 'center' })
        if (hasDeliveryEstimates) doc.text(deliveryText(line.estimatedDelivery), margin + 85, y, { align: 'center' })
        doc.text(`${fmtUSD(line.unitPrice)}`, margin + 110, y, { align: 'right' })
        doc.text(`${lineCupUnit(line).toLocaleString()}`, margin + 135, y, { align: 'right' })
        doc.text(`${fmtUSD(line.subtotal)}`, margin + 155, y, { align: 'right' })
        doc.text(`${lineCupSubtotal(line).toLocaleString()}`, pageWidth - margin - 4, y, { align: 'right' })
      } else if (mode === 'cup') {
        doc.text(productName, margin + 4, y)
        doc.text(line.productSku || '', margin + 80, y)
        doc.text(String(line.quantity), margin + 105, y, { align: 'center' })
        if (hasDeliveryEstimates) doc.text(deliveryText(line.estimatedDelivery), margin + 125, y, { align: 'center' })
        doc.text(`${lineCupUnit(line).toLocaleString()}`, margin + 150, y, { align: 'right' })
        doc.text(`${lineCupSubtotal(line).toLocaleString()}`, pageWidth - margin - 4, y, { align: 'right' })
      } else {
        doc.text(productName, margin + 4, y)
        doc.text((line.productSku || '').substring(0, 15), margin + 80, y)
        doc.text(String(line.quantity), margin + 105, y, { align: 'center' })
        if (hasDeliveryEstimates) doc.text(deliveryText(line.estimatedDelivery), margin + 128, y, { align: 'center' })
        doc.text(`${fmtUSD(line.unitPrice)}`, margin + 150, y, { align: 'right' })
        doc.text(`${fmtUSD(line.subtotal)}`, pageWidth - margin - 4, y, { align: 'right' })
      }
      y += 7
    }

    y += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(margin + 100, y, pageWidth - margin, y)
    y += 8

    // ---- TOTALS ----
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)

    if (mode === 'cup') {
      doc.setFont('helvetica', 'normal')
      doc.text('Subtotal CUP:', margin + 120, y)
      doc.text(`${quoteCupSubtotal().toLocaleString()} CUP`, pageWidth - margin - 4, y, { align: 'right' })
      y += 6

      if (quote.discountPercent > 0) {
        doc.setTextColor(220, 38, 38)
        doc.text(`Descuento (${quote.discountPercent}%):`, margin + 120, y)
        doc.text(`-${quoteCupDiscount().toLocaleString()} CUP`, pageWidth - margin - 4, y, { align: 'right' })
        doc.setTextColor(40, 40, 40)
        y += 6
      }

      y += 3
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
      doc.rect(margin + 100, y - 5, contentWidth - 100, 12, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text('TOTAL CUP:', margin + 105, y + 2)
      doc.text(`${quoteCupTotal().toLocaleString()} CUP`, pageWidth - margin - 4, y + 2, { align: 'right' })
    } else if (mode === 'dual') {
      doc.setFont('helvetica', 'normal')
      doc.text('Subtotal:', margin + 100, y)
      doc.text(`${fmtUSD(quote.subtotal)} / ${quoteCupSubtotal().toLocaleString()} CUP`, pageWidth - margin - 4, y, { align: 'right' })
      y += 6

      if (quote.discountPercent > 0) {
        doc.setTextColor(220, 38, 38)
        doc.text(`Descuento (${quote.discountPercent}%):`, margin + 100, y)
        doc.text(`-${fmtUSD(quote.discountAmount)}`, pageWidth - margin - 4, y, { align: 'right' })
        doc.setTextColor(40, 40, 40)
        y += 6
      }

      y += 3
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
      doc.rect(margin + 80, y - 5, contentWidth - 80, 12, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text('TOTAL:', margin + 85, y + 2)
      doc.text(`${fmtUSD(quote.totalAmount)} USD / ${quoteCupTotal().toLocaleString()} CUP`, pageWidth - margin - 4, y + 2, { align: 'right' })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.text('Subtotal:', margin + 120, y)
      doc.text(`${fmtUSD(quote.subtotal)}`, pageWidth - margin - 4, y, { align: 'right' })
      y += 6

      if (quote.discountPercent > 0) {
        doc.setTextColor(220, 38, 38)
        doc.text(`Descuento (${quote.discountPercent}%):`, margin + 120, y)
        doc.text(`-${fmtUSD(quote.discountAmount)}`, pageWidth - margin - 4, y, { align: 'right' })
        doc.setTextColor(40, 40, 40)
        y += 6
      }

      y += 3
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
      doc.rect(margin + 100, y - 5, contentWidth - 100, 12, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text('TOTAL:', margin + 105, y + 2)
      doc.text(`${fmtUSD(quote.totalAmount)} USD`, pageWidth - margin - 4, y + 2, { align: 'right' })
    }

    y += 20

    // Exchange rate note - only show when document contains USD (dual mode)
    if (mode === 'dual') {
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text(`Tasa de cambio: 1 USD = ${exchangeRate.toLocaleString()} CUP`, margin, y)
      y += 10
    }

    // Notes with orange left border
    if (quote.notes) {
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
      doc.rect(margin, y - 2, 2, 20, 'F')

      doc.setTextColor(40, 40, 40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Notas:', margin + 6, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const splitNotes = doc.splitTextToSize(quote.notes, contentWidth - 10)
      doc.text(splitNotes, margin + 6, y + 7)
      y += Math.max(20, splitNotes.length * 4 + 12)
    }

    // Valid until
    if (quote.validUntil) {
      y += 3
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`V\u00E1lida hasta: ${formatDate(quote.validUntil)}`, margin, y)
      y += 5
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
    }

    // Footer
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado por ${brand.displayName} \u00B7 ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, pageHeight - 12, { align: 'center' })

    return doc
  }

  const buildReceipt = async (mode: 'usd' | 'cup'): Promise<jsPDF> => {
    if (!quote) throw new Error('No quote data')

    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const primaryRgb = brandName === 'servisumic' ? [235, 91, 12] : [204, 10, 70]

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 250] })
    const pageWidth = 80
    const m = 5
    let y = 8

    // Logo
    const logoImg = await loadImageAsDataUrl(brand.logos.light)
    if (logoImg.dataUrl) {
      try {
        const maxH = 12
        const aspect = logoImg.width / logoImg.height
        const logoH = maxH
        const logoW = logoH * aspect
        doc.addImage(logoImg.dataUrl, 'PNG', pageWidth / 2 - logoW / 2, y, logoW, logoH, undefined, 'FAST')
        y += logoH + 4
      } catch { y += 2 }
    }

    // Title
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.text('OFERTA', pageWidth / 2, y, { align: 'center' })
    y += 6

    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(quote.quoteNumber, pageWidth / 2, y, { align: 'center' })
    y += 6

    doc.setLineWidth(0.3)
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.line(m, y, pageWidth - m, y)
    y += 5

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text('Cliente:', m, y)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(quote.customer.businessName.substring(0, 30), m, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Fecha: ${formatDate(quote.createdAt)}`, m, y)
    y += 6

    doc.setDrawColor(200, 200, 200)
    doc.line(m, y, pageWidth - m, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    doc.text('Producto', m, y)
    doc.text('Cant', pageWidth - m - 20, y)
    doc.text('Total', pageWidth - m - 2, y, { align: 'right' })
    y += 4

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    for (const line of quote.lines) {
      const name = line.productName.substring(0, 25)
      doc.text(name, m, y)
      doc.text(String(line.quantity), pageWidth - m - 18, y)
      if (mode === 'cup') {
        doc.text(`${lineCupSubtotal(line).toLocaleString()}`, pageWidth - m, y, { align: 'right' })
      } else {
        doc.text(`${fmtUSD(line.subtotal)}`, pageWidth - m, y, { align: 'right' })
      }
      y += 4
    }
    y += 2

    doc.setDrawColor(200, 200, 200)
    doc.line(m, y, pageWidth - m, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2])
    doc.text('TOTAL:', m, y)
    if (mode === 'cup') {
      doc.text(`${quoteCupTotal().toLocaleString()} CUP`, pageWidth - m, y, { align: 'right' })
    } else {
      doc.text(`${fmtUSD(quote.totalAmount)} USD`, pageWidth - m, y, { align: 'right' })
    }
    y += 8

    // Barcode
    const barcodeCode = quote.quoteNumber.replace(/-/g, '')
    const barcodeDataUrl = generateBarcodeDataUrl(barcodeCode)
    if (barcodeDataUrl) {
      try {
        doc.addImage(barcodeDataUrl, 'PNG', pageWidth / 2 - 30, y, 60, 12, undefined, 'FAST')
        y += 13
        doc.setFontSize(6)
        doc.setTextColor(120, 120, 120)
        doc.setFont('helvetica', 'normal')
        doc.text(barcodeCode, pageWidth / 2, y, { align: 'center' })
        y += 6
      } catch { y += 2 }
    }

    // Footer
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    doc.text(`--- Generado por ${brand.displayName} ---`, pageWidth / 2, y, { align: 'center' })

    doc.internal.pageSize.height = y + 10
    return doc
  }

  const downloadPdf = async (mode: 'usd' | 'cup' | 'dual') => {
    if (!quote) return
    try {
      const doc = await buildPdf(mode)
      doc.save(`${quote.quoteNumber}-${mode}.pdf`)
      showNotification('success', 'PDF descargado', `Cotización en formato ${mode.toUpperCase()} descargada`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      showNotification('error', 'Error', 'No se pudo generar el PDF')
    }
    setShowPdfDropdown(false)
  }

  const downloadReceipt = async (mode: 'usd' | 'cup') => {
    if (!quote) return
    try {
      const doc = await buildReceipt(mode)
      doc.save(`${quote.quoteNumber}-recibo-${mode}.pdf`)
      showNotification('success', 'Recibo descargado', `Recibo en ${mode.toUpperCase()} descargado`)
    } catch (error) {
      console.error('Error generating receipt:', error)
      showNotification('error', 'Error', 'No se pudo generar el recibo')
    }
    setShowPdfDropdown(false)
  }

  // ===================== FORMATTERS =====================

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value)

  const formatCUP = (value: number) =>
    Math.round(value).toLocaleString('en-US') + ' CUP'

  // Calculate CUP from rounded unit prices to get exact integers
  const lineCupUnit = (line: { unitPrice: number }) => Math.round(line.unitPrice * exchangeRate)
  const lineCupSubtotal = (line: { unitPrice: number; quantity: number }) => Math.round(line.unitPrice * exchangeRate) * line.quantity
  const quoteCupSubtotal = () => (quote?.lines || []).reduce((sum: number, l: any) => sum + lineCupSubtotal(l), 0)
  const quoteCupDiscount = () => Math.round(quoteCupSubtotal() * (quote?.discountPercent || 0) / 100)
  const quoteCupTotal = () => quoteCupSubtotal() - quoteCupDiscount()

  // Format USD with up to 3 decimals, no trailing zeros
  const fmtUSD = (value: number) => '$' + value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')

  const formatDate = (date: string | null | undefined) => {
    if (!date) return ''
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      d = new Date(year, month - 1, day)
    } else {
      d = new Date(date)
    }
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // ===================== LOADING / ERROR =====================

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
              <p className="text-gray-500">Cargando cotización...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!quote) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex flex-col items-center justify-center">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-xl font-medium mb-2">Cotización no encontrada</p>
            <Link href="/dashboard/market/wholesale/quotes" className="text-blue-500 hover:underline">
              Volver a cotizaciones
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon
  const totalProducts = quote.lines.length
  const totalUnits = quote.lines.reduce((sum, l) => sum + l.quantity, 0)

  // ===================== RENDER =====================

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* ========== HEADER SECTION ========== */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation Bar */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <Link href="/dashboard/market/wholesale/quotes">
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

              <div className="flex items-center gap-2 flex-wrap">
                {/* PDF Dropdown */}
                <div className="relative" ref={pdfDropdownRef}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPdfDropdown(!showPdfDropdown)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    )}
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-medium text-sm hidden sm:inline">PDF</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.button>

                  <AnimatePresence>
                    {showPdfDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={cn(
                          'absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-xl z-50 overflow-hidden',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="p-1.5">
                          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Carta</p>
                          {(['usd', 'cup', 'dual'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => downloadPdf(m)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              )}
                            >
                              PDF {m === 'dual' ? 'USD + CUP' : m.toUpperCase()}
                            </button>
                          ))}
                          <div className={cn('my-1.5 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
                          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Recibo 80mm</p>
                          {(['usd', 'cup'] as const).map(m => (
                            <button
                              key={`receipt-${m}`}
                              onClick={() => downloadReceipt(m)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              )}
                            >
                              Recibo {m.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Print */}
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
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">Imprimir</span>
                </motion.button>

                {/* Send */}
                {(quote.status === 'draft' || quote.status === 'sent') && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowSendModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </motion.button>
                )}

                {/* Generate/Copy Signature Link Dropdown */}
                {quote.status !== 'converted' && !quote.signedAt && (
                  <div className="relative" ref={linkDropdownRef}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                      disabled={generatingLink}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors',
                        theme === 'dark'
                          ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      )}
                    >
                      {generatingLink ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : copiedLink ? (
                        <Check className="w-4 h-4" />
                      ) : quote.signatureToken ? (
                        <Copy className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {copiedLink ? 'Copiado' : quote.signatureToken ? 'Copiar Enlace' : 'Generar Enlace'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </motion.button>

                    <AnimatePresence>
                      {showLinkDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className={cn(
                            'absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-xl z-50 overflow-hidden',
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          <div className="p-1.5">
                            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                              {quote.signatureToken ? 'Copiar enlace' : 'Generar enlace'}
                            </p>
                            {([
                              { mode: 'usd' as const, label: 'Enlace USD' },
                              { mode: 'cup' as const, label: 'Enlace CUP' },
                              { mode: 'dual' as const, label: 'Enlace USD + CUP' }
                            ]).map(opt => (
                              <button
                                key={opt.mode}
                                onClick={() => quote.signatureToken ? copySignatureLink(opt.mode) : handleGenerateLink(opt.mode)}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Convert */}
                {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted') && !quote.convertedToInvoiceId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConvertModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors"
                  >
                    <Receipt className="w-4 h-4" />
                    <span className="hidden sm:inline">Convertir a Factura</span>
                  </motion.button>
                )}

                {/* Cancel Quote */}
                {['draft', 'sent', 'accepted'].includes(quote.status) && !quote.convertedToInvoiceId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCancelModal(true)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors',
                      theme === 'dark'
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    )}
                  >
                    <Ban className="w-4 h-4" />
                    <span className="hidden sm:inline">Cancelar</span>
                  </motion.button>
                )}

                {/* Delete Quote (only draft or cancelled) */}
                {['draft', 'cancelled'].includes(quote.status) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteModal(true)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 text-red-400 hover:bg-gray-600'
                        : 'bg-gray-100 text-red-600 hover:bg-gray-200'
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Cancellation Banner */}
            {quote.status === 'cancelled' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-4 rounded-xl border flex items-start gap-3',
                  theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                )}
              >
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className={cn('font-semibold', theme === 'dark' ? 'text-red-300' : 'text-red-800')}>
                    Cotización Cancelada
                  </p>
                  {quote.cancellationReason && (
                    <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                      Motivo: {quote.cancellationReason}
                    </p>
                  )}
                  {quote.cancelledAt && (
                    <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-red-500' : 'text-red-500')}>
                      Cancelada el {new Date(quote.cancelledAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Hero Card */}
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
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {quote.quoteNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                        statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Cotización Mayorista</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        {quote.customer.businessName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(quote.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Total</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatCurrency(quote.totalAmount)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ========== CONTENT ========== */}
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
              )}>Ciclo de Vida</h3>

              <div className="relative">
                <div className={cn(
                  'absolute top-6 left-0 right-0 h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />
                <div
                  className={cn('absolute top-6 left-0 h-1 rounded-full transition-all duration-500', `bg-gradient-to-r ${statusConfig.bgGradient}`)}
                  style={{ width: `${Math.max(0, (statusConfig.step / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
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
                { label: 'Total USD', value: formatCurrency(quote.totalAmount), icon: DollarSign, color: 'blue' },
                { label: 'Total CUP', value: formatCUP(quoteCupTotal()), icon: DollarSign, color: 'purple' },
                { label: 'Productos', value: `${totalProducts}`, icon: Package, color: 'emerald', suffix: `${totalUnits} uds` },
                { label: 'Válida hasta', value: quote.validUntil ? formatDate(quote.validUntil) : 'Sin fecha', icon: Calendar, color: 'amber' }
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
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.value}
                    </p>
                    {stat.suffix && <p className="text-xs text-gray-500 mt-0.5">{stat.suffix}</p>}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100')}>
                    <Building2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Cliente</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {quote.customer.businessName}
                    </p>
                    <p className="text-sm text-gray-500">{quote.customer.code}</p>
                  </div>
                  {quote.customer.taxId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">RUC: {quote.customer.taxId}</span>
                    </div>
                  )}
                  {quote.customer.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-500">{quote.customer.address}{quote.customer.city ? `, ${quote.customer.city}` : ''}</span>
                    </div>
                  )}
                  {quote.customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">{quote.customer.email}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Quote Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100')}>
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Cotización</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha:</span>
                    <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(quote.createdAt)}</span>
                  </div>
                  {quote.validUntil && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Válida hasta:</span>
                      <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(quote.validUntil)}</span>
                    </div>
                  )}
                  {quote.warehouseName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Almacén:</span>
                      <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quote.warehouseName}</span>
                    </div>
                  )}
                  {quote.pricelistName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lista precios:</span>
                      <span className="text-blue-600 font-medium">{quote.pricelistName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Creado por:</span>
                    <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quote.createdBy}</span>
                  </div>
                  {quote.salesRepName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Comercial:</span>
                      <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quote.salesRepName}</span>
                    </div>
                  )}
                  {quote.convertedToInvoiceId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Factura:</span>
                      <Link
                        href={`/dashboard/market/wholesale/invoices/${quote.convertedToInvoiceId}`}
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        Ver factura <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Signature Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('p-2 rounded-xl',
                    quote.signedAt
                      ? theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                      : theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <PenTool className={cn('w-5 h-5', quote.signedAt ? 'text-emerald-500' : 'text-purple-500')} />
                  </div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Firma Digital</h3>
                </div>

                {quote.signedAt ? (
                  <div className="space-y-3">
                    <div className={cn(
                      'p-3 rounded-xl text-center',
                      theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                    )}>
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700')}>
                        Firmada
                      </p>
                    </div>
                    {quote.signerName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Firmante:</span>
                        <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quote.signerName}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Fecha:</span>
                      <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDateTime(quote.signedAt)}</span>
                    </div>
                    {quote.signatureData && (
                      <div className={cn('p-2 rounded-lg border', theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white')}>
                        <img src={quote.signatureData} alt="Firma" className="w-full h-20 object-contain" />
                      </div>
                    )}
                  </div>
                ) : quote.signatureToken ? (
                  <div className="space-y-3">
                    <div className={cn(
                      'p-3 rounded-xl text-center',
                      theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
                    )}>
                      <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-amber-300' : 'text-amber-700')}>
                        Enlace generado - Pendiente de firma
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 text-center">Copiar enlace en:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['usd', 'cup', 'dual'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => copySignatureLink(m)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <Copy className="w-3 h-3" />
                          {m === 'dual' ? 'Ambos' : m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={cn(
                      'p-3 rounded-xl text-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <Link2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Sin enlace de firma</p>
                    </div>
                    <p className="text-xs text-gray-500 text-center">Generar enlace en:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['usd', 'cup', 'dual'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => handleGenerateLink(m)}
                          disabled={generatingLink}
                          className={cn(
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-colors',
                            'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                          )}
                        >
                          {generatingLink ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                          {m === 'dual' ? 'Ambos' : m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Products Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="p-6 pb-0">
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100')}>
                    <Package className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Productos ({totalProducts})
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b text-left',
                      theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Producto</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Cant</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">P. Unit USD</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">P. Unit CUP</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Desc.</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Entrega</th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map(line => (
                      <tr key={line.id} className={cn(
                        'border-b transition-colors',
                        theme === 'dark' ? 'border-gray-700 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'
                      )}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              {line.productImage ? (
                                <img src={line.productImage} alt={line.productName} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {line.productName}
                              </p>
                              {line.productSku && (
                                <p className="text-xs text-gray-500">{line.productSku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-medium">{line.quantity}</td>
                        <td className="py-4 px-4 text-right">
                          {line.originalPrice && line.originalPrice !== line.unitPrice ? (
                            <div>
                              <span className="text-xs text-gray-400 line-through block">{formatCurrency(line.originalPrice)}</span>
                              <span className="text-sm font-medium text-blue-600">{formatCurrency(line.unitPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{formatCurrency(line.unitPrice)}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right text-sm text-gray-500">
                          {formatCUP(lineCupUnit(line))}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {line.discountPercent > 0 && (
                            <span className="text-green-600 text-sm font-medium">-{line.discountPercent}%</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {line.estimatedDelivery && (() => {
                            const cfg: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
                              '1-24h': { label: '1-24 h', bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-400' },
                              '1-3d': { label: '1-3 días', bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'bg-amber-900/30', darkText: 'text-amber-400' },
                              '1-30d': { label: '1-30 días', bg: 'bg-red-100', text: 'text-red-700', darkBg: 'bg-red-900/30', darkText: 'text-red-400' }
                            }
                            const c = cfg[line.estimatedDelivery!]
                            if (!c) return null
                            return (
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                theme === 'dark' ? `${c.darkBg} ${c.darkText}` : `${c.bg} ${c.text}`
                              )}>
                                {c.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="font-bold text-blue-600">{formatCurrency(line.subtotal)}</p>
                          <p className="text-xs text-gray-500">{formatCUP(lineCupSubtotal(line))}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Footer */}
              <div className={cn(
                'p-6 border-t',
                theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
              )}>
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal USD:</span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(quote.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal CUP:</span>
                      <span className="text-gray-500">{formatCUP(quoteCupSubtotal())}</span>
                    </div>
                    {quote.discountPercent > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Descuento ({quote.discountPercent}%):</span>
                        <span>-{formatCurrency(quote.discountAmount)}</span>
                      </div>
                    )}
                    <div className={cn(
                      'flex justify-between text-xl font-bold pt-3 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                    )}>
                      <span>Total USD:</span>
                      <span className="text-blue-600">{formatCurrency(quote.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold">
                      <span className="text-gray-500">Total CUP:</span>
                      <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        {formatCUP(quoteCupTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notes */}
            {(quote.notes || quote.internalNotes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quote.notes && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'p-6 rounded-2xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                    )}
                  >
                    <h3 className={cn('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Notas para el Cliente
                    </h3>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap">{quote.notes}</p>
                  </motion.div>
                )}
                {quote.internalNotes && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'p-6 rounded-2xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                    )}
                  >
                    <h3 className={cn('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Notas Internas
                    </h3>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap">{quote.internalNotes}</p>
                  </motion.div>
                )}
              </div>
            )}

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100')}>
                  <History className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Historial de Actividad
                </h3>
              </div>

              <div className="relative">
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
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Cotización creada
                      </p>
                      <p className="text-xs text-gray-500">por {quote.createdBy}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(quote.createdAt)}</p>
                    </div>
                  </div>

                  {/* Sent */}
                  {quote.sentAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        theme === 'dark' ? 'bg-cyan-900/50 ring-4 ring-gray-800' : 'bg-cyan-100 ring-4 ring-white'
                      )}>
                        <Send className="w-4 h-4 text-cyan-500" />
                      </div>
                      <div className="pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Cotización enviada al cliente
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(quote.sentAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Signed */}
                  {quote.signedAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                      )}>
                        <PenTool className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Cotización firmada
                        </p>
                        {quote.signerName && <p className="text-xs text-gray-500">por {quote.signerName}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(quote.signedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Accepted */}
                  {quote.acceptedAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'
                      )}>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Cotización aceptada
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(quote.acceptedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Converted */}
                  {quote.convertedToInvoiceId && (
                    <div className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                        theme === 'dark' ? 'bg-purple-900/50 ring-4 ring-gray-800' : 'bg-purple-100 ring-4 ring-white'
                      )}>
                        <Receipt className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Convertida a factura
                        </p>
                        <Link
                          href={`/dashboard/market/wholesale/invoices/${quote.convertedToInvoiceId}`}
                          className="text-xs text-purple-500 hover:underline"
                        >
                          Ver factura
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ========== MODALS ========== */}

          {/* Send Email Modal */}
          <AnimatePresence>
            {showSendModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowSendModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'rounded-2xl shadow-2xl max-w-lg w-full',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className={cn(
                    'p-6 border-b flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h2 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Enviar Cotización
                    </h2>
                    <button onClick={() => setShowSendModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Email del destinatario
                      </label>
                      <input
                        type="email"
                        value={sendEmail}
                        onChange={(e) => setSendEmail(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Mensaje personalizado (opcional)
                      </label>
                      <textarea
                        value={sendMessage}
                        onChange={(e) => setSendMessage(e.target.value)}
                        rows={3}
                        placeholder="Mensaje adicional para el cliente..."
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attachPdf}
                          onChange={(e) => setAttachPdf(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">Adjuntar PDF</span>
                      </label>

                      {attachPdf && (
                        <select
                          value={pdfCurrency}
                          onChange={(e) => setPdfCurrency(e.target.value as 'usd' | 'cup' | 'dual')}
                          className={cn(
                            'px-3 py-1.5 rounded-lg border text-sm',
                            theme === 'dark'
                              ? 'bg-gray-900 border-gray-700 text-white'
                              : 'bg-white border-gray-200 text-gray-900'
                          )}
                        >
                          <option value="usd">USD</option>
                          <option value="cup">CUP</option>
                          <option value="dual">USD + CUP</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    'p-6 border-t flex gap-3',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <button
                      onClick={() => setShowSendModal(false)}
                      className={cn(
                        'flex-1 py-2.5 px-4 rounded-xl font-medium border transition-colors',
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={sending || !sendEmail}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Convert Modal */}
          <AnimatePresence>
            {showConvertModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowConvertModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'rounded-2xl shadow-2xl max-w-md w-full',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className={cn(
                    'p-6 border-b flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h2 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Convertir a Factura
                    </h2>
                    <button onClick={() => setShowConvertModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                      ¿Estás seguro de que deseas convertir esta cotización en factura?
                    </p>
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className="text-sm"><strong>Cliente:</strong> {quote.customer.businessName}</p>
                      <p className="text-sm"><strong>Total:</strong> {formatCurrency(quote.totalAmount)}</p>
                      <p className="text-sm"><strong>Productos:</strong> {quote.lines.length} items</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowConvertModal(false)}
                        className={cn(
                          'flex-1 py-2.5 px-4 rounded-xl font-medium border transition-colors',
                          theme === 'dark'
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConvert}
                        disabled={converting}
                        className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {converting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Convirtiendo...
                          </>
                        ) : (
                          'Convertir'
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cancel Modal */}
          <AnimatePresence>
            {showCancelModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowCancelModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'rounded-2xl shadow-2xl max-w-md w-full',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className={cn(
                    'p-6 border-b flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h2 className={cn('text-xl font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <Ban className="w-5 h-5 text-red-600" />
                      Cancelar Cotización
                    </h2>
                    <button onClick={() => setShowCancelModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                      ¿Estás seguro de que deseas cancelar esta cotización? Esta acción cambiará su estado a "Cancelada".
                    </p>
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className="text-sm"><strong>{quote.quoteNumber}</strong></p>
                      <p className="text-sm">Cliente: {quote.customer.businessName}</p>
                      <p className="text-sm">Total: {formatCurrency(quote.totalAmount)}</p>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Motivo de cancelación *
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={3}
                        placeholder="Indica por qué se cancela esta cotización..."
                        autoFocus
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-red-500 focus:ring-red-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-red-500 focus:ring-red-500/20'
                        )}
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                        className={cn(
                          'flex-1 py-2.5 px-4 rounded-xl font-medium border transition-colors',
                          theme === 'dark'
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        Volver
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={cancelling || !cancelReason.trim()}
                        className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cancelando...
                          </>
                        ) : (
                          <>
                            <Ban className="w-4 h-4" />
                            Cancelar Cotización
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete Modal */}
          <AnimatePresence>
            {showDeleteModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowDeleteModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'rounded-2xl shadow-2xl max-w-md w-full',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className={cn(
                    'p-6 border-b flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h2 className={cn('text-xl font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <Trash2 className="w-5 h-5 text-red-600" />
                      Eliminar Cotización
                    </h2>
                    <button onClick={() => setShowDeleteModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                    )}>
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-red-300' : 'text-red-800')}>
                            Esta acción es irreversible
                          </p>
                          <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                            La cotización y todos sus datos serán eliminados permanentemente.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className="text-sm"><strong>{quote.quoteNumber}</strong></p>
                      <p className="text-sm">Cliente: {quote.customer.businessName}</p>
                      <p className="text-sm">Total: {formatCurrency(quote.totalAmount)}</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className={cn(
                          'flex-1 py-2.5 px-4 rounded-xl font-medium border transition-colors',
                          theme === 'dark'
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        Volver
                      </button>
                      <button
                        onClick={handleForceDelete}
                        disabled={deleting}
                        className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Eliminando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Eliminar Permanentemente
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
