'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building,
  Tag,
  FileText,
  Loader2,
  Printer,
  Download,
  Sparkles,
  User,
  Clock,
  ExternalLink,
  Eye,
  X,
  Image as ImageIcon,
  FileIcon,
  Trash2,
  Edit,
  ShoppingBag,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

interface ExpenseItem {
  id: number
  description: string
  amount: number
  suggestedCategory: string | null
  createdAt: string
}

interface ExpenseDetail {
  id: number
  description: string
  amount: number
  currency: string
  expenseDate: string
  categoryId: number | null
  categoryName: string | null
  categoryCode: string | null
  accountingType: string | null
  aiSuggestion: string | null
  aiConfidence: number | null
  aiAnalysis: string | null
  vendorName: string | null
  vendorId: string | null
  licenseNumber: string | null
  vendorActivity: string | null
  purchaseLocation: string | null
  receiptPath: string | null
  receiptType: string | null
  receiptNumber: string | null
  notes: string | null
  createdById: number
  createdByName: string
  createdByEmail: string
  createdAt: string
  updatedAt: string
  items: ExpenseItem[]
  hasItems: boolean
}

const ACCOUNTING_TYPE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  opex: { label: 'OPEX', color: 'blue', description: 'Gasto Operativo' },
  cogs: { label: 'COGS', color: 'amber', description: 'Costo de Ventas' },
  capex: { label: 'CAPEX', color: 'purple', description: 'Gasto de Capital' }
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const router = useRouter()
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchExpense()
  }, [resolvedParams.id])

  const fetchExpense = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/accounting/expenses/${resolvedParams.id}`)
      const data = await response.json()
      if (data.success) {
        setExpense(data.data)
      } else {
        setError(data.error || 'Error al cargar el gasto')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/market/accounting/expenses?id=${resolvedParams.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        router.push('/dashboard/market/accounting/expenses')
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const [cupRate, setCupRate] = useState(300)
  useEffect(() => {
    fetch('/api/market/pos/exchange-rates').then(r => r.json()).then(d => {
      if (d.success && d.rates?.CUP) setCupRate(d.rates.CUP)
    }).catch(() => {})
  }, [])

  const downloadDeclaracionJurada = async (mode: 'usd' | 'cup' = 'usd') => {
    if (!expense) return
    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const pr = [235, 91, 12] // Servisumic orange

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pw = 215.9, mg = 14, cw = pw - mg * 2
    let y = 14

    // ── HEADER: Logo left + Title right (same as invoice) ──
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = brand.logos.light
      })
      const canvas = document.createElement('canvas')
      canvas.width = logoImg.naturalWidth; canvas.height = logoImg.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(logoImg, 0, 0)
      const logoData = canvas.toDataURL('image/png')
      const maxH = 16
      const aspect = logoImg.naturalWidth / logoImg.naturalHeight
      doc.addImage(logoData, 'PNG', mg, y, maxH * aspect, maxH, undefined, 'FAST')
    } catch {}

    // Title badge on the right (orange box like invoice "OFERTA" badge)
    const badgeW = 55, badgeH = 10
    doc.setFillColor(pr[0], pr[1], pr[2])
    doc.roundedRect(pw - mg - badgeW, y, badgeW, badgeH, 2, 2, 'F')
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('DECLARACIÓN JURADA', pw - mg - badgeW / 2, y + 6.5, { align: 'center' })

    // Number below badge
    doc.setFontSize(11); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'bold')
    doc.text(`GAS-${String(expense.id).padStart(4, '0')}`, pw - mg, y + 16, { align: 'right' })

    // Barcode below number
    try {
      const bcCanvas = document.createElement('canvas')
      JsBarcode(bcCanvas, `GAS${String(expense.id).padStart(4, '0')}`, { format: 'CODE128', width: 2, height: 50, displayValue: false, margin: 3 })
      doc.addImage(bcCanvas.toDataURL('image/png'), 'PNG', pw - mg - 50, y + 19, 50, 10, undefined, 'FAST')
      doc.setFontSize(6); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal')
      doc.text(`GAS${String(expense.id).padStart(4, '0')}`, pw - mg - 25, y + 31, { align: 'center' })
    } catch {}

    y += 18
    // Company info below logo
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
    doc.text('ServiSumic Infanta', mg, y); y += 3.5
    doc.text('NIT: 50004199243', mg, y); y += 3.5
    doc.text('Carretera a Berroa Km 1.5  |  facturacion@servisumic.com  |  +5363707599', mg, y)
    y += 10

    // ── Orange accent bar ──
    doc.setFillColor(pr[0], pr[1], pr[2]); doc.rect(mg, y, cw, 1.5, 'F')
    y += 8

    // Subtitle
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text('DECLARACIÓN JURADA PARA COMPRAS SIN COMPROBANTE', pw / 2, y, { align: 'center' })
    y += 4
    doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal')
    doc.text(`Fecha: ${formatDate(expense.expenseDate)}`, pw / 2, y, { align: 'center' })
    y += 10

    // Declaration text
    doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
    const declarantName = expense.vendorName || '________________________________'
    const vendorId = expense.vendorId || '________________________________'
    const licenseNo = expense.licenseNumber || '________'
    const activity = expense.vendorActivity || '________________________________'
    const location = expense.purchaseLocation || '________________________________'

    const declText = `${declarantName}, en mi condición de Trabajador por Cuenta Propia, TCP, autorizado por la Dirección de Trabajo a ejercer la actividad de ${activity}, con No. ${licenseNo}, de la Dirección Municipal de Trabajo de Plaza de la Revolución y con Código de Barras de Identificación Tributaria (NIT) ${vendorId}, Folio 2302 de la DPA de fecha ${formatDate(expense.expenseDate)}, emitido por la ONAT, DECLARO lo siguiente:`

    const lines = doc.splitTextToSize(declText, cw)
    doc.text(lines, mg, y)
    y += lines.length * 5 + 6

    doc.setFont('helvetica', 'normal')
    doc.text(`Que en la fecha que a continuación se expone se procedió a realizar compras o adquirir servicios sin que el/la oferente entregara comprobante o certifico de pago del producto comprado o servicio realizado, para lo cual dejo constancia de lo siguiente:`, mg, y, { maxWidth: cw })
    y += 18

    doc.text(`Lugar de compra o del servicio prestado: ${location}`, mg, y); y += 6
    doc.text(`Datos del oferente: vendedor/prestador:`, mg, y); y += 5
    doc.text(`Nombre y Apellidos: ${declarantName}`, mg, y)
    doc.text(`Actividad que realiza: ${activity}`, mg + cw / 2, y); y += 5
    doc.text(`No. de Licencia: ${licenseNo}`, mg, y)
    doc.text(`Carnet identidad: ${vendorId}`, mg + cw / 2, y); y += 10

    // Currency helpers
    const isCUP = mode === 'cup'
    const cur = isCUP ? 'CUP' : 'USD'
    const fmtP = (usd: number) => isCUP ? `${Math.round(usd * cupRate).toLocaleString('es-ES')} CUP` : `$${usd.toFixed(2)}`

    // Show rate if CUP
    if (isCUP) {
      doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'italic')
      doc.text(`Tasa de cambio: 1 USD = ${cupRate} CUP`, pw - mg, y - 2, { align: 'right' })
    }

    // Items table
    const colWidths = [12, 75, 25, 30, 35]
    const headers = ['No', 'Producto/Servicio', 'Cantidad', `Precio ${cur}`, `Importe ${cur}`]

    // Table header
    doc.setFillColor(pr[0], pr[1], pr[2])
    doc.rect(mg, y - 4, cw, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    let tx = mg + 2
    headers.forEach((h, i) => {
      doc.text(h, i >= 2 ? tx + colWidths[i] - 2 : tx, y, i >= 2 ? { align: 'right' } : undefined)
      tx += colWidths[i]
    })
    y += 7

    // Table rows
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
    let total = 0

    if (expense.items && expense.items.length > 0) {
      expense.items.forEach((item, i) => {
        if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(mg, y - 4, cw, 7, 'F') }
        tx = mg + 2
        doc.text(String(i + 1), tx, y); tx += colWidths[0]
        doc.text(item.description.substring(0, 40), tx, y); tx += colWidths[1]
        doc.text('1', tx + colWidths[2] - 2, y, { align: 'right' }); tx += colWidths[2]
        doc.text(fmtP(item.amount), tx + colWidths[3] - 2, y, { align: 'right' }); tx += colWidths[3]
        doc.text(fmtP(item.amount), tx + colWidths[4] - 2, y, { align: 'right' })
        total += item.amount
        y += 7
      })
    } else {
      doc.text('1', mg + 2, y)
      doc.text(expense.description.substring(0, 40), mg + 2 + colWidths[0], y)
      doc.text('1', mg + 2 + colWidths[0] + colWidths[1] + colWidths[2] - 2, y, { align: 'right' })
      doc.text(fmtP(expense.amount), mg + 2 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 2, y, { align: 'right' })
      doc.text(fmtP(expense.amount), mg + cw - 2, y, { align: 'right' })
      total = expense.amount
      y += 7
    }

    // Total row
    doc.setDrawColor(200, 200, 200); doc.line(mg, y - 2, mg + cw, y - 2)
    y += 4
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text('Total', mg + 2 + colWidths[0], y)
    doc.setTextColor(pr[0], pr[1], pr[2])
    doc.text(fmtP(total), mg + cw - 2, y, { align: 'right' })
    y += 14

    // Legal text
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
    doc.text('Todo lo cual certifico suscribiendo el presente documento como constancia para el registro contable.', mg, y)
    y += 20

    // Signature lines
    doc.setDrawColor(100, 100, 100)
    doc.line(mg, y, mg + 70, y)
    doc.line(pw - mg - 70, y, pw - mg, y)
    y += 5
    doc.setFontSize(8); doc.setTextColor(100, 100, 100)
    doc.text('TCP (Firma)', mg + 35, y, { align: 'center' })
    doc.text('Fecha', pw - mg - 35, y, { align: 'center' })

    // Footer
    y = 265
    doc.setDrawColor(200, 200, 200); doc.line(mg, y, pw - mg, y)
    y += 4
    doc.setFontSize(7); doc.setTextColor(130, 130, 130)
    doc.text('Documento generado por LogiRapid/Servisumic  |  facturacion@servisumic.com  |  +5363707599', pw / 2, y, { align: 'center' })

    doc.save(`Declaracion-Jurada-GAS-${String(expense.id).padStart(4, '0')}-${mode.toUpperCase()}.pdf`)

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

  const getReceiptUrl = (path: string) => {
    if (path.startsWith('http')) return path
    // If path already includes bucket name, use as-is
    if (path.startsWith('company-documents/') || path.startsWith('company-private-documents/')) {
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`
    }
    // Otherwise prepend the bucket name
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company-documents/${path}`
  }

  const isPdfReceipt = expense?.receiptType === 'application/pdf' || expense?.receiptPath?.endsWith('.pdf')

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !expense) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {error || 'Gasto no encontrado'}
              </h2>
              <Link href="/dashboard/market/accounting/expenses">
                <button className="text-orange-500 hover:text-orange-600">
                  Volver a gastos
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const accountingConfig = expense.accountingType ? ACCOUNTING_TYPE_CONFIG[expense.accountingType] : null

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/accounting/expenses">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Gasto #{expense.id}</h1>
                    {accountingConfig && (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                        accountingConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        accountingConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        accountingConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      )}>
                        {accountingConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{expense.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.print()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadDeclaracionJurada('usd')}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  DJ USD
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadDeclaracionJurada('cup')}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  DJ CUP
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Eliminar
                </motion.button>
              </div>
            </div>

            {/* Hero Header Card (like purchases) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={cn('p-6 rounded-2xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm')}>
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Receipt className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Gasto #{expense.id}</p>
                    <h2 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{expense.description}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {accountingConfig && (
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium',
                          accountingConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                          accountingConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                          accountingConfig.color === 'purple' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        )}>{accountingConfig.label}</span>
                      )}
                      {expense.categoryName && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{expense.categoryName}</span>
                      )}
                      {expense.receiptNumber && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">#{expense.receiptNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold text-orange-600">{formatCurrency(expense.amount, expense.currency)}</p>
                  <p className="text-sm text-gray-500">{formatDate(expense.expenseDate)}</p>
                </div>
              </div>
            </motion.div>

            {/* Activity Timeline */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className={cn('p-6 rounded-2xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm')}>
              <h3 className={cn('text-sm font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Clock className="w-4 h-4 text-gray-400" /> Historial de Actividad
              </h3>
              <div className="relative">
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-4">
                  {/* Created */}
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center z-10 shadow-sm">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Gasto registrado</p>
                      <p className="text-xs text-gray-500">por {expense.createdByName} · {formatDateTime(expense.createdAt)}</p>
                    </div>
                  </div>
                  {/* AI Categorized */}
                  {expense.aiSuggestion && (
                    <div className="flex items-start gap-4 relative">
                      <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center z-10 shadow-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Categorizado por IA: {expense.aiSuggestion}
                        </p>
                        <p className="text-xs text-gray-500">
                          Confianza: {expense.aiConfidence ? Math.round(expense.aiConfidence * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Modified */}
                  {expense.updatedAt !== expense.createdAt && (
                    <div className="flex items-start gap-4 relative">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center z-10 shadow-sm">
                        <Edit className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Gasto modificado</p>
                        <p className="text-xs text-gray-500">{formatDateTime(expense.updatedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats Grid (like purchases) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                <p className="text-xs text-gray-500 uppercase mb-1">Monto</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(expense.amount)}</p>
              </div>
              <div className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                <p className="text-xs text-gray-500 uppercase mb-1">Fecha</p>
                <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(expense.expenseDate)}</p>
              </div>
              <div className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                <p className="text-xs text-gray-500 uppercase mb-1">Proveedor</p>
                <p className={cn('text-lg font-bold truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{expense.vendorName || '—'}</p>
              </div>
              <div className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                <p className="text-xs text-gray-500 uppercase mb-1">Items</p>
                <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{expense.items.length || 1}</p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Details */}
              <div className="space-y-6">
                {/* Expense Info */}
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Información del Gasto
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <DollarSign className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Monto</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Calendar className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fecha del Gasto</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatDate(expense.expenseDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Tag className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Categoría</p>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {expense.categoryName || 'Sin categoría'}
                          </p>
                          {expense.categoryCode && (
                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                              {expense.categoryCode}
                            </span>
                          )}
                        </div>
                        {accountingConfig && (
                          <p className="text-xs text-gray-500 mt-1">{accountingConfig.description}</p>
                        )}
                      </div>
                    </div>
                    {expense.vendorName && (
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <Building className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Proveedor</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {expense.vendorName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Productos/Items del Recibo */}
                {expense.hasItems && expense.items.length > 0 && (
                  <div className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Productos del Recibo ({expense.items.length})
                    </h3>
                    <div className="space-y-3">
                      {expense.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                              theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.description}
                              </p>
                              {item.suggestedCategory && (
                                <p className="text-xs text-gray-500">
                                  {item.suggestedCategory}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(item.amount, expense.currency)}
                          </p>
                        </div>
                      ))}
                      {/* Total de items */}
                      <div className={cn(
                        'flex items-center justify-between pt-3 mt-3 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <p className="font-medium text-gray-500">
                          Subtotal productos
                        </p>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(
                            expense.items.reduce((sum, item) => sum + item.amount, 0),
                            expense.currency
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {expense.notes && (
                  <div className={cn('p-5 rounded-2xl border', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Notas / Comentarios</h3>
                    <p className="text-gray-700 dark:text-gray-300">{expense.notes}</p>
                  </div>
                )}

                {/* AI Analysis */}
                {(expense.aiSuggestion || expense.aiAnalysis) && (
                  <div className={cn('p-5 rounded-2xl border', theme === 'dark' ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200')}>
                    <h3 className="text-sm font-medium text-orange-600 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Análisis de IA
                    </h3>
                    {expense.aiSuggestion && (
                      <div className="mb-3">
                        <p className="text-xs text-orange-500 mb-1">Categoría Sugerida</p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-orange-700 dark:text-orange-300">{expense.aiSuggestion}</span>
                          {expense.aiConfidence && (
                            <span className="text-xs px-2 py-0.5 bg-orange-200 dark:bg-orange-800 rounded-full">
                              {Math.round(expense.aiConfidence * 100)}% confianza
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {expense.aiAnalysis && (
                      <div>
                        <p className="text-xs text-orange-500 mb-1">Razonamiento</p>
                        <p className="text-sm text-orange-700 dark:text-orange-300">{expense.aiAnalysis}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column - Receipt */}
              <div className="space-y-6">
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Recibo Original
                  </h3>

                  {expense.receiptPath ? (
                    <div className="space-y-4">
                      {/* Receipt Preview */}
                      <div
                        className={cn(
                          'relative rounded-xl overflow-hidden cursor-pointer group',
                          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                        )}
                        onClick={() => setShowReceiptModal(true)}
                      >
                        {isPdfReceipt ? (
                          <div className="aspect-[3/4] flex flex-col items-center justify-center p-8">
                            <FileIcon className="w-16 h-16 text-red-500 mb-4" />
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Documento PDF
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Click para ver
                            </p>
                          </div>
                        ) : (
                          <div className="aspect-[3/4] relative">
                            <img
                              src={getReceiptUrl(expense.receiptPath)}
                              alt="Recibo"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-2 text-white">
                            <Eye className="w-5 h-5" />
                            <span>Ver completo</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowReceiptModal(true)}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-white hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </motion.button>
                        <motion.a
                          href={getReceiptUrl(expense.receiptPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-white hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Abrir
                        </motion.a>
                        <motion.a
                          href={getReceiptUrl(expense.receiptPath)}
                          download
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </motion.a>
                      </div>
                    </div>
                  ) : (
                    <div className={cn(
                      'aspect-[3/4] rounded-xl flex flex-col items-center justify-center',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                    )}>
                      <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-500">No hay recibo adjunto</p>
                    </div>
                  )}
                </div>

                {/* Description Card */}
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Descripción</h3>
                  <p className="text-gray-700 dark:text-gray-300">{expense.description}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Receipt Modal */}
        {showReceiptModal && expense.receiptPath && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReceiptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowReceiptModal(false)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300"
              >
                <X className="w-8 h-8" />
              </button>

              {isPdfReceipt ? (
                <iframe
                  src={getReceiptUrl(expense.receiptPath)}
                  className="w-full h-[80vh] rounded-xl"
                />
              ) : (
                <img
                  src={getReceiptUrl(expense.receiptPath)}
                  alt="Recibo"
                  className="w-full max-h-[80vh] object-contain rounded-xl"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
