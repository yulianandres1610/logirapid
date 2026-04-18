'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Receipt,
  CheckCircle,
  Truck,
  DollarSign,
  FileText,
  Clock,
  Printer,
  Plus,
  X,
  Package,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  CreditCard,
  Warehouse,
  FileDown,
  History
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import { detectBrandFromHost, brands } from '@/lib/brand-config'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import PrintDocumentModal from '@/components/print/PrintDocumentModal'
import { cn } from '@/lib/utils'

interface InvoiceLine {
  id: number
  productId: number
  variantId: number | null
  productName: string
  productSku: string | null
  productImage: string | null
  quantity: number
  quantityDelivered: number
  unitPrice: number
  costPrice: number
  originalPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
  warehouseQuantities: Record<string, number>
  notes: string | null
}

interface DeliveryLine {
  id: number
  productId: number
  productName: string
  productSku: string | null
  quantity: number
  quantityDelivered: number
}

interface Delivery {
  id: number
  deliveryNumber: string
  warehouseId: number | null
  warehouseName: string | null
  status: string
  deliveryDate: string | null
  deliveryAddress: string | null
  notes: string | null
  createdBy: string | null
  createdByEmail: string | null
  createdAt: string
  dispatchedAt: string | null
  dispatchedBy: string | null
  dispatchedByEmail: string | null
  deliveredAt: string | null
  deliveredBy: string | null
  deliveredByEmail: string | null
  lines: DeliveryLine[]
}

interface Payment {
  id: number
  paymentNumber: string
  amount: number
  currency: string
  paymentMethod: string
  reference: string | null
  paymentDate: string
  notes: string | null
  createdBy: string | null
  createdAt: string
}

