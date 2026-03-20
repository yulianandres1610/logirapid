'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  Printer,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Package
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface SessionReport {
  session: {
    id: number
    sessionCode: string
    terminalCode: string
    terminalName: string
    warehouseName: string
    companyName: string
    openedBy: string
    closedBy: string | null
    openedAt: string
    closedAt: string | null
    status: string
    openingNotes: string | null
    closingNotes: string | null
  }
  openingCash: { usd: number; cup: number; mlc: number }
  closingCash: { usd: number; cup: number; mlc: number } | null
  cashDifference: number | null
  inventoryShortage: number
  openingDenominations: Record<string, Record<number, number>> | null
  closingDenominations: Record<string, Record<number, number>> | null
  summary: {
    paidOrders: number
    voidedOrders: number
    refundedOrders: number
    totalSales: number
    totalRefunds: number
    totalDiscounts: number
  }
  cashSummary: Record<string, { collected: number; tendered: number; change: number; count: number }>
  otherPayments: Array<{ method: string; currency: string; amount: number; count: number }>
  productsSold: Array<{
    productId: number
    productName: string
    productSku: string | null
    variantId: number | null
    quantity: number
    subtotal: number
    discount: number
    total: number
    avgPrice: number
    orderCount: number
  }>
}

const USD_DENOMINATIONS = [
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 1, label: '$1' },
  { value: 0.25, label: '25¢' },
]

const CUP_DENOMINATIONS = [
  { value: 1000, label: '1000' },
  { value: 500, label: '500' },
  { value: 200, label: '200' },
  { value: 100, label: '100' },
  { value: 50, label: '50' },
  { value: 20, label: '20' },
  { value: 10, label: '10' },
  { value: 5, label: '5' },
  { value: 1, label: '1' },
]

const MLC_DENOMINATIONS = [
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 1, label: '$1' },
]