interface Invoice {
  id: number
  invoiceNumber: string
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
  quoteId: number | null
  quoteNumber: string | null
  warehouseId: number | null
  warehouseName: string | null
  pricelistId: number | null
  pricelistName: string | null
  status: string
  paymentStatus: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string
  dueDate: string | null
  notes: string | null
  internalNotes: string | null
  downpaymentType: string | null
  downpaymentValue: number | null
  downpaymentAmount: number | null
  wholesaleExchangeRate: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  paidAt: string | null
  lines: InvoiceLine[]
  deliveries: Delivery[]
  payments: Payment[]
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
  confirmed: {
    label: 'Confirmada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: CheckCircle,
    step: 1
  },
  partial_delivery: {
    label: 'Entrega Parcial',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Truck,
    step: 2
  },
  delivered: {
    label: 'Entregada',
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

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock },
  partial: { label: 'Parcial', color: 'orange', icon: DollarSign },
  paid: { label: 'Pagado', color: 'emerald', icon: CheckCircle },
  overdue: { label: 'Vencido', color: 'red', icon: AlertCircle }
}

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'gray' },
  dispatched: { label: 'Despachada', color: 'blue' },
  in_transit: { label: 'En Tránsito', color: 'amber' },
  delivered: { label: 'Entregada', color: 'emerald' },
  cancelled: { label: 'Cancelada', color: 'red' }
}

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Borrador', icon: FileText },
  { key: 'confirmed', label: 'Confirmada', icon: CheckCircle },
  { key: 'partial_delivery', label: 'En Entrega', icon: Truck },
  { key: 'delivered', label: 'Entregada', icon: Package }
]

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit: 'Crédito',
  zelle: 'Zelle',
  other: 'Otro'
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const invoiceId = resolvedParams.id

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'details')

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    router.push(url.pathname + url.search, { scroll: false })
  }

  // Payment modal state - multi-currency like POS
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  interface PaymentEntry {
    id: string
    method: 'cash' | 'transfer' | 'card' | 'check' | 'zelle'
    currency: 'USD' | 'CUP' | 'MLC'
    amount: number
    amountInUSD: number
    reference?: string
  }
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([])
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer' | 'card' | 'check' | 'zelle'>('cash')
  const [payCurrency, setPayCurrency] = useState<'USD' | 'CUP' | 'MLC'>('USD')
  const [payAmount, setPayAmount] = useState('')
  const [payReference, setPayReference] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [savingPayment, setSavingPayment] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rates, setRates] = useState({ CUP: 300, MLC: 1.2 })

  // Transport state
  const [transports, setTransports] = useState<any[]>([])
  const [showTransportModal, setShowTransportModal] = useState(false)
  const [savingTransport, setSavingTransport] = useState(false)
  const [trDriverName, setTrDriverName] = useState('')
  const [trDriverLastname, setTrDriverLastname] = useState('')
  const [trDriverIdCard, setTrDriverIdCard] = useState('')
  const [trVehicleBrand, setTrVehicleBrand] = useState('')
  const [trVehiclePlate, setTrVehiclePlate] = useState('')
  const [trAmount, setTrAmount] = useState('')
  const [trNotes, setTrNotes] = useState('')

  // Print transport
  const [showPrintTransport, setShowPrintTransport] = useState(false)
  const [printTransportData, setPrintTransportData] = useState<any>(null)

  // Fetch transports when tab changes
  useEffect(() => {
    if (activeTab === 'transport' && invoice) {
      fetchTransports()
    }
  }, [activeTab, invoice?.id])

  const fetchTransports = async () => {
    try {
      const res = await fetch(`/api/market/wholesale/invoices/${invoiceId}/transport`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) setTransports(data.data || [])
      }
    } catch {}
  }

  const handleSaveTransport = async () => {
    if (!trDriverName.trim() || !trDriverLastname.trim() || !trDriverIdCard.trim() || !trVehiclePlate.trim()) return
    setSavingTransport(true)
    try {
      const res = await fetch(`/api/market/wholesale/invoices/${invoiceId}/transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: trDriverName.trim(),
          driverLastname: trDriverLastname.trim(),
          driverIdCard: trDriverIdCard.trim(),
          vehicleBrand: trVehicleBrand.trim(),
          vehiclePlate: trVehiclePlate.trim(),
          amount: parseFloat(trAmount) || 0,
          exchangeRate: rates.CUP,
          notes: trNotes.trim()
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowTransportModal(false)
        setTrDriverName(''); setTrDriverLastname(''); setTrDriverIdCard('')
        setTrVehicleBrand(''); setTrVehiclePlate(''); setTrAmount(''); setTrNotes('')
        fetchTransports()
      }
    } catch {} finally { setSavingTransport(false) }
  }

  const buildTransportPrintData = (transport: any) => {
    if (!invoice) return null
    return {
      transportNumber: transport.transport_number,
      invoiceNumber: invoice.invoiceNumber,
      customer: {
        name: invoice.customer.businessName,
        code: invoice.customer.code,
        phone: invoice.customer.phone,
        address: invoice.customer.address
      },
      driver: {
        name: transport.driver_name,
        lastname: transport.driver_lastname,
        idCard: transport.driver_id_card,
        vehicleBrand: transport.vehicle_brand || '',
        vehiclePlate: transport.vehicle_plate
      },
      products: invoice.lines.map(l => ({
        name: l.productName,
        sku: l.productSku,
        quantity: l.quantity
      })),
      amount: parseFloat(transport.amount) || 0,
      exchangeRate: parseFloat(transport.exchange_rate) || rates.CUP,
      createdAt: transport.created_at,
      notes: transport.notes
    }
  }

  const handlePrintTransport = (transport: any) => {
    const data = buildTransportPrintData(transport)
    if (!data) return
    setPrintTransportData(data)
    setShowPrintTransport(true)
  }

  const handleDownloadTransportPdf = async (transport: any) => {
    const data = buildTransportPrintData(transport)
    if (!data) return
    try {
      const res = await fetch('/api/print-jobs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: 'transport_invoice', documentData: data })
      })
      if (res.ok) {
        const result = await res.json()
        if (result.success && result.data?.pdf) {
          const byteCharacters = atob(result.data.pdf)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Transporte-${transport.transport_number}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch {}
  }

  // Fetch exchange rates
  useEffect(() => {
    fetch('/api/market/pos/exchange-rates')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.rates) {
          setRates({ CUP: data.rates.CUP || 300, MLC: data.rates.MLC || 1.2 })
        }
      })
      .catch(() => {})
  }, [])

  const convertToUSD = (amount: number, currency: 'USD' | 'CUP' | 'MLC'): number => {
    switch (currency) {
      case 'CUP': return amount / rates.CUP
      case 'MLC': return amount / rates.MLC
      default: return amount
    }
  }

  const totalPaidUSD = paymentEntries.reduce((s, p) => s + p.amountInUSD, 0)
  const remainingUSD = (invoice?.amountDue || 0) - totalPaidUSD
  const remainingCUP = Math.round(remainingUSD * rates.CUP)
  const isFullyPaid = remainingUSD <= 0.01

  const isValidRef = payReference.replace(/[^a-zA-Z0-9]/g, '').length === 13

  const addPaymentEntry = () => {
    const num = parseFloat(payAmount)
    if (isNaN(num) || num <= 0) return
    if (payMethod === 'transfer' && !isValidRef) return

    const amountInUSD = convertToUSD(num, payCurrency)
    setPaymentEntries([...paymentEntries, {
      id: Date.now().toString(),
      method: payMethod,
      currency: payCurrency,
      amount: num,
      amountInUSD,
      reference: payMethod === 'transfer' ? payReference.toUpperCase() : undefined
    }])
    setPayAmount('')
    setPayReference('')
  }

  const removePaymentEntry = (id: string) => {
    setPaymentEntries(paymentEntries.filter(p => p.id !== id))
  }

  // ── PDF Generation ──
  const generateBarcodeDataUrl = (code: string): string => {
    try {
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, code, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 5, background: '#ffffff', lineColor: '#000000' })
      return canvas.toDataURL('image/png')
    } catch { return '' }
  }

  const loadImageAsDataUrl = (src: string): Promise<{ dataUrl: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) { ctx.drawImage(img, 0, 0); resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight }) }
        else resolve({ dataUrl: '', width: 0, height: 0 })
      }
      img.onerror = () => resolve({ dataUrl: '', width: 0, height: 0 })
      img.src = src
    })
  }

  const downloadInvoicePdf = async (mode: 'usd' | 'cup') => {
    if (!invoice) return
    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const pr = brandName === 'servisumic' ? [235, 91, 12] : [204, 10, 70]
    const sr = brandName === 'servisumic' ? [63, 59, 57] : [3, 96, 229]
    const cupRate = rates.CUP

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 279.4] })
    doc.setProperties({
      title: `Factura ${invoice.invoiceNumber}`,
      subject: `Factura mayorista ${invoice.invoiceNumber}`,
      creator: 'LogiRapid/Servisumic'
    })
    const pw = 215.9, ph = 279.4, mg = 14, cw = pw - mg * 2
    let y = 14

    const fmtUSD = (n: number) => `$${n.toFixed(2)}`
    const fmtCUP = (n: number) => `${Math.round(n * cupRate).toLocaleString('es-ES')} CUP`

    // Logo
    const logoImg = await loadImageAsDataUrl(brand.logos.light)
    if (logoImg.dataUrl) {
      try {
        const lh = 18, lw = lh * (logoImg.width / logoImg.height)
        doc.addImage(logoImg.dataUrl, 'PNG', mg, y, lw, lh, undefined, 'FAST')
      } catch {}
    }

    // Title
    doc.setFontSize(28); doc.setFont('helvetica', 'bold')
    doc.setTextColor(sr[0], sr[1], sr[2])
    doc.text('FACTURA', pw - mg, y + 6, { align: 'right' })
    doc.setFontSize(12); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal')
    doc.text(invoice.invoiceNumber, pw - mg, y + 14, { align: 'right' })

    // Barcode
    const bc = invoice.invoiceNumber.replace(/-/g, '')
    const bcUrl = generateBarcodeDataUrl(bc)
    if (bcUrl) {
      try { doc.addImage(bcUrl, 'PNG', pw - mg - 55, y + 17, 55, 12, undefined, 'FAST') } catch {}
      doc.setFontSize(7); doc.setTextColor(120, 120, 120)
      doc.text(bc, pw - mg - 27.5, y + 32, { align: 'center' })
    }

    y += 20
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
    doc.text('EMPRESA DE SERVICIOS Y SUMINISTROS DE MATERIALES DE LA CONSTRUCCION SERVISUMIC S.U.R.L.', mg, y)
    y += 3.5; doc.text('NIT: 50004199243', mg, y)
    y += 3.5; doc.text('Carretera a Berroa Km 1.5 al lado del Frigor\u00EDfico  |  facturacion@servisumic.com  |  +5363707599', mg, y)
    y += 14

    // Orange bar
    doc.setFillColor(pr[0], pr[1], pr[2]); doc.rect(mg, y, cw, 2, 'F'); y += 10

    // Client + Invoice info
    const ly = y, rx = pw / 2 + 10
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr[0], pr[1], pr[2])
    doc.text('CLIENTE', mg, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40)
    doc.text(invoice.customer.businessName, mg, y); y += 5
    if (invoice.customer.code) { doc.setFontSize(9); doc.setTextColor(100,100,100); doc.text(`Código: ${invoice.customer.code}`, mg, y); y += 5 }
    if (invoice.customer.taxId) { doc.setFontSize(9); doc.setTextColor(100,100,100); doc.text(`NIT: ${invoice.customer.taxId}`, mg, y); y += 5 }
    if (invoice.customer.address) { doc.setFontSize(9); doc.setTextColor(100,100,100); const al = doc.splitTextToSize(invoice.customer.address, cw/2-10); doc.text(al, mg, y); y += al.length * 4 + 1 }

    let ry = ly
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr[0], pr[1], pr[2])
    doc.text('DETALLES', rx, ry); ry += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40,40,40)
    doc.text(`Fecha: ${new Date(invoice.createdAt).toLocaleDateString('es-ES')}`, rx, ry); ry += 5
    if (invoice.dueDate) { doc.text(`Vencimiento: ${new Date(invoice.dueDate).toLocaleDateString('es-ES')}`, rx, ry); ry += 5 }
    doc.text(`Estado: ${invoice.paymentStatus === 'paid' ? 'Pagada' : invoice.paymentStatus === 'partial' ? 'Pago Parcial' : 'Pendiente'}`, rx, ry); ry += 5
    if (mode === 'cup') { doc.text(`Tasa: 1 USD = ${cupRate} CUP`, rx, ry); ry += 5 }

    y = Math.max(y, ry) + 12

    // Table header
    doc.setFillColor(sr[0], sr[1], sr[2]); doc.rect(mg, y - 6, cw, 10, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
    doc.text('#', mg + 2, y); doc.text('PRODUCTO', mg + 10, y)
    if (mode === 'cup') {
      doc.text('CANT.', mg + 100, y, { align: 'center' })
      doc.text('P.UNIT CUP', mg + 140, y, { align: 'right' })
      doc.text('SUBTOTAL CUP', pw - mg - 4, y, { align: 'right' })
    } else {
      doc.text('CANT.', mg + 100, y, { align: 'center' })
      doc.text('P.UNIT USD', mg + 140, y, { align: 'right' })
      doc.text('SUBTOTAL USD', pw - mg - 4, y, { align: 'right' })
    }
    y += 8

    // Table rows
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    for (let i = 0; i < invoice.lines.length; i++) {
      if (y > ph - 60) { doc.addPage(); y = 25 }
      const line = invoice.lines[i]
      if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(mg, y - 4, cw, 7, 'F') }
      doc.setTextColor(40, 40, 40)
      const name = line.productName.length > 40 ? line.productName.substring(0, 40) + '...' : line.productName
      doc.text(String(i + 1), mg + 2, y)
      doc.text(name, mg + 10, y)
      doc.text(String(line.quantity), mg + 100, y, { align: 'center' })
      if (mode === 'cup') {
        doc.text(Math.round(line.unitPrice * cupRate).toLocaleString('es-ES'), mg + 140, y, { align: 'right' })
        doc.text(Math.round(line.subtotal * cupRate).toLocaleString('es-ES'), pw - mg - 4, y, { align: 'right' })
      } else {
        doc.text(fmtUSD(line.unitPrice), mg + 140, y, { align: 'right' })
        doc.text(fmtUSD(line.subtotal), pw - mg - 4, y, { align: 'right' })
      }
      y += 7
    }

    // Totals
    y += 5; doc.setDrawColor(200, 200, 200); doc.line(mg + 100, y, pw - mg, y); y += 8
    doc.setFontSize(10)
    const sub = mode === 'cup' ? Math.round(invoice.subtotal * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(invoice.subtotal)
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', mg + 120, y); doc.text(sub, pw - mg - 4, y, { align: 'right' }); y += 6

    if (invoice.discountAmount > 0 && invoice.discountPercent <= 100) {
      const disc = mode === 'cup' ? '-' + Math.round(invoice.discountAmount * cupRate).toLocaleString('es-ES') + ' CUP' : '-' + fmtUSD(invoice.discountAmount)
      doc.setTextColor(0, 150, 0)
      doc.text(`Descuento (${invoice.discountPercent}%):`, mg + 100, y); doc.text(disc, pw - mg - 4, y, { align: 'right' }); y += 6
    }

    y += 2
    doc.setFillColor(pr[0], pr[1], pr[2]); doc.rect(mg + 90, y - 5, cw - 90, 12, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
    const total = mode === 'cup' ? Math.round(invoice.totalAmount * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(invoice.totalAmount)
    doc.text('TOTAL:', mg + 95, y + 2); doc.text(total, pw - mg - 8, y + 2, { align: 'right' })
    y += 16

    // Payment info with individual payment breakdown
    if (invoice.amountPaid > 0 && invoice.payments.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
      doc.text('Detalle de Pagos:', mg, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
      for (const p of invoice.payments) {
        const methodLabel = ({ cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', check: 'Cheque', zelle: 'Zelle' } as Record<string, string>)[p.paymentMethod] || p.paymentMethod
        const origNote = p.notes?.match(/Original: (.+?)(\s*\||$)/)?.[1]
        const amountText = mode === 'cup' ? Math.round(p.amount * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(p.amount)
        let line = `${p.paymentNumber} · ${methodLabel} · ${amountText}`
        if (origNote) line += ` (${origNote})`
        if (p.reference) line += ` · Ref: ${p.reference}`
        doc.text(line, mg + 4, y); y += 4
      }
      y += 3
      doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      const paid = mode === 'cup' ? Math.round(invoice.amountPaid * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(invoice.amountPaid)
      const due = mode === 'cup' ? Math.round(invoice.amountDue * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(invoice.amountDue)
      doc.text(`Total Pagado: ${paid}`, mg + 100, y); y += 5
      if (invoice.amountDue > 0.01) { doc.setTextColor(200, 100, 0); doc.text(`Pendiente: ${due}`, mg + 100, y); y += 5 }
      y += 5
    } else if (invoice.amountPaid > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
      const paid = mode === 'cup' ? Math.round(invoice.amountPaid * cupRate).toLocaleString('es-ES') + ' CUP' : fmtUSD(invoice.amountPaid)
      doc.text(`Pagado: ${paid}`, mg + 120, y); y += 10
    }

    // Notes section
    if (invoice.notes) {
      y += 2
      doc.setFillColor(245, 245, 245); doc.rect(mg, y - 3, cw, 6 + Math.ceil(invoice.notes.length / 80) * 4, 'F')
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
      doc.text('Nota:', mg + 3, y + 1)
      doc.setFont('helvetica', 'normal')
      const noteLines = doc.splitTextToSize(invoice.notes, cw - 20)
      doc.text(noteLines, mg + 15, y + 1)
      y += noteLines.length * 4 + 8
    }

    // Footer
    y = Math.max(y, ph - 40)
    doc.setDrawColor(200, 200, 200); doc.line(mg, y, pw - mg, y); y += 6
    doc.setFontSize(7); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal')
    doc.text('Empresa de Servicios y Suministros MPM SERVISUMIC S.U.R.L. a la Cuenta No: 0533445000023216', mg, y); y += 3.5
    doc.text('NIT: 50004199243', mg, y); y += 5
    doc.text('\u2706 Carretera a Berroa Km 1.5 al lado del Frigorífico    \u2709 facturacion@servisumic.com    \u260E +5363707599', mg, y)

    doc.save(`${invoice.invoiceNumber}-${mode}.pdf`)
  }

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setInvoice(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const result = await response.json()
      if (!response.ok) {
        const stockErrors = result.data?.insufficientStock
        if (stockErrors && stockErrors.length > 0) {
          const details = stockErrors.map((s: any) => `• ${s.product}: necesita ${s.required}, disponible ${s.available} (${s.warehouseName})`).join('\n')
          alert(`Stock insuficiente:\n\n${details}`)
        } else {
          alert(result.error || 'Error al confirmar factura')
        }
      } else {
        alert(result.message || 'Factura confirmada y entrega creada')
      }
      fetchInvoice()
    } catch (error) {
      console.error('Error confirming invoice:', error)
      alert('Error de conexión al confirmar')
    } finally {
      setConfirming(false)
    }
  }

  const handleRegisterPayment = async () => {
    if (paymentEntries.length === 0) return
    setSavingPayment(true)
    try {
      // Send ALL payments in a single request (batch)
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: paymentEntries.map(entry => ({
            amount: entry.amountInUSD,
            paymentMethod: entry.method,
            currency: entry.currency,
            originalAmount: entry.amount,
            reference: entry.reference || null,
            notes: entry.currency !== 'USD' ? `${entry.amount} ${entry.currency} @ ${entry.currency === 'CUP' ? rates.CUP : rates.MLC}` : null
          })),
          paymentDate: payDate
        })
      })

      const result = await response.json()
      if (response.ok && result.success) {
        setShowPaymentModal(false)
        setPaymentEntries([])
        setPayAmount('')
        setPayReference('')
        fetchInvoice()
      } else {
        alert(result.error || 'Error al registrar pagos')
      }
    } catch (error) {
      console.error('Error registering payment:', error)
      alert('Error de conexión')
    } finally {
      setSavingPayment(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate delivery progress
  const calculateDeliveryProgress = () => {
    if (!invoice) return { progress: 0, delivered: 0, total: 0 }

    const total = invoice.lines.reduce((sum, line) => sum + line.quantity, 0)
    const delivered = invoice.lines.reduce((sum, line) => sum + (line.quantityDelivered || 0), 0)
    const progress = total > 0 ? (delivered / total) * 100 : 0

    return { progress, delivered, total }
  }

  // Get current lifecycle step based on status
  const getCurrentStep = () => {
    if (!invoice) return 0
    const step = STATUS_CONFIG[invoice.status]?.step || 0
    return step
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

  if (!invoice) {
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
                <Receipt className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Factura no encontrada
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta factura.</p>
              <Link href="/dashboard/market/wholesale/invoices">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a facturas
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft
  const paymentConfig = PAYMENT_STATUS_CONFIG[invoice.paymentStatus] || PAYMENT_STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon
  const PaymentIcon = paymentConfig.icon
  const deliveryMetrics = calculateDeliveryProgress()
  const currentStep = getCurrentStep()
  const totalItems = invoice.lines.length
  const totalUnits = invoice.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/wholesale/invoices">
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
                {/* Print Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(`/dashboard/market/wholesale/invoices/${invoice.id}/print?format=letter`, '_blank')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="Imprimir factura"
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">Imprimir</span>
                </motion.button>

                {/* PDF Download buttons */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadInvoicePdf('usd')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="Descargar PDF en USD"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">PDF USD</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadInvoicePdf('cup')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  )}
                  title="Descargar PDF en CUP"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">PDF CUP</span>
                </motion.button>

                {/* Confirm Button - only for draft invoices (unpaid, no delivery yet) */}
                {invoice.deliveries.length === 0 && invoice.status === 'draft' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {confirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Crear Entrega
                  </motion.button>
                )}

                {/* Register Payment Button */}
                {invoice.paymentStatus !== 'paid' && invoice.status !== 'cancelled' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium"
                  >
                    <DollarSign className="w-4 h-4" />
                    Registrar Pago
                  </motion.button>
                )}
              </div>
            </div>

            {/* Invoice Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Invoice Info */}
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
                        {invoice.invoiceNumber}
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
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        paymentConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        paymentConfig.color === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                        paymentConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        paymentConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <PaymentIcon className="w-3.5 h-3.5" />
                        {paymentConfig.label}
                      </span>
                    </div>
                    <p className={cn(
                      'text-lg font-medium',
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                    )}>
                      {invoice.customer.businessName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Cliente: {invoice.customer.code} | Creada: {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Right: Total Amount */}
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Total Factura</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatCurrency(invoice.totalAmount)}
                  </p>
                  {invoice.amountDue > 0 && invoice.amountDue < invoice.totalAmount && (
                    <p className="text-sm text-amber-500 mt-1">
                      Pendiente: {formatCurrency(invoice.amountDue)}
                    </p>
                  )}
                </div>
              </div>

              {/* Lifecycle Progress */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const StepIcon = step.icon
                    const isCompleted = currentStep > index
                    const isCurrent = currentStep === index

                    return (
                      <div key={step.key} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center flex-1">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: isCurrent ? 1.1 : 1,
                              backgroundColor: isCompleted || isCurrent
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                            }}
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                              (isCompleted || isCurrent) && 'shadow-lg shadow-emerald-500/25'
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <StepIcon className={cn(
                                "w-5 h-5",
                                isCurrent ? 'text-white' : 'text-gray-500'
                              )} />
                            )}
                          </motion.div>
                          <span className={cn(
                            "text-xs font-medium text-center",
                            (isCompleted || isCurrent)
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500'
                          )}>
                            {step.label}
                          </span>
                        </div>
                        {index < LIFECYCLE_STEPS.length - 1 && (
                          <div className="flex-1 h-0.5 mx-2 mb-6">
                            <div className={cn(
                              "h-full rounded-full",
                              isCompleted
                                ? 'bg-emerald-500'
                                : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            )} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { key: 'details', label: 'Detalles', icon: FileText },
                { key: 'deliveries', label: 'Entregas', icon: Truck, count: invoice.deliveries.length },
                { key: 'payments', label: 'Pagos', icon: CreditCard, count: invoice.payments.length },
                { key: 'transport', label: 'Transporte', icon: Truck }
              ].map(tab => {
                const TabIcon = tab.icon
                return (
                  <motion.button
                    key={tab.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap',
                      activeTab === tab.key
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs',
                        activeTab === tab.key
                          ? 'bg-white/20'
                          : 'bg-gray-200 dark:bg-gray-700'
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                        )}>
                          <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Productos</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{totalItems}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                        )}>
                          <History className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Unidades</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{totalUnits}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                        )}>
                          <Truck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Entregado</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{deliveryMetrics.progress.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${deliveryMetrics.progress}%` }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                        )}>
                          <DollarSign className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Por Cobrar</p>
                          <p className={cn(
                            'text-xl font-bold',
                            invoice.amountDue > 0 ? 'text-amber-500' : 'text-emerald-500'
                          )}>{formatCurrency(invoice.amountDue)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Warehouse Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Customer Card */}
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Building2 className="w-5 h-5 text-blue-500" />
                        Cliente
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className={cn(
                            'font-medium text-lg',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {invoice.customer.businessName}
                          </p>
                          <p className="text-sm text-gray-500 font-mono">{invoice.customer.code}</p>
                        </div>
                        {invoice.customer.taxId && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <FileText className="w-4 h-4" />
                            RNC/Cédula: {invoice.customer.taxId}
                          </div>
                        )}
                        {invoice.customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Phone className="w-4 h-4" />
                            {invoice.customer.phone}
                          </div>
                        )}
                        {invoice.customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Mail className="w-4 h-4" />
                            {invoice.customer.email}
                          </div>
                        )}
                        {invoice.customer.address && (
                          <div className="flex items-start gap-2 text-sm text-gray-500">
                            <MapPin className="w-4 h-4 mt-0.5" />
                            <span>{invoice.customer.address}{invoice.customer.city ? `, ${invoice.customer.city}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice Info Card */}
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Receipt className="w-5 h-5 text-emerald-500" />
                        Información
                      </h3>
                      <div className="space-y-3">
                        {invoice.warehouseName && (
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Almacén:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.warehouseName}</span>
                          </div>
                        )}
                        {invoice.pricelistName && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Lista de precios:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.pricelistName}</span>
                          </div>
                        )}
                        {invoice.quoteNumber && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Cotización:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.quoteNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Creada:</span>
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{formatDateTime(invoice.createdAt)}</span>
                        </div>
                        {invoice.dueDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Vencimiento:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatDate(invoice.dueDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Creada por:</span>
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{invoice.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className={cn(
                    'rounded-xl border overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className={cn(
                        'font-semibold flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Package className="w-5 h-5 text-blue-500" />
                        Productos ({invoice.lines.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn(
                            'border-b',
                            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                          )}>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Unidad</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entregado</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Precio</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {invoice.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {line.productImage ? (
                                    <Image
                                      src={line.productImage}
                                      alt={line.productName}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className={cn(
                                      'w-10 h-10 rounded-lg flex items-center justify-center',
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                    )}>
                                      <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className={cn(
                                      'font-medium text-sm',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {line.productName}
                                    </p>
                                    {line.productSku && (
                                      <p className="text-xs text-gray-500 font-mono">{line.productSku}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {line.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="text-sm text-gray-500">{(line as any).unit || 'unidad'}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
                                  line.quantityDelivered >= line.quantity
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : line.quantityDelivered > 0
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                )}>
                                  {line.quantityDelivered || 0} / {line.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(line.unitPrice)}
                                </span>
                                {line.originalPrice > 0 && line.unitPrice < line.originalPrice && (
                                  <span className="text-xs text-emerald-500 block">
                                    -{Math.round(((line.originalPrice - line.unitPrice) / line.originalPrice) * 100)}%
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={cn(
                                  'font-bold',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(line.subtotal)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn(
                          'border-t-2',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right text-gray-500">Subtotal:</td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                              {formatCurrency(invoice.subtotal)}
                            </td>
                          </tr>
                          {invoice.discountAmount > 0 && invoice.discountPercent > 0 && invoice.discountPercent <= 100 && (
                            <tr>
                              <td colSpan={4} className="py-2 px-4 text-right text-gray-500">
                                Descuento ({invoice.discountPercent}%):
                              </td>
                              <td className="py-2 px-4 text-right font-medium text-emerald-500">
                                -{formatCurrency(invoice.discountAmount)}
                              </td>
                            </tr>
                          )}
                          <tr className={cn(
                            'text-lg',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                          )}>
                            <td colSpan={4} className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">
                              TOTAL:
                            </td>
                            <td className="py-4 px-4 text-right font-bold text-2xl text-gray-900 dark:text-white">
                              {formatCurrency(invoice.totalAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  {(invoice.notes || invoice.internalNotes) && (
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <FileText className="w-5 h-5 text-gray-500" />
                        Notas
                      </h3>
                      {invoice.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Notas para el cliente:</p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>{invoice.notes}</p>
                        </div>
                      )}
                      {invoice.internalNotes && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Notas internas:</p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>{invoice.internalNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'deliveries' && (
                <motion.div
                  key="deliveries"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {invoice.deliveries.length === 0 ? (
                    <div className={cn(
                      'p-12 rounded-xl border text-center',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <Truck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className={cn(
                        'font-medium mb-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>No hay entregas registradas</p>
                      <p className="text-sm text-gray-500">
                        Las entregas se crean desde las operaciones de almacén
                      </p>
                    </div>
                  ) : (
                    invoice.deliveries.map((delivery) => {
                      const deliveryStatus = DELIVERY_STATUS_CONFIG[delivery.status] || DELIVERY_STATUS_CONFIG.pending

                      return (
                        <motion.div
                          key={delivery.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'p-6 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                deliveryStatus.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
                                deliveryStatus.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                                deliveryStatus.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30',
                                deliveryStatus.color === 'gray' && 'bg-gray-100 dark:bg-gray-700',
                                deliveryStatus.color === 'red' && 'bg-red-100 dark:bg-red-900/30'
                              )}>
                                <Truck className={cn(
                                  'w-6 h-6',
                                  deliveryStatus.color === 'emerald' && 'text-emerald-600',
                                  deliveryStatus.color === 'blue' && 'text-blue-600',
                                  deliveryStatus.color === 'amber' && 'text-amber-600',
                                  deliveryStatus.color === 'gray' && 'text-gray-500',
                                  deliveryStatus.color === 'red' && 'text-red-600'
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-bold font-mono',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {delivery.deliveryNumber}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {delivery.warehouseName || 'Sin almacén asignado'}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              'px-3 py-1 rounded-lg text-sm font-medium',
                              deliveryStatus.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              deliveryStatus.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              deliveryStatus.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              deliveryStatus.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
                              deliveryStatus.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              {deliveryStatus.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                            <div>
                              <p className="text-gray-500">Creada</p>
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {formatDateTime(delivery.createdAt)}
                              </p>
                            </div>
                            {delivery.createdBy && (
                              <div>
                                <p className="text-gray-500">Creada por</p>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {delivery.createdBy}
                                </p>
                              </div>
                            )}
                            {delivery.dispatchedAt && (
                              <div>
                                <p className="text-gray-500">Despachada</p>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {formatDateTime(delivery.dispatchedAt)}
                                </p>
                                {delivery.dispatchedBy && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    por {delivery.dispatchedBy}
                                  </p>
                                )}
                              </div>
                            )}
                            {delivery.deliveredAt && (
                              <div>
                                <p className="text-gray-500">Entregada</p>
                                <p className={cn('font-medium text-emerald-600')}>
                                  {formatDateTime(delivery.deliveredAt)}
                                </p>
                                {delivery.deliveredBy && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    por {delivery.deliveredBy}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {delivery.lines && delivery.lines.length > 0 && (
                            <div className={cn(
                              'p-4 rounded-lg',
                              theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            )}>
                              <p className="text-sm font-medium text-gray-500 mb-2">Productos:</p>
                              <div className="space-y-2">
                                {delivery.lines.map((line, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className={cn(
                                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                    )}>
                                      {line.productName}
                                    </span>
                                    <span className={cn(
                                      'font-medium',
                                      line.quantityDelivered >= line.quantity
                                        ? 'text-emerald-600'
                                        : 'text-amber-600'
                                    )}>
                                      {line.quantityDelivered} / {line.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </motion.div>
              )}

              {activeTab === 'payments' && (
                <motion.div
                  key="payments"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {/* Payment Summary */}
                  <div className={cn(
                    'p-6 rounded-xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total Factura</p>
                        <p className={cn(
                          'text-2xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formatCurrency(invoice.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Pagado</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(invoice.amountPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Pendiente</p>
                        <p className={cn(
                          'text-2xl font-bold',
                          invoice.amountDue > 0 ? 'text-amber-500' : 'text-emerald-500'
                        )}>
                          {formatCurrency(invoice.amountDue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payments List */}
                  {invoice.payments.length === 0 ? (
                    <div className={cn(
                      'p-12 rounded-xl border text-center',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className={cn(
                        'font-medium mb-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>No hay pagos registrados</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Registra un pago para actualizar el saldo
                      </p>
                      {invoice.paymentStatus !== 'paid' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowPaymentModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Pago
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    invoice.payments.map((payment) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-6 rounded-xl border',
                          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <DollarSign className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                              <p className={cn(
                                'font-bold font-mono',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {payment.paymentNumber}
                              </p>
                              <p className="text-sm text-gray-500">
                                {PAYMENT_METHODS[payment.paymentMethod] || payment.paymentMethod}
                                {payment.reference && ` - Ref: ${payment.reference}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {(() => {
                              // Parse original amount from notes: "Original: 14,679 CUP"
                              const origMatch = payment.notes?.match(/Original:\s*(.+?)\s*(CUP|MLC|USD)/)
                              const originalAmount = origMatch ? `${origMatch[1]} ${origMatch[2]}` : null
                              const origCurrency = origMatch?.[2]
                              // Determine if payment was in foreign currency
                              const isForeignCurrency = origCurrency && origCurrency !== 'USD'
                              return (
                                <>
                                  {isForeignCurrency && originalAmount ? (
                                    <>
                                      <p className="text-2xl font-bold text-emerald-600">
                                        {originalAmount}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        ({formatCurrency(payment.amount)} USD)
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-2xl font-bold text-emerald-600">
                                      {formatCurrency(payment.amount)}
                                    </p>
                                  )}
                                </>
                              )
                            })()}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(payment.paymentDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          {payment.createdBy ? (
                            <p className="text-xs text-gray-400">Por: {payment.createdBy}</p>
                          ) : <span />}
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                            payment.currency === 'CUP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : payment.currency === 'MLC' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400')}>
                            {payment.currency || 'USD'}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
              {/* Transport Tab */}
              {activeTab === 'transport' && (
                <motion.div key="transport" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Transporte</h3>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowTransportModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                    >
                      <Plus className="w-4 h-4" /> Crear Transporte
                    </motion.button>
                  </div>

                  {transports.length === 0 ? (
                    <div className={cn('rounded-2xl border p-12 text-center', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                      <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">Sin transportes registrados</p>
                      <p className="text-sm text-gray-400 mt-1">Crea un transporte para esta factura</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transports.map((t: any, i: number) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={cn('rounded-xl border p-4', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">{t.transport_number}</p>
                                <p className="text-xs text-gray-500">{t.driver_name} {t.driver_lastname} · CI: {t.driver_id_card}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                {Math.round(parseFloat(t.amount) || 0).toLocaleString('es-ES')} CUP
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(t.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-gray-400">Vehiculo</p>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.vehicle_brand || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Placa</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{t.vehicle_plate}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Carnet</p>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.driver_id_card}</p>
                            </div>
                            <div className="flex items-end justify-end gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDownloadTransportPdf(t)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                              >
                                <FileDown className="w-3.5 h-3.5" /> Descargar PDF
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePrintTransport(t)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              >
                                <Printer className="w-3.5 h-3.5" /> Imprimir
                              </motion.button>
                            </div>
                          </div>

                          {t.notes && (
                            <p className="mt-2 text-xs text-gray-400 italic">{t.notes}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Transport Modal */}
          <AnimatePresence>
            {showTransportModal && invoice && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowTransportModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className={cn("w-full max-w-lg rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )} onClick={(e) => e.stopPropagation()}>
                    <div className={cn("px-6 py-4 border-b flex items-center justify-between sticky top-0 z-10",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Truck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Crear Transporte</h3>
                          <p className="text-xs text-gray-500">Factura {invoice.invoiceNumber}</p>
                        </div>
                      </div>
                      <button onClick={() => setShowTransportModal(false)}
                        className={cn("p-2 rounded-lg", theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nombre *</label>
                          <input type="text" value={trDriverName} onChange={e => setTrDriverName(e.target.value)}
                            placeholder="Nombre del chofer"
                            className={cn('w-full px-3 py-2 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Apellidos *</label>
                          <input type="text" value={trDriverLastname} onChange={e => setTrDriverLastname(e.target.value)}
                            placeholder="Apellidos"
                            className={cn('w-full px-3 py-2 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Carnet de Identidad *</label>
                        <input type="text" value={trDriverIdCard} onChange={e => setTrDriverIdCard(e.target.value)}
                          placeholder="00000000000" maxLength={11}
                          className={cn('w-full px-3 py-2 rounded-xl border text-sm font-mono', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Marca de Vehiculo</label>
                          <input type="text" value={trVehicleBrand} onChange={e => setTrVehicleBrand(e.target.value)}
                            placeholder="ej: Hyundai, Toyota"
                            className={cn('w-full px-3 py-2 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Placa *</label>
                          <input type="text" value={trVehiclePlate} onChange={e => setTrVehiclePlate(e.target.value.toUpperCase())}
                            placeholder="P123456"
                            className={cn('w-full px-3 py-2 rounded-xl border text-sm font-mono uppercase', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monto del Transporte (CUP)</label>
                        <input type="number" value={trAmount} onChange={e => setTrAmount(e.target.value)}
                          placeholder="0"
                          className={cn('w-full px-3 py-2 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        {trAmount && parseFloat(trAmount) > 0 && rates.CUP > 0 && (
                          <p className="text-xs text-gray-400 mt-1">~${(parseFloat(trAmount) / rates.CUP).toFixed(2)} USD (tasa: {rates.CUP})</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Observaciones</label>
                        <textarea value={trNotes} onChange={e => setTrNotes(e.target.value)}
                          placeholder="Notas adicionales..." rows={2}
                          className={cn('w-full px-3 py-2 rounded-xl border text-sm resize-none', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                    </div>

                    <div className={cn("px-6 py-4 border-t flex gap-3", theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <button onClick={() => setShowTransportModal(false)}
                        className={cn('py-3 px-4 rounded-xl font-medium', theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveTransport}
                        disabled={savingTransport || !trDriverName.trim() || !trDriverLastname.trim() || !trDriverIdCard.trim() || !trVehiclePlate.trim()}
                        className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingTransport ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        {savingTransport ? 'Guardando...' : 'Crear Transporte'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Print Transport Modal */}
          {showPrintTransport && printTransportData && (
            <PrintDocumentModal
              isOpen={showPrintTransport}
              onClose={() => setShowPrintTransport(false)}
              documentType={'transport_invoice' as any}
              documentData={printTransportData}
              documentTitle={`Factura Transporte ${printTransportData.transportNumber}`}
              sourceType="transport"
              sourceId={parseInt(invoiceId)}
            />
          )}

          {/* Payment Modal */}
          <AnimatePresence>
            {showPaymentModal && invoice && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowPaymentModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className={cn("w-full max-w-lg rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )} onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className={cn("px-6 py-4 border-b flex items-center justify-between sticky top-0 z-10",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Registrar Pago</h3>
                          <p className="text-xs text-gray-500">
                            Pendiente: {formatCurrency(invoice.amountDue)} USD
                            {' '}({Math.round(invoice.amountDue * rates.CUP).toLocaleString('es-ES')} CUP)
                          </p>
                        </div>
                      </div>
                      <button onClick={() => { setShowPaymentModal(false); setPaymentEntries([]) }}
                        className={cn("p-2 rounded-lg transition-colors", theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Remaining amount */}
                      <div className={cn("p-4 rounded-xl text-center",
                        isFullyPaid ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20')}>
                        <p className="text-xs text-gray-500 mb-1">{isFullyPaid ? 'Pagado completo' : 'Restante'}</p>
                        <p className={cn("text-2xl font-bold", isFullyPaid ? 'text-emerald-600' : 'text-amber-600')}>
                          {isFullyPaid ? 'Completo' : `$${Math.max(0, remainingUSD).toFixed(2)} USD`}
                        </p>
                        {!isFullyPaid && remainingCUP > 0 && (
                          <p className="text-sm text-gray-500">{remainingCUP.toLocaleString('es-ES')} CUP</p>
                        )}
                      </div>

                      {/* Currency selector */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-500">Moneda</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['USD', 'CUP', 'MLC'] as const).map(c => (
                            <button key={c} onClick={() => setPayCurrency(c)}
                              className={cn("py-2.5 rounded-xl text-sm font-bold transition-all border",
                                payCurrency === c
                                  ? 'bg-emerald-500 text-white border-emerald-500'
                                  : theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
                              )}>
                              {c} {c === 'CUP' ? `(${rates.CUP})` : c === 'MLC' ? `(${rates.MLC})` : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Method selector */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-500">Método</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { id: 'cash', label: 'Efectivo' },
                            { id: 'transfer', label: 'Transfer.' },
                            { id: 'card', label: 'Tarjeta' }
                          ] as const).map(m => (
                            <button key={m.id} onClick={() => setPayMethod(m.id as any)}
                              className={cn("py-2.5 rounded-xl text-sm font-medium transition-all border",
                                payMethod === m.id
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
                              )}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Amount input */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-500">
                          Monto en {payCurrency}
                        </label>
                        <div className="flex gap-2">
                          <input type="number" step="0.01" value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder={payCurrency === 'CUP' ? remainingCUP.toLocaleString() : remainingUSD > 0 ? remainingUSD.toFixed(2) : '0'}
                            onKeyDown={(e) => e.key === 'Enter' && addPaymentEntry()}
                            className={cn('flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 text-lg font-bold',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )} />
                          <button onClick={addPaymentEntry}
                            disabled={!payAmount || parseFloat(payAmount) <= 0 || (payMethod === 'transfer' && !isValidRef)}
                            className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-emerald-600 transition-colors">
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        {payAmount && parseFloat(payAmount) > 0 && payCurrency !== 'USD' && (
                          <p className="text-xs text-gray-400 mt-1">
                            = ${convertToUSD(parseFloat(payAmount), payCurrency).toFixed(2)} USD
                          </p>
                        )}
                      </div>

                      {/* Transfer reference - 13 chars required */}
                      {payMethod === 'transfer' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Código de confirmación <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input type="text" value={payReference}
                              onChange={(e) => setPayReference(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 13))}
                              placeholder="13 caracteres alfanuméricos"
                              className={cn('w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 font-mono text-lg tracking-widest',
                                isValidRef ? 'border-emerald-500 focus:ring-emerald-500/20'
                                  : payReference.length > 0 ? 'border-amber-500 focus:ring-amber-500/20'
                                  : theme === 'dark' ? 'border-gray-600' : 'border-gray-200',
                                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900')} />
                            <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold',
                              isValidRef ? 'text-emerald-500' : 'text-gray-400')}>
                              {payReference.length}/13
                            </span>
                          </div>
                          {payReference.length > 0 && !isValidRef && (
                            <p className="text-xs text-amber-500 mt-1">Faltan {13 - payReference.length} caracteres</p>
                          )}
                        </div>
                      )}

                      {/* Payment date */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-500">Fecha</label>
                        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900')} />
                      </div>

                      {/* Payment entries list */}
                      {paymentEntries.length > 0 && (
                        <div className={cn("rounded-xl border divide-y",
                          theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-100')}>
                          {paymentEntries.map(entry => (
                            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                              <div>
                                <span className="text-sm font-bold">{entry.amount.toLocaleString('es-ES')} {entry.currency}</span>
                                <span className="text-xs text-gray-400 ml-2">
                                  {entry.method === 'cash' ? 'Efectivo' : entry.method === 'transfer' ? 'Transferencia' : entry.method === 'card' ? 'Tarjeta' : entry.method}
                                </span>
                                {entry.reference && <span className="text-xs text-blue-400 ml-1">({entry.reference})</span>}
                                {entry.currency !== 'USD' && (
                                  <p className="text-xs text-gray-400">= ${entry.amountInUSD.toFixed(2)} USD</p>
                                )}
                              </div>
                              <button onClick={() => removePaymentEntry(entry.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30">
                                <X className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          ))}
                          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 flex justify-between text-sm font-bold">
                            <span>Total pagos:</span>
                            <span className="text-emerald-600">${totalPaidUSD.toFixed(2)} USD</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className={cn("flex gap-3 p-6 pt-4 border-t sticky bottom-0",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                      <button onClick={() => { setShowPaymentModal(false); setPaymentEntries([]) }}
                        className={cn("flex-1 py-3 rounded-xl font-medium",
                          theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700')}>
                        Cancelar
                      </button>
                      <button onClick={handleRegisterPayment}
                        disabled={savingPayment || paymentEntries.length === 0}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        {savingPayment ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                          : <><CheckCircle className="w-5 h-5" /> Registrar ({paymentEntries.length})</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