export default function SessionReceiptPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string
  const sessionId = searchParams.get('sessionId')
  const autoPrint = searchParams.get('autoPrint') === 'true'

  const [report, setReport] = useState<SessionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [autoPrintAttempted, setAutoPrintAttempted] = useState(false)

  // Fetch session report
  useEffect(() => {
    const fetchReport = async () => {
      if (!sessionId) {
        setError('ID de sesión no proporcionado')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/market/pos/sessions/${sessionId}/report`)
        const data = await response.json()

        if (data.success) {
          setReport(data.data)
        } else {
          setError(data.error || 'Error al cargar el reporte')
        }
      } catch (err) {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [sessionId])


  // Auto-print if requested
  useEffect(() => {
    const doAutoPrint = async () => {
      if (autoPrint && report && !autoPrintAttempted) {
        setAutoPrintAttempted(true)
        // Wait a bit for UI to render, then print
        setTimeout(() => handlePrint(), 500)
      }
    }
    doAutoPrint()
  }, [autoPrint, report, autoPrintAttempted])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'CUP') {
      return `${Math.round(amount).toLocaleString('es-ES')} CUP`
    }
    if (currency === 'MLC') {
      return `$${amount.toFixed(2)} MLC`
    }
    return `$${amount.toFixed(2)}`
  }

  const getDuration = (openedAt: string, closedAt: string | null) => {
    const start = new Date(openedAt)
    const end = closedAt ? new Date(closedAt) : new Date()
    const diff = end.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo'
      case 'card': return 'Tarjeta'
      case 'transfer': return 'Transferencia'
      case 'credit': return 'Crédito'
      default: return method
    }
  }

  // Print with service (server resolves printer automatically)
  const printWithService = async () => {
    if (!report) return

    setPrinting(true)
    try {
      const printData = {
        documentType: 'session_close_report',
        documentData: buildPrintData(report),
        copies: 1,
        sourceType: 'pos_session',
        sourceId: report.session.id
      }

      console.log('[Session Receipt] Sending print job')

      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printData)
      })

      const result = await response.json()

      if (result.success) {
        console.log('[Session Receipt] Print job created successfully:', result.data?.jobNumber)
        // Success - do not fallback to browser
      } else {
        console.warn('[Session Receipt] Print job failed:', result.error)
        handleBrowserPrint()
      }
    } catch (err) {
      console.error('[Session Receipt] Print error:', err)
      handleBrowserPrint()
    } finally {
      setPrinting(false)
    }
  }

  const handlePrint = async () => {
    if (!report) return

    console.log('[Session Receipt] handlePrint called, sending to print service...')
    setPrinting(true)

    try {
      await printWithService()
    } catch (err) {
      console.error('[Session Receipt] Error in handlePrint:', err)
      handleBrowserPrint()
    }
  }

  const buildPrintData = (report: SessionReport) => {
    const { session, openingCash, closingCash, summary, cashSummary, otherPayments, productsSold, cashDifference, inventoryShortage } = report

    // Build denominations summary
    const denominationsSummary: Record<string, Array<{ label: string; count: number; total: number }>> = {}

    if (report.closingDenominations) {
      for (const [currency, counts] of Object.entries(report.closingDenominations)) {
        const denomList = currency === 'usd' ? USD_DENOMINATIONS :
                          currency === 'cup' ? CUP_DENOMINATIONS : MLC_DENOMINATIONS
        denominationsSummary[currency.toUpperCase()] = denomList
          .filter(d => counts[d.value] && counts[d.value] > 0)
          .map(d => ({
            label: d.label,
            count: counts[d.value] || 0,
            total: (counts[d.value] || 0) * d.value
          }))
      }
    }

    return {
      reportNumber: session.sessionCode,
      companyName: session.companyName || 'LogiRapid',
      terminalName: session.terminalName,
      terminalCode: session.terminalCode,
      warehouseName: session.warehouseName,
      openedBy: session.openedBy,
      closedBy: session.closedBy,
      openedAt: formatDate(session.openedAt),
      closedAt: session.closedAt ? formatDate(session.closedAt) : 'Abierta',
      duration: getDuration(session.openedAt, session.closedAt),
      openingCash,
      closingCash,
      cashDifference,
      inventoryShortage,
      summary: {
        ...summary,
        totalProducts: productsSold.reduce((sum, p) => sum + p.quantity, 0)
      },
      cashSummary,
      otherPayments,
      denominationsSummary,
      productsSold: productsSold.slice(0, 50), // Limit to 50 products for print
      closingNotes: session.closingNotes
    }
  }

  const handleBrowserPrint = () => {
    if (!report) return

    const { session, openingCash, closingCash, summary, cashSummary, otherPayments, productsSold, cashDifference, inventoryShortage } = report

    // Build receipt text (80mm thermal format)
    let receipt = ''
    const line = '='.repeat(42)
    const dash = '-'.repeat(42)

    receipt += `${session.companyName || 'LogiRapid'}\n`.padStart(21 + (session.companyName?.length || 9) / 2)
    receipt += `\n${line}\n`
    receipt += `      REPORTE DE CIERRE DE CAJA\n`
    receipt += `${line}\n\n`

    receipt += `Sesion: ${session.sessionCode}\n`
    receipt += `Terminal: ${session.terminalName}\n`
    receipt += `Almacen: ${session.warehouseName || 'N/A'}\n\n`

    receipt += `Apertura: ${formatDate(session.openedAt)}\n`
    receipt += `Por: ${session.openedBy}\n`
    if (session.closedAt) {
      receipt += `Cierre: ${formatDate(session.closedAt)}\n`
      receipt += `Por: ${session.closedBy}\n`
    }
    receipt += `Duracion: ${getDuration(session.openedAt, session.closedAt)}\n`

    receipt += `\n${line}\n`
    receipt += `           RESUMEN DE VENTAS\n`
    receipt += `${dash}\n`
    receipt += `Ordenes pagadas:      ${summary.paidOrders.toString().padStart(15)}\n`
    if (summary.voidedOrders > 0) {
      receipt += `Ordenes anuladas:     ${summary.voidedOrders.toString().padStart(15)}\n`
    }
    if (summary.refundedOrders > 0) {
      receipt += `Ordenes reembolsadas: ${summary.refundedOrders.toString().padStart(15)}\n`
    }
    receipt += `${dash}\n`
    receipt += `TOTAL VENTAS:         ${formatCurrency(summary.totalSales).padStart(15)}\n`
    if (summary.totalDiscounts > 0) {
      receipt += `Descuentos:           ${('-' + formatCurrency(summary.totalDiscounts)).padStart(15)}\n`
    }

    // Cash summary
    receipt += `\n${line}\n`
    receipt += `           COBROS POR METODO\n`
    receipt += `${dash}\n`

    // Cash payments
    for (const [currency, data] of Object.entries(cashSummary)) {
      receipt += `Efectivo ${currency}:\n`
      receipt += `  Recibido:           ${formatCurrency(data.tendered, currency).padStart(15)}\n`
      receipt += `  Cambio dado:        ${('-' + formatCurrency(data.change, currency)).padStart(15)}\n`
      receipt += `  Neto cobrado:       ${formatCurrency(data.collected, currency).padStart(15)}\n`
      receipt += `  Transacciones:      ${data.count.toString().padStart(15)}\n`
    }

    // Other payments
    for (const p of otherPayments) {
      receipt += `${getPaymentMethodLabel(p.method)} ${p.currency}: ${formatCurrency(p.amount, p.currency).padStart(15)}\n`
      receipt += `  Transacciones:      ${p.count.toString().padStart(15)}\n`
    }

    // Cash balance
    receipt += `\n${line}\n`
    receipt += `           CUADRE DE CAJA\n`
    receipt += `${dash}\n`

    receipt += `FONDO APERTURA:\n`
    receipt += `  USD:                ${formatCurrency(openingCash.usd).padStart(15)}\n`
    receipt += `  CUP:                ${formatCurrency(openingCash.cup, 'CUP').padStart(15)}\n`
    if (openingCash.mlc > 0) {
      receipt += `  MLC:                ${formatCurrency(openingCash.mlc, 'MLC').padStart(15)}\n`
    }

    if (closingCash) {
      receipt += `\nCIERRE REPORTADO:\n`
      receipt += `  USD:                ${formatCurrency(closingCash.usd).padStart(15)}\n`
      receipt += `  CUP:                ${formatCurrency(closingCash.cup, 'CUP').padStart(15)}\n`
      if (closingCash.mlc > 0) {
        receipt += `  MLC:                ${formatCurrency(closingCash.mlc, 'MLC').padStart(15)}\n`
      }
    }

    if (inventoryShortage > 0) {
      receipt += `\nFaltante inventario:  ${formatCurrency(inventoryShortage).padStart(15)}\n`
    }

    if (cashDifference !== null) {
      receipt += `\n${dash}\n`
      receipt += `DIFERENCIA (USD):     ${(cashDifference >= 0 ? '+' : '') + formatCurrency(cashDifference).padStart(14)}\n`
    }

    // Closing Denominations
    if (report.closingDenominations) {
      receipt += `\n${line}\n`
      receipt += `       DESGLOSE DE BILLETES (CIERRE)\n`
      receipt += `${dash}\n`

      for (const [currency, counts] of Object.entries(report.closingDenominations)) {
        const denomList = currency === 'usd' ? USD_DENOMINATIONS :
                          currency === 'cup' ? CUP_DENOMINATIONS : MLC_DENOMINATIONS
        const currencyLabel = currency.toUpperCase()

        // Filter denominations with count > 0
        const activeDenoms = denomList.filter(d => counts[d.value] && counts[d.value] > 0)

        if (activeDenoms.length > 0) {
          receipt += `\n${currencyLabel}:\n`
          let currencyTotal = 0
          for (const d of activeDenoms) {
            const count = counts[d.value] || 0
            const total = count * d.value
            currencyTotal += total
            const denomLabel = currency === 'cup' ? `${d.label} CUP` : d.label
            receipt += `  ${denomLabel.padEnd(10)} x ${count.toString().padStart(3)} = ${formatCurrency(total, currencyLabel).padStart(12)}\n`
          }
          receipt += `  ${'-'.repeat(30)}\n`
          receipt += `  Total ${currencyLabel}:`.padEnd(20) + `${formatCurrency(currencyTotal, currencyLabel).padStart(12)}\n`
        }
      }
    }

    // Products sold
    if (productsSold.length > 0) {
      receipt += `\n${line}\n`
      receipt += `        PRODUCTOS VENDIDOS (${productsSold.reduce((s, p) => s + p.quantity, 0)})\n`
      receipt += `${dash}\n`

      for (const p of productsSold.slice(0, 30)) {
        const name = p.productName.length > 25 ? p.productName.substring(0, 22) + '...' : p.productName
        receipt += `${name}\n`
        receipt += `  ${p.quantity} x ${formatCurrency(p.avgPrice)} = ${formatCurrency(p.total).padStart(10)}\n`
      }

      if (productsSold.length > 30) {
        receipt += `\n... y ${productsSold.length - 30} productos mas\n`
      }
    }

    // Closing notes
    if (session.closingNotes) {
      receipt += `\n${line}\n`
      receipt += `NOTAS:\n${session.closingNotes}\n`
    }

    receipt += `\n${line}\n`
    receipt += `        Generado: ${new Date().toLocaleString('es-ES')}\n`
    receipt += `${line}\n`

    // Open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cierre de Caja - ${session.sessionCode}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.3;
              margin: 0;
              padding: 10px;
              white-space: pre-wrap;
              word-wrap: break-word;
              width: 80mm;
            }
            @media print {
              body { margin: 0; padding: 5px; }
            }
          </style>
        </head>
        <body>${receipt}</body>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const handleShowPrinterModal = () => {
    // Just call handlePrint - it will decide whether to show modal or print silently
    handlePrint()
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
              <p className="mt-4 text-gray-500">Cargando reporte...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !report) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Error</h2>
              <p className="text-gray-500 mb-4">{error || 'No se pudo cargar el reporte'}</p>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Volver
              </button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const { session, openingCash, closingCash, summary, cashSummary, otherPayments, productsSold, cashDifference, inventoryShortage } = report

  return (
    <ProtectedRoute>
      <DashboardLayout hideSidebar noPadding>
        <div className="fixed inset-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className={cn(
            'flex-shrink-0 px-4 py-3 border-b flex items-center justify-between',
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-bold text-lg">Reporte de Cierre</h1>
                <p className="text-sm text-gray-500">{session.sessionCode}</p>
              </div>
            </div>
            <button
              onClick={handleShowPrinterModal}
              disabled={printing}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
            >
              {printing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              Imprimir
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Session Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border overflow-hidden shadow-lg',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Información de Sesión
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Terminal</p>
                    <p className="font-medium">{session.terminalName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Almacén</p>
                    <p className="font-medium">{session.warehouseName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Apertura</p>
                    <p className="font-medium">{formatDate(session.openedAt)}</p>
                    <p className="text-xs text-gray-400">{session.openedBy}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cierre</p>
                    <p className="font-medium">{session.closedAt ? formatDate(session.closedAt) : 'Abierta'}</p>
                    {session.closedBy && <p className="text-xs text-gray-400">{session.closedBy}</p>}
                  </div>
                  <div>
                    <p className="text-gray-500">Duración</p>
                    <p className="font-medium">{getDuration(session.openedAt, session.closedAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Estado</p>
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                      session.status === 'open'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Sales Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Resumen de Ventas
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Órdenes pagadas</span>
                      <span className="font-bold text-lg">{summary.paidOrders}</span>
                    </div>
                    {summary.voidedOrders > 0 && (
                      <div className="flex justify-between items-center text-amber-500">
                        <span>Órdenes anuladas</span>
                        <span className="font-medium">{summary.voidedOrders}</span>
                      </div>
                    )}
                    {summary.refundedOrders > 0 && (
                      <div className="flex justify-between items-center text-red-500">
                        <span>Órdenes reembolsadas</span>
                        <span className="font-medium">{summary.refundedOrders}</span>
                      </div>
                    )}
                    <div className={cn(
                      'pt-3 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex justify-between items-center">
                        <span className="text-green-500 font-medium">Total Ventas</span>
                        <span className="font-bold text-2xl text-green-500">{formatCurrency(summary.totalSales)}</span>
                      </div>
                      {summary.totalDiscounts > 0 && (
                        <div className="flex justify-between text-sm text-amber-500 mt-1">
                          <span>Descuentos aplicados</span>
                          <span>-{formatCurrency(summary.totalDiscounts)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Payment Methods */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Cobros por Método
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(cashSummary).map(([currency, data]) => (
                      <div key={currency} className={cn(
                        'p-3 rounded-xl',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            Efectivo {currency}
                          </span>
                          <span className="font-bold">{formatCurrency(data.collected, currency)}</span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Recibido</span>
                            <span>{formatCurrency(data.tendered, currency)}</span>
                          </div>
                          <div className="flex justify-between text-amber-500">
                            <span>Cambio dado</span>
                            <span>-{formatCurrency(data.change, currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Transacciones</span>
                            <span>{data.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {otherPayments.map((p, i) => (
                      <div key={i} className={cn(
                        'p-3 rounded-xl flex items-center justify-between',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                      )}>
                        <span className="font-medium flex items-center gap-2">
                          {p.method === 'transfer' ? <ArrowRightLeft className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                          {getPaymentMethodLabel(p.method)} {p.currency}
                        </span>
                        <div className="text-right">
                          <span className="font-bold">{formatCurrency(p.amount, p.currency)}</span>
                          <p className="text-xs text-gray-500">{p.count} trans.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Cash Balance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'rounded-2xl border-2 overflow-hidden shadow-lg',
                  cashDifference === null ? 'border-gray-500' :
                  Math.abs(cashDifference) < 0.01 ? 'border-green-500 bg-green-500/10' :
                  cashDifference > 0 ? 'border-blue-500 bg-blue-500/10' :
                  'border-red-500 bg-red-500/10'
                )}
              >
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    {cashDifference !== null && (
                      cashDifference === 0 ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                      cashDifference > 0 ? <TrendingUp className="w-5 h-5 text-blue-500" /> :
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    Cuadre de Caja
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Opening */}
                    <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                      <p className="text-sm text-gray-500 mb-2">Fondo de Apertura</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>USD</span>
                          <span className="font-mono">{formatCurrency(openingCash.usd)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>CUP</span>
                          <span className="font-mono">{formatCurrency(openingCash.cup, 'CUP')}</span>
                        </div>
                        {openingCash.mlc > 0 && (
                          <div className="flex justify-between">
                            <span>MLC</span>
                            <span className="font-mono">{formatCurrency(openingCash.mlc, 'MLC')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Closing */}
                    {closingCash && (
                      <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                        <p className="text-sm text-gray-500 mb-2">Cierre Reportado</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>USD</span>
                            <span className="font-mono">{formatCurrency(closingCash.usd)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CUP</span>
                            <span className="font-mono">{formatCurrency(closingCash.cup, 'CUP')}</span>
                          </div>
                          {closingCash.mlc > 0 && (
                            <div className="flex justify-between">
                              <span>MLC</span>
                              <span className="font-mono">{formatCurrency(closingCash.mlc, 'MLC')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Difference */}
                    <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                      <p className="text-sm text-gray-500 mb-2">Diferencia (USD)</p>
                      {cashDifference !== null ? (
                        <p className={cn(
                          'text-3xl font-bold font-mono',
                          Math.abs(cashDifference) < 0.01 ? 'text-green-500' :
                          cashDifference > 0 ? 'text-blue-500' : 'text-red-500'
                        )}>
                          {cashDifference >= 0 ? '+' : ''}{formatCurrency(cashDifference)}
                        </p>
                      ) : (
                        <p className="text-gray-400 italic">Sin cierre</p>
                      )}
                      {inventoryShortage > 0 && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Faltante inventario: {formatCurrency(inventoryShortage)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Closing Denominations */}
              {report.closingDenominations && Object.keys(report.closingDenominations).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Banknote className="w-5 h-5" />
                      Desglose de Billetes (Cierre)
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(report.closingDenominations).map(([currency, counts]) => {
                        const denomList = currency === 'usd' ? USD_DENOMINATIONS :
                                          currency === 'cup' ? CUP_DENOMINATIONS : MLC_DENOMINATIONS
                        const currencyLabel = currency.toUpperCase()
                        const activeDenoms = denomList.filter(d => counts[d.value] && counts[d.value] > 0)
                        const total = activeDenoms.reduce((sum, d) => sum + (counts[d.value] || 0) * d.value, 0)

                        if (activeDenoms.length === 0) return null

                        return (
                          <div key={currency} className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
                            <p className="font-bold text-sm mb-3">{currencyLabel}</p>
                            <div className="space-y-1 text-sm">
                              {activeDenoms.map(d => (
                                <div key={d.value} className="flex justify-between">
                                  <span className="text-gray-500">{d.label} x {counts[d.value]}</span>
                                  <span className="font-mono">{formatCurrency((counts[d.value] || 0) * d.value, currencyLabel)}</span>
                                </div>
                              ))}
                              <div className={cn('pt-2 mt-2 border-t flex justify-between font-bold', theme === 'dark' ? 'border-gray-700' : 'border-gray-300')}>
                                <span>Total</span>
                                <span className="font-mono">{formatCurrency(total, currencyLabel)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Products Sold */}
              {productsSold.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Productos Vendidos ({productsSold.reduce((s, p) => s + p.quantity, 0)} unidades)
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(
                            'border-b',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <th className="text-left py-2 px-2">Producto</th>
                            <th className="text-right py-2 px-2">Cant.</th>
                            <th className="text-right py-2 px-2">Precio</th>
                            <th className="text-right py-2 px-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsSold.slice(0, 50).map((p, i) => (
                            <tr key={i} className={cn(
                              'border-b',
                              theme === 'dark' ? 'border-gray-700/50' : 'border-gray-100'
                            )}>
                              <td className="py-2 px-2">
                                <p className="font-medium">{p.productName}</p>
                                {p.productSku && <p className="text-xs text-gray-500">{p.productSku}</p>}
                              </td>
                              <td className="text-right py-2 px-2 font-mono">{p.quantity}</td>
                              <td className="text-right py-2 px-2 font-mono">{formatCurrency(p.avgPrice)}</td>
                              <td className="text-right py-2 px-2 font-mono font-medium">{formatCurrency(p.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={cn(
                            'border-t-2 font-bold',
                            theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                          )}>
                            <td className="py-2 px-2">TOTAL</td>
                            <td className="text-right py-2 px-2 font-mono">
                              {productsSold.reduce((s, p) => s + p.quantity, 0)}
                            </td>
                            <td></td>
                            <td className="text-right py-2 px-2 font-mono">
                              {formatCurrency(productsSold.reduce((s, p) => s + p.total, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {productsSold.length > 50 && (
                      <p className="text-center text-sm text-gray-500 mt-2">
                        Mostrando 50 de {productsSold.length} productos
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Closing Notes */}
              {session.closingNotes && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className={cn(
                    'rounded-2xl border p-4 shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <h3 className="font-bold text-sm mb-2">Notas del Cierre</h3>
                  <p className="text-gray-500 text-sm whitespace-pre-wrap">{session.closingNotes}</p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            'flex-shrink-0 px-4 py-3 border-t text-center text-sm text-gray-500',
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          )}>
            Generado: {new Date().toLocaleString('es-ES')}
          </div>
        </div>

      </DashboardLayout>
    </ProtectedRoute>
  )
}
